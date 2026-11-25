import crypto from 'node:crypto';

export function hashSecret(secret: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(secret, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifySecret(secret: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, originalHex] = parts;
  if (!salt || !originalHex) return false;
  try {
    const derived = crypto.scryptSync(secret, salt, 64);
    const original = Buffer.from(originalHex, 'hex');
    if (derived.length !== original.length) return false;
    return crypto.timingSafeEqual(derived, original);
  } catch {
    return false;
  }
}

export function constantTimeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function generateSafeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
}

export function generateReference(prefix: string): string {
  const rand = crypto.randomInt(100000, 999999);
  return `${prefix}-${rand}`;
}

export function generateAccountNumber(): string {
  const part1 = crypto.randomInt(1000, 9999);
  const part2 = crypto.randomInt(1000, 9999);
  return `EF-RW-${part1}-${part2}`;
}

export function generateReferralCode(firstName: string): string {
  const prefix = (firstName.replace(/[^a-zA-Z]/g, '').slice(0, 3) || 'EFR').toUpperCase();
  const suffix = crypto.randomInt(1000, 9999);
  return `${prefix}${suffix}`;
}

export function isValidRwandaPhone(phone: string): boolean {
  const clean = phone.replace(/[\s-]/g, '');
  return /^(\+?250|0)?7[2389]\d{7}$/.test(clean);
}

export function getRwandaPhoneVariants(phone: string): string[] {
  const clean = phone.replace(/[\s-]/g, '');
  const match = clean.match(/^(?:\+?250|0)?(7[2389]\d{7})$/);
  if (!match) return clean ? [clean] : [];
  const core9 = match[1];
  return [`0${core9}`, `+250${core9}`, `250${core9}`, core9];
}

export function isValidRwandaId(idNumber: string): boolean {
  const clean = idNumber.replace(/\s/g, '');
  return /^\d{16}$/.test(clean);
}

export function isSafeHttpUrl(raw: string): boolean {
  try {
    const parsed = new URL(raw.trim());
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function isSafeMediaOrHttpUrl(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('data:video/') || trimmed.startsWith('data:image/')) {
    return true;
  }
  return isSafeHttpUrl(trimmed);
}
