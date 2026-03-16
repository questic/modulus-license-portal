const RESEND_API = 'https://api.resend.com/emails';

function getFrom(): string {
  return Deno.env.get('RESEND_FROM') ?? 'noreply@resend.dev';
}

async function send(to: string, subject: string, html: string): Promise<void> {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) throw new Error('RESEND_API_KEY is not set');

  const res = await fetch(RESEND_API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: getFrom(), to, subject, html }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Resend error ${res.status}: ${text}`);
  }
}

export async function sendRequestConfirmation(name: string, email: string, machineId: string): Promise<void> {
  await send(
    email,
    'Ваша заявка на лицензию принята',
    `<p>Здравствуйте, ${esc(name)}!</p>
     <p>Ваша заявка принята. Мы рассмотрим её в ближайшее время и пришлём лицензионный ключ на этот адрес.</p>
     <p><b>Machine ID:</b> <code>${esc(machineId)}</code></p>`,
  );
}

export async function sendAdminNotification(
  adminEmail: string,
  name: string,
  email: string,
  machineId: string,
  adminUrl: string,
): Promise<void> {
  await send(
    adminEmail,
    `Новая заявка на лицензию — ${name}`,
    `<h2>Новая заявка на лицензию</h2>
     <table cellpadding="6">
       <tr><td><b>Имя:</b></td><td>${esc(name)}</td></tr>
       <tr><td><b>Email:</b></td><td>${esc(email)}</td></tr>
       <tr><td><b>Machine ID:</b></td><td><code>${esc(machineId)}</code></td></tr>
     </table>
     ${adminUrl ? `<p><a href="${esc(adminUrl)}">Открыть панель администратора →</a></p>` : ''}`,
  );
}

export async function sendLicenseEmail(
  email: string,
  name: string,
  machineId: string,
  licenseKey: string,
  expiresAt: string | null,
): Promise<void> {
  await send(
    email,
    'Ваша лицензия одобрена — ключ активации',
    `<p>Здравствуйте, ${esc(name)}!</p>
     <p>Скопируйте ключ ниже и вставьте его в приложение на экране активации:</p>
     <pre style="background:#f4f4f4;padding:16px;border-radius:4px;word-break:break-all;font-size:12px;font-family:monospace">${esc(licenseKey)}</pre>
     <p><b>Срок действия:</b> ${expiresAt ? esc(expiresAt) : 'бессрочная'}</p>
     <p><b>Machine ID:</b> <code>${esc(machineId)}</code></p>
     <hr>
     <p style="color:#888;font-size:12px">Ключ привязан к вашей машине и не может быть использован на другом устройстве.</p>`,
  );
}

export async function sendRejectionEmail(email: string, name: string): Promise<void> {
  await send(
    email,
    'Статус заявки на лицензию',
    `<p>Здравствуйте, ${esc(name)}!</p>
     <p>К сожалению, ваша заявка на лицензию была отклонена.</p>
     <p>Если у вас возникли вопросы, ответьте на это письмо.</p>`,
  );
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
