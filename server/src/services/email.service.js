import { ServiceUnavailableError } from '../utils/errors.js';

const MAILGUN_API_BASES = {
  US: 'https://api.mailgun.net',
  EU: 'https://api.eu.mailgun.net',
};

function getFrontendUrl() {
  return (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
}

function getMailgunConfig() {
  const apiKey = process.env.MAILGUN_API_KEY;
  const domain = process.env.MAILGUN_DOMAIN;
  const from = process.env.MAILGUN_FROM || (domain ? `Prode Mundial <no-reply@${domain}>` : null);
  const region = (process.env.MAILGUN_REGION || 'US').toUpperCase();
  const apiBase = MAILGUN_API_BASES[region] || MAILGUN_API_BASES.US;

  return { apiKey, domain, from, apiBase };
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function renderLayout({ title, intro, buttonLabel, buttonUrl, footer }) {
  const safeTitle = escapeHtml(title);
  const safeIntro = escapeHtml(intro);
  const safeButtonLabel = escapeHtml(buttonLabel);
  const safeButtonUrl = escapeHtml(buttonUrl);
  const safeFooter = escapeHtml(footer);

  return `
    <div style="margin:0;padding:0;background:#0b1020;font-family:Arial,Helvetica,sans-serif;color:#ffffff;">
      <div style="max-width:560px;margin:0 auto;padding:32px 18px;">
        <div style="background:#111827;border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:28px;">
          <div style="font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:#a5b4fc;font-weight:700;margin-bottom:14px;">
            Prode Mundial
          </div>
          <h1 style="font-size:24px;line-height:1.25;margin:0 0 14px;color:#ffffff;">${safeTitle}</h1>
          <p style="font-size:15px;line-height:1.6;margin:0 0 24px;color:#d1d5db;">${safeIntro}</p>
          <a href="${safeButtonUrl}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;font-weight:700;border-radius:12px;padding:13px 18px;">
            ${safeButtonLabel}
          </a>
          <p style="font-size:12px;line-height:1.5;margin:24px 0 0;color:#9ca3af;">
            Si el boton no funciona, copia este link en tu navegador:<br>
            <span style="word-break:break-all;color:#c7d2fe;">${safeButtonUrl}</span>
          </p>
        </div>
        <p style="font-size:12px;line-height:1.5;color:#6b7280;margin:18px 4px 0;">${safeFooter}</p>
      </div>
    </div>
  `;
}

async function sendMail({ to, subject, text, html, tag }) {
  const { apiKey, domain, from, apiBase } = getMailgunConfig();

  if (!apiKey || !domain || !from) {
    if (process.env.NODE_ENV === 'production') {
      throw new ServiceUnavailableError('Mailgun no esta configurado para enviar emails transaccionales.');
    }
    console.warn(`[Mailgun] Email no enviado (${tag || subject}): faltan MAILGUN_API_KEY, MAILGUN_DOMAIN o MAILGUN_FROM.`);
    return { skipped: true };
  }

  const form = new FormData();
  form.append('from', from);
  form.append('to', to);
  form.append('subject', subject);
  form.append('text', text);
  form.append('html', html);
  form.append('o:tracking', 'no');
  if (tag) form.append('o:tag', tag);

  const auth = Buffer.from(`api:${apiKey}`).toString('base64');
  const res = await fetch(`${apiBase}/v3/${domain}/messages`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}` },
    body: form,
  });

  const body = await res.text();
  if (!res.ok) {
    console.error(`[Mailgun] Error ${res.status}: ${body}`);
    throw new ServiceUnavailableError('No pudimos enviar el email en este momento.');
  }

  try {
    return JSON.parse(body);
  } catch {
    return { message: body };
  }
}

export async function sendVerificationEmail({ to, displayName, token }) {
  const url = `${getFrontendUrl()}/verify-email?token=${encodeURIComponent(token)}`;
  const subject = 'Verifica tu email en Prode Mundial';
  const intro = `Hola ${displayName || ''}. Confirma tu email para activar tu cuenta y empezar a participar del prode.`;

  return sendMail({
    to,
    subject,
    tag: 'email-verification',
    text: `${intro}\n\nVerificar email: ${url}\n\nEste link vence en 24 horas.`,
    html: renderLayout({
      title: 'Verifica tu email',
      intro,
      buttonLabel: 'Verificar email',
      buttonUrl: url,
      footer: 'Este link vence en 24 horas. Si no creaste una cuenta, podes ignorar este mensaje.',
    }),
  });
}

export async function sendPasswordResetEmail({ to, displayName, token }) {
  const url = `${getFrontendUrl()}/reset-password?token=${encodeURIComponent(token)}`;
  const subject = 'Restablece tu contrasena de Prode Mundial';
  const intro = `Hola ${displayName || ''}. Recibimos un pedido para restablecer tu contrasena.`;

  return sendMail({
    to,
    subject,
    tag: 'password-reset',
    text: `${intro}\n\nRestablecer contrasena: ${url}\n\nEste link vence en 1 hora.`,
    html: renderLayout({
      title: 'Restablece tu contrasena',
      intro,
      buttonLabel: 'Crear nueva contrasena',
      buttonUrl: url,
      footer: 'Este link vence en 1 hora. Si no pediste este cambio, podes ignorar este mensaje.',
    }),
  });
}
