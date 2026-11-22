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

export function generateReferralCode(firstName: string): string {
  const clean = firstName.replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 3) || 'RW';
  const rand = Math.floor(100 + Math.random() * 900);
  return `EF-${clean}${rand}`;
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

export function buildUssdFullCode(merchantCode: string, amountRwf: number): string {
  const cleanAmount = Math.max(1, Math.round(amountRwf));
  return `*182*8*1*${merchantCode}*${cleanAmount}#`;
}

export function buildUssdTelHref(merchantCode: string, amountRwf: number): string {
  const cleanAmount = Math.max(1, Math.round(amountRwf));
  return `tel:*182*8*1*${encodeURIComponent(merchantCode)}*${cleanAmount}%23`;
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

function sha256Fallback(ascii: string): string {
  const rightRotate = (value: number, amount: number) =>
    (value >>> amount) | (value << (32 - amount));

  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let result = '';
  const words: number[] = [];
  const asciiBitLength = ascii.length * 8;

  const hash: number[] = [];
  const k: number[] = [];
  let primeCounter = 0;

  const isComposite: Record<number, number> = {};
  for (let candidate = 2; primeCounter < 64; candidate += 1) {
    if (!isComposite[candidate]) {
      for (let i = 0; i < 313; i += candidate) {
        isComposite[i] = candidate;
      }
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
      primeCounter += 1;
    }
  }

  let msg = `${ascii}\x80`;
  while ((msg.length % 64) - 56) msg += '\x00';
  for (let i = 0; i < msg.length; i += 1) {
    const j = msg.charCodeAt(i);
    if (j >> 8) return '';
    words[i >> 2] |= j << (((3 - i) % 4) * 8);
  }
  words[words.length] = (asciiBitLength / maxWord) | 0;
  words[words.length] = asciiBitLength;

  for (let j = 0; j < words.length; ) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash.slice(0);

    for (let i = 0; i < 64; i += 1) {
      const w15 = w[i - 15];
      const w2 = w[i - 2];

      const a = hash[0];
      const e = hash[4];
      const temp1 =
        hash[7] +
        (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) +
        ((e & hash[5]) ^ (~e & hash[6])) +
        k[i] +
        (w[i] =
          i < 16
            ? w[i]
            : (w[i - 16] +
                (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
                w[i - 7] +
                (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) |
              0);
      const temp2 =
        (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) +
        ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));

      hash.unshift((temp1 + temp2) | 0);
      hash[4] = (hash[4] + temp1) | 0;
      hash.pop();
    }

    for (let i = 0; i < 8; i += 1) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }

  for (let i = 0; i < 8; i += 1) {
    for (let j = 3; j + 1; j -= 1) {
      const b = (hash[i] >> (j * 8)) & 255;
      result += (b < 16 ? '0' : '') + b.toString(16);
    }
  }
  return result;
}

export async function hashPassword(password: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoded = new TextEncoder().encode(password);
    const digest = await crypto.subtle.digest('SHA-256', encoded);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  const utf8 = unescape(encodeURIComponent(password));
  return sha256Fallback(utf8);
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
