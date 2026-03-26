export function getClientIp(req: Request): string | null {
  const headersToCheck = ['cf-connecting-ip', 'x-real-ip', 'x-forwarded-for'];

  for (const header of headersToCheck) {
    const value = req.headers.get(header)?.trim();
    if (!value) continue;

    const ip = value.split(',')[0]?.trim();
    if (ip) return ip;
  }

  return null;
}

export function normalizeMachineId(machineId: string): string {
  return machineId.trim();
}

export function isValidMachineId(machineId: string): boolean {
  const normalized = normalizeMachineId(machineId);
  return normalized.length >= 16 && normalized.length <= 128;
}

export async function verifyTurnstileToken(
  req: Request,
  token: string | null | undefined,
): Promise<boolean> {
  const secret = Deno.env.get('TURNSTILE_SECRET_KEY')?.trim();
  if (!secret) return true;
  if (!token) return false;

  const ip = getClientIp(req) ?? undefined;
  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      secret,
      response: token,
      ...(ip ? { remoteip: ip } : {}),
    }),
  });

  if (!response.ok) return false;

  const payload = await response.json();
  return payload.success === true;
}
