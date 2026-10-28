import 'dotenv/config';

import express from 'express';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import nodemailer from 'nodemailer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = Number(process.env.PORT || 3000);
const maxFileSize = 5 * 1024 * 1024;
const maxSubmissionSize = 18 * 1024 * 1024;
const documentFields = ['pod', 'photo', 'ghfront', 'ghback', 'bghfront', 'bghback', 'poa', 'spec'];
const acceptedExtensions = new Set(['.jpg', '.jpeg', '.png', '.pdf']);

function requiredSetting(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment setting: ${name}`);
  return value;
}

const smtpHost = requiredSetting('SMTP_HOST');
const smtpPort = Number(requiredSetting('SMTP_PORT'));
const smtpUser = requiredSetting('SMTP_USER');
const smtpPass = requiredSetting('SMTP_PASS');
const mailFrom = requiredSetting('SMTP_FROM');
const mailTo = requiredSetting('MAIL_TO');
const smtpSecure = process.env.SMTP_SECURE === 'true';
const smtpRequireTls = process.env.SMTP_REQUIRE_TLS !== 'false';
const trustProxyHops = Number(process.env.TRUST_PROXY_HOPS || 0);

if (!Number.isInteger(smtpPort) || smtpPort < 1 || smtpPort > 65535) {
  throw new Error('SMTP_PORT must be an integer between 1 and 65535.');
}
if (!Number.isInteger(trustProxyHops) || trustProxyHops < 0) {
  throw new Error('TRUST_PROXY_HOPS must be a non-negative integer.');
}

app.disable('x-powered-by');
app.set('trust proxy', trustProxyHops);
app.use((request, response, next) => {
  response.set({
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'same-origin'
  });
  next();
});

const pageFiles = {
  '/': 'index.html',
  '/index.html': 'index.html',
  '/mandate-enhancements.js': 'mandate-enhancements.js',
  '/mandate-enhancements.css': 'mandate-enhancements.css',
  '/new-logo-lynch.svg': 'new-logo-lynch.svg'
};
for (const [route, file] of Object.entries(pageFiles)) {
  app.get(route, (request, response) => response.sendFile(path.join(__dirname, file)));
}

const submissionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many submissions. Please wait and try again.' }
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: maxFileSize,
    files: 1 + documentFields.length,
    fields: 3,
    fieldSize: 500
  }
}).fields([
  { name: 'mandate_pdf', maxCount: 1 },
  ...documentFields.map(name => ({ name, maxCount: 1 }))
]);

function fileKind(file) {
  const buffer = file.buffer;
  const extension = path.extname(file.originalname).toLowerCase();
  if (!acceptedExtensions.has(extension)) return null;
  if (extension === '.pdf' && buffer.subarray(0, 5).toString() === '%PDF-') return 'application/pdf';
  if ((extension === '.jpg' || extension === '.jpeg') && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (extension === '.png' && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    return 'image/png';
  }
  return null;
}

function hasVisiblePdfContent(buffer) {
  const pdf = buffer.toString('latin1');
  return /\bBT\b/.test(pdf) && /\bTj\b|\bTJ\b/.test(pdf);
}

function safeFilename(value, fallback) {
  const cleaned = String(value || '')
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '_')
    .replace(/^\.+/, '')
    .slice(0, 100);
  return cleaned || fallback;
}

function sameOrigin(request) {
  const origin = request.get('origin');
  if (!origin) return false;
  try {
    return new URL(origin).host === request.get('host');
  } catch {
    return false;
  }
}

app.post('/api/submit', submissionLimiter, (request, response, next) => {
  if (!sameOrigin(request)) {
    response.status(403).json({ error: 'Submission must come from this form.' });
    return;
  }
  upload(request, response, error => {
    if (error) {
      next(error);
      return;
    }
    next();
  });
}, async (request, response) => {
  const files = request.files || {};
  const body = request.body || {};
  const pdf = files.mandate_pdf?.[0];
  const applicant = String(body.applicant || '').trim();
  const email = String(body.email || '').trim();
  const reference = String(body.ref || '').trim();

  if (!pdf || fileKind(pdf) !== 'application/pdf') {
    response.status(400).json({ error: 'A valid generated PDF is required.' });
    return;
  }
  if (!hasVisiblePdfContent(pdf.buffer)) {
    response.status(400).json({ error: 'The generated PDF is blank. Please retry the submission.' });
    return;
  }
  if (!applicant || applicant.length > 160) {
    response.status(400).json({ error: 'Applicant name is missing or too long.' });
    return;
  }
  if (!/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/.test(email) || email.length > 254) {
    response.status(400).json({ error: 'A valid applicant email address is required.' });
    return;
  }
  if (!/^[\w-]{1,40}$/.test(reference)) {
    response.status(400).json({ error: 'The application reference is invalid.' });
    return;
  }

  const uploadedFiles = Object.entries(files).flatMap(([field, entries]) =>
    field === 'mandate_pdf' ? [] : entries.map(file => ({ field, file }))
  );
  const allFiles = [{ field: 'mandate_pdf', file: pdf }, ...uploadedFiles];
  const totalSize = allFiles.reduce((total, entry) => total + entry.file.size, 0);
  if (totalSize > maxSubmissionSize) {
    response.status(413).json({ error: 'Attachments exceed the 18 MB total limit. Reduce the file sizes and try again.' });
    return;
  }
  for (const { file } of uploadedFiles) {
    if (!fileKind(file)) {
      response.status(400).json({ error: 'Uploaded documents must be valid JPG, PNG, or PDF files.' });
      return;
    }
  }

  const attachments = allFiles.map(({ field, file }) => ({
    filename: field === 'mandate_pdf'
      ? `Mandate-${reference}-${safeFilename(applicant, 'Applicant').replace(/\s+/g, '_')}.pdf`
      : `${field}-${safeFilename(file.originalname, 'document')}`,
    content: file.buffer,
    contentType: fileKind(file),
    contentDisposition: 'attachment'
  }));
  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    requireTLS: !smtpSecure && smtpRequireTls,
    auth: { user: smtpUser, pass: smtpPass },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 30000,
    disableFileAccess: true,
    disableUrlAccess: true
  });

  try {
    await transporter.sendMail({
      from: mailFrom,
      to: mailTo,
      replyTo: email,
      subject: `Mandate application ${reference}`,
      text: `A mandate application was submitted.\n\nApplicant: ${applicant}\nApplicant email: ${email}\nReference: ${reference}\n\nThe generated application PDF and selected supporting documents are attached.`,
      attachments
    });
    response.status(200).json({ message: 'Your application was submitted successfully.' });
  } catch (error) {
    console.error('Mandate email delivery failed:', error);
    response.status(502).json({ error: 'The email could not be sent. Please try again later or contact support.' });
  } finally {
    transporter.close();
  }
});

app.use((error, request, response, next) => {
  if (error instanceof multer.MulterError) {
    const status = error.code === 'LIMIT_FILE_SIZE' || error.code === 'LIMIT_FILE_COUNT' ? 413 : 400;
    response.status(status).json({
      error: error.code === 'LIMIT_FILE_SIZE'
        ? 'Each attachment must be no larger than 5 MB.'
        : 'The uploaded file fields are invalid.'
    });
    return;
  }
  console.error('Mandate request failed:', error);
  response.status(500).json({ error: 'The submission could not be processed. Please try again.' });
});

app.listen(port, () => {
  console.log(`Mandate form server listening on port ${port}.`);
});
