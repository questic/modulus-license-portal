export interface LicenseData {
  machineId: string;
  licensee: string;
  issuedAt: string;
  expiresAt: string | null;
  features: string[];
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s/g, '');
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function uint8ToBase64(arr: Uint8Array): string {
  let binary = '';
  const chunk = 8192;
  for (let i = 0; i < arr.length; i += chunk) {
    binary += String.fromCharCode(...arr.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export async function generateLicenseKey(licenseData: LicenseData): Promise<string> {
  const privateKeyPem = Deno.env.get('LICENSE_PRIVATE_KEY');
  if (!privateKeyPem) throw new Error('LICENSE_PRIVATE_KEY is not set');

  const keyBuffer = pemToArrayBuffer(privateKeyPem);

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    keyBuffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const payload = new TextEncoder().encode(JSON.stringify(licenseData));
  const signatureBuffer = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, payload);
  const signature = uint8ToBase64(new Uint8Array(signatureBuffer));

  const jsonBytes = new TextEncoder().encode(JSON.stringify({ data: licenseData, signature }));
  return uint8ToBase64(jsonBytes);
}
