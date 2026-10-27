import nodemailer from 'nodemailer';

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

if (!Number.isInteger(smtpPort) || smtpPort < 1 || smtpPort > 65535) {
  throw new Error('SMTP_PORT must be an integer between 1 and 65535.');
}

function fileKind(file) {
  const buffer = file.buffer;
  const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
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
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try {
    const expectedHost = request.headers.get('host') || new URL(request.url).host;
    return new URL(origin).host === expectedHost;
  } catch {
    return false;
  }
}

export default async (request) => {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed.' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  if (!sameOrigin(request)) {
    return new Response(JSON.stringify({ error: 'Submission must come from this form.' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  let form;
  try {
    form = await request.formData();
  } catch {
    return new Response(JSON.stringify({ error: 'The submission could not be read.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const applicant = String(form.get('applicant') || '').trim();
  const email = String(form.get('email') || '').trim();
  const reference = String(form.get('ref') || '').trim();
    const pdfEntry = form.get('mandate_pdf');
    const pdf = pdfEntry instanceof File
      ? { name: pdfEntry.name, buffer: Buffer.from(await pdfEntry.arrayBuffer()) }
      : null;

    if (!pdf || fileKind(pdf) !== 'application/pdf') {
    return new Response(JSON.stringify({ error: 'A valid generated PDF is required.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  if (!hasVisiblePdfContent(pdf.buffer)) {
    return new Response(JSON.stringify({ error: 'The generated PDF is blank. Please retry the submission.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  if (!applicant || applicant.length > 160) {
    return new Response(JSON.stringify({ error: 'Applicant name is missing or too long.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  if (!/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/.test(email) || email.length > 254) {
    return new Response(JSON.stringify({ error: 'A valid applicant email address is required.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  if (!/^[\w-]{1,40}$/.test(reference)) {
    return new Response(JSON.stringify({ error: 'The application reference is invalid.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const uploadedFiles = [];
  for (const field of documentFields) {
      const entry = form.get(field);
      if (entry instanceof File && entry.size > 0) {
        uploadedFiles.push({ field, file: { name: entry.name, buffer: Buffer.from(await entry.arrayBuffer()) } });
      }
    }
  const allFiles = [{ field: 'mandate_pdf', file: pdf }, ...uploadedFiles];
  const totalSize = allFiles.reduce((total, entry) => total + entry.file.size, 0);
  if (totalSize > maxSubmissionSize) {
    return new Response(JSON.stringify({ error: 'Attachments exceed the 18 MB total limit. Reduce the file sizes and try again.' }), {
      status: 413,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  for (const { file } of uploadedFiles) {
    if (file.size > maxFileSize || !fileKind(file)) {
      return new Response(JSON.stringify({ error: 'Uploaded documents must be valid JPG, PNG, or PDF files no larger than 5 MB.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  const attachments = [];
    for (const { field, file } of allFiles) {
      attachments.push({
        filename: field === 'mandate_pdf'
          ? `Mandate-${reference}-${safeFilename(applicant, 'Applicant').replace(/\s+/g, '_')}.pdf`
          : `${field}-${safeFilename(file.name, 'document')}`,
        content: file.buffer,
        contentType: fileKind(file),
        contentDisposition: 'attachment'
      });
    }

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
    return new Response(JSON.stringify({ message: 'Your application was submitted successfully.' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Mandate email delivery failed:', error);
    return new Response(JSON.stringify({ error: 'The email could not be sent. Please try again later or contact support.' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' }
    });
  } finally {
    transporter.close();
  }
};