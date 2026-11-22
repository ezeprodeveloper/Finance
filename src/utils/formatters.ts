export function formatRwf(amount: number): string {
  const safe = Number.isFinite(amount) ? Math.round(amount) : 0;
  return `${safe.toLocaleString('en-US')} RWF`;
}

export function formatShortDate(isoDate: string): string {
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) {
    return isoDate;
  }
  return parsed.toLocaleDateString('en-RW', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(isoDate: string): string {
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) {
    return isoDate;
  }
  return parsed.toLocaleString('en-RW', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / Math.pow(1024, index);
  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export function generateReference(prefix = 'EFN'): string {
  const randomPart = Math.floor(100000 + Math.random() * 900000);
  return `${prefix}-${randomPart}`;
}

export function generateAccountNumber(): string {
  const part = Math.floor(100000 + Math.random() * 900000);
  return `EF-RW-${part}`;
}

export function todayRwandaDateKey(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Kigali',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function buildMomoPayCode(baseCode: string, amountRwf: number): string {
  const cleanAmount = Math.max(1, Math.round(amountRwf));
  return `${baseCode}*${cleanAmount}#`;
}

export function isValidRwandaPhone(phone: string): boolean {
  const cleaned = phone.replace(/[\s-]/g, '');
  return /^(\+?250)?0?7[2389]\d{7}$/.test(cleaned);
}

export function isValidRwandaId(idNumber: string): boolean {
  const digits = idNumber.replace(/\s/g, '');
  return /^\d{16}$/.test(digits);
}

export function detectMobileCarrier(phone: string): 'MTN Mobile Money' | 'Airtel Money' | null {
  const digits = phone.replace(/\D/g, '');
  const local = digits.startsWith('250') ? `0${digits.slice(3)}` : digits;
  if (/^07[89]/.test(local)) return 'MTN Mobile Money';
  if (/^07[23]/.test(local)) return 'Airtel Money';
  return null;
}

export async function hashPassword(password: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoded = new TextEncoder().encode(password);
    const digest = await crypto.subtle.digest('SHA-256', encoded);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  // Deterministic fallback for restricted non-secure contexts
  let hash = 0;
  for (let i = 0; i < password.length; i += 1) {
    hash = (hash << 5) - hash + password.charCodeAt(i);
    hash |= 0;
  }
  return `ef_${Math.abs(hash).toString(16)}`;
}

export function readFileAsDataUrl(file: File, maxSizeMb = 4): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.size > maxSizeMb * 1024 * 1024) {
      reject(new Error(`File exceeds ${maxSizeMb} MB limit.`));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Could not read file.'));
      }
    };
    reader.onerror = () => reject(new Error('File reading failed.'));
    reader.readAsDataURL(file);
  });
}
