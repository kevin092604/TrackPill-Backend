const nodemailer = require('nodemailer');

let transporter;

async function sendEmailVerificationCode(email, code) {
  if (!isSmtpConfigured()) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('El servicio de correos no esta configurado.');
    }

    console.info(`[email-verification] Codigo para ${email}: ${code}`);
    return {
      accepted: [email],
      devMode: true,
    };
  }

  const mailer = getTransporter();

  return mailer.sendMail({
    from: process.env.SMTP_FROM || 'TrackPill <no-reply@trackpill.local>',
    subject: 'Codigo de verificacion de TrackPill',
    text: buildVerificationText(code),
    to: email,
  });
}

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      auth: process.env.SMTP_USER
        ? {
            pass: process.env.SMTP_PASS,
            user: process.env.SMTP_USER,
          }
        : undefined,
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: String(process.env.SMTP_SECURE || '').toLowerCase() === 'true',
    });
  }

  return transporter;
}

function isSmtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_PORT);
}

function buildVerificationText(code) {
  return [
    'Hola,',
    '',
    `Tu codigo de verificacion de TrackPill es: ${code}`,
    '',
    'Este codigo expira en 10 minutos. Si no solicitaste esta cuenta, ignora este correo.',
  ].join('\n');
}

module.exports = {
  sendEmailVerificationCode,
};
