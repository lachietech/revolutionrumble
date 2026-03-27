import { Resend } from 'resend';

// Initialize Resend client (lazy initialization to ensure env vars are loaded)
let resend;
export function getResendClient() {
    if (!resend) {
        if (!process.env.RESEND_API_KEY) {
            throw new Error('RESEND_API_KEY not configured');
        }
        resend = new Resend(process.env.RESEND_API_KEY);
    }
    return resend;
}

