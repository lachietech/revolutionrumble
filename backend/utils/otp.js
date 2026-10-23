import crypto from 'node:crypto';

export function hashOtp(code) {
    return crypto.createHash('sha256').update(code).digest('hex');
}

export function validateOtp(value) {
    return typeof value === 'string' && /^\d{6}$/.test(value.trim()) ? value.trim() : null;
}
