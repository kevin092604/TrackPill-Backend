const nodemailer = require('nodemailer');

let transporter;

async function sendEmailVerificationCode(email, code) {
  return sendCodeEmail({
    code,
    email,
    heading: 'Verifica tu correo',
    logLabel: 'email-verification',
    message: 'Usa este codigo para verificar tu cuenta de TrackPill.',
    subject: 'Codigo de verificacion de TrackPill',
  });
}

async function sendPasswordRecoveryCode(email, code) {
  return sendCodeEmail({
    code,
    email,
    heading: 'Recupera tu contrasena',
    logLabel: 'password-recovery',
    message: 'Usa este codigo para establecer una nueva contrasena en TrackPill.',
    subject: 'Recuperacion de contrasena de TrackPill',
  });
}

async function sendCodeEmail({ code, email, heading, logLabel, message, subject }) {
  if (!isSmtpConfigured()) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('El servicio de correos no esta configurado.');
    }

    console.info(`[${logLabel}] Codigo para ${email}: ${code}`);
    return {
      accepted: [email],
      devMode: true,
    };
  }

  return getTransporter().sendMail({
    from: getFromAddress(),
    html: buildCodeHtml({ code, heading, message }),
    subject,
    text: buildCodeText({ code, message }),
    to: email,
  });
}

function getTransporter() {
  if (!transporter) {
    const service = process.env.SMTP_SERVICE?.trim();
    const auth = getSmtpAuth();

    transporter = nodemailer.createTransport(
      service
        ? { auth, service }
        : {
            auth: auth.user ? auth : undefined,
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT || 587),
            secure: String(process.env.SMTP_SECURE || '').toLowerCase() === 'true',
          },
    );
  }

  return transporter;
}

function getSmtpAuth() {
  return {
    pass: process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS,
    user: process.env.GMAIL_USER || process.env.SMTP_USER,
  };
}

function getFromAddress() {
  const { user } = getSmtpAuth();
  return process.env.SMTP_FROM || `TrackPill <${user || 'no-reply@trackpill.local'}>`;
}

function isSmtpConfigured() {
  const service = process.env.SMTP_SERVICE?.trim();
  const auth = getSmtpAuth();

  if (service || process.env.GMAIL_USER || process.env.GMAIL_APP_PASSWORD) {
    return Boolean(auth.user && auth.pass);
  }

  return Boolean(process.env.SMTP_HOST && process.env.SMTP_PORT);
}

function buildCodeText({ code, message }) {
  return [
    'Hola,',
    '',
    message,
    '',
    `Codigo: ${code}`,
    '',
    'Este codigo es valido durante 10 minutos.',
    'Si no realizaste esta solicitud, ignora este correo.',
  ].join('\n');
}

function buildCodeHtml({ code, heading, message }) {
  return `
    <!doctype html>
    <html lang="es">
      <body style="margin:0;background:#f4f8fb;font-family:Arial,sans-serif;color:#522d59;">
        <div style="max-width:520px;margin:32px auto;padding:28px;background:#ffffff;border-radius:16px;border:1px solid #d9e7f2;">
          <h1 style="margin:0 0 16px;color:#3f8ccb;font-size:24px;">${heading}</h1>
          <p style="margin:0 0 20px;line-height:1.6;color:#5f5a5c;">${message}</p>
          <div style="margin:20px 0;padding:16px;border-radius:12px;background:#eef6fc;text-align:center;font-size:32px;font-weight:700;letter-spacing:8px;color:#522d59;">
            ${code}
          </div>
          <p style="margin:0 0 8px;line-height:1.6;color:#5f5a5c;">Este codigo es valido durante <strong>10 minutos</strong>.</p>
          <p style="margin:0;line-height:1.6;color:#8a8587;font-size:13px;">Si no realizaste esta solicitud, puedes ignorar este correo.</p>
        </div>
      </body>
    </html>
  `;
}

module.exports = {
  sendEmailVerificationCode,
  sendPasswordRecoveryCode,
};
