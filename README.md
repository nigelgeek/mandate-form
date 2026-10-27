# Lynchpin Global mandate form

The form now sends the generated PDF and selected supporting documents through a server-side SMTP connection. SMTP credentials are never sent to the browser.

## Run locally

1. Install Node.js 20 or later.
2. Run `npm install`.
3. Copy `.env.example` to `.env` and set the SMTP host, port, username, password, verified sender, and destination address. Port 587 uses required STARTTLS by default; use port 465 with `SMTP_SECURE=true` for implicit TLS.
4. Run `npm start` and open `http://localhost:3000`.

Do not open the HTML file directly with `file://`; the form needs the same-origin `/api/submit` endpoint.

## Deploy

Deploy this directory as a Node.js service with `npm start`, configure the SMTP values as environment variables in the host, and serve it over HTTPS. Never commit `.env` or expose SMTP credentials in client-side code. If the host sits behind a trusted reverse proxy, set `TRUST_PROXY_HOPS` to the number of proxy hops so submission rate limiting uses the originating client IP.

If deploying with `index.zip`, rebuild it from the current project files and exclude `.env` and `node_modules`; the archive does not update automatically.

The endpoint accepts the generated PDF and up to eight JPG, PNG, or PDF supporting documents. Individual files are limited to 5 MB and each submission is limited to 18 MB total. Files are held in memory only while being sent and are not written to disk. Submissions are limited to five per client IP every 15 minutes.
