# Lynchpin Global mandate form

The form sends the generated PDF and selected supporting documents through a server-side SMTP connection. SMTP credentials are never sent to the browser.

## Run locally

1. Install Node.js 20 or later.
2. Run `npm install`.
3. Copy `.env.example` to `.env` and set the SMTP host, port, username, password, verified sender, and destination address. Port 587 uses required STARTTLS by default; use port 465 with `SMTP_SECURE=true` for implicit TLS.
4. Run `npm start` and open `http://localhost:3000`.

Do not open the HTML file directly with `file://`; the form needs the same-origin submission endpoint.

## Deploy to Netlify

The submission endpoint is a Netlify Function at `netlify/functions/submit.mjs`, exposed at `/.netlify/functions/submit`. Deploy the repository to Netlify as a static site (no build command, publish directory empty or `/`), then:

1. In **Site configuration → Environment variables**, add the SMTP values from `.env.example` (`SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_REQUIRE_TLS`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `MAIL_TO`). Never commit `.env`.
2. Redeploy. The form posts to `/.netlify/functions/submit`, which validates the uploads and emails them via SMTP.
3. Check **Logs → Functions** for submission errors.

The endpoint accepts the generated PDF and up to eight JPG, PNG, or PDF supporting documents. Individual files are limited to 5 MB and each submission is limited to 18 MB total. Files are held in memory only while being sent and are not written to disk.
