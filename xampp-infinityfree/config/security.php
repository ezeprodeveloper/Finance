<?php
declare(strict_types=1);

function hashSecret(string $secret): string {
    return password_hash($secret, PASSWORD_DEFAULT);
}

function verifySecret(string $secret, string $storedHash): bool {
    if ($storedHash === '') {
        return false;
    }
    return password_verify($secret, $storedHash);
}

function constantTimeEqual(string $a, string $b): bool {
    return hash_equals($a, $b);
}

function generateSessionToken(): string {
    return bin2hex(random_bytes(32));
}

function generateSafeId(string $prefix): string {
    return $prefix . '-' . (string)round(microtime(true) * 1000) . '-' . bin2hex(random_bytes(3));
}

function generateReference(string $prefix): string {
    return $prefix . '-' . (string)random_int(100000, 999999);
}

function generateAccountNumber(): string {
    $part1 = random_int(1000, 9999);
    $part2 = random_int(1000, 9999);
    return 'EF-RW-' . $part1 . '-' . $part2;
}

function generateReferralCode(string $firstName): string {
    $letters = preg_replace('/[^a-zA-Z]/', '', $firstName) ?? '';
    $prefix = strtoupper(substr($letters, 0, 3));
    if ($prefix === '') {
        $prefix = 'EFR';
    }
    return $prefix . (string)random_int(1000, 9999);
}

function isValidRwandaPhone(string $phone): bool {
    $clean = preg_replace('/[\s\-]/', '', $phone) ?? '';
    return (bool)preg_match('/^(\+?250|0)?7[2389]\d{7}$/', $clean);
}

function getRwandaPhoneVariants(string $phone): array {
    $clean = preg_replace('/[\s\-]/', '', $phone) ?? '';
    if (preg_match('/^(?:\+?250|0)?(7[2389]\d{7})$/', $clean, $matches)) {
        $core9 = $matches[1];
        return ['0' . $core9, '+250' . $core9, '250' . $core9, $core9];
    }
    return $clean !== '' ? [$clean] : [];
}

function isValidRwandaId(string $idNumber): bool {
    $clean = preg_replace('/\s+/', '', $idNumber) ?? '';
    return (bool)preg_match('/^\d{16}$/', $clean);
}

function isSafeHttpUrl(string $raw): bool {
    $trimmed = trim($raw);
    if ($trimmed === '' || !filter_var($trimmed, FILTER_VALIDATE_URL)) {
        return false;
    }
    $scheme = strtolower((string)parse_url($trimmed, PHP_URL_SCHEME));
    return $scheme === 'http' || $scheme === 'https';
}

function isSafeMediaOrHttpUrl(string $raw): bool {
    $trimmed = trim($raw);
    if ($trimmed === '') {
        return false;
    }
    if (strpos($trimmed, 'data:video/') === 0 || strpos($trimmed, 'data:image/') === 0) {
        return true;
    }
    return isSafeHttpUrl($trimmed);
}

function utcIsoNow(): string {
    return (new DateTimeImmutable('now', new DateTimeZone('UTC')))->format('Y-m-d\TH:i:s.000\Z');
}

function utcIsoFromTimestamp(int $unixSeconds): string {
    return (new DateTimeImmutable('@' . $unixSeconds))
        ->setTimezone(new DateTimeZone('UTC'))
        ->format('Y-m-d\TH:i:s.000\Z');
}
