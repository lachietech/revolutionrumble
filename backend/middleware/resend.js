import express from 'express';
import { Resend } from 'resend';
import { strictWriteLimiter } from '../middleware/ratelimiters.js';

const router = express.Router();

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

// TEST ENDPOINT - Verify Resend is working
router.get('/test-email', strictWriteLimiter, async (req, res) => {
    try {
        const resendClient = getResendClient();
        const result = await resendClient.emails.send({
            from: 'Revolution Rumble <noreply@nielseninnovations.com>',
            to: req.query.email || 'test@example.com',
            subject: 'Test Email from Revolution Rumble',
            html: '<h1>Test Email</h1><p>If you receive this, Resend is working!</p>'
        });
        res.json({ success: true, result });
    } catch (error) {
        console.error('Test email failed:', error);
        res.status(500).json({ error: error.message, details: error });
    }
});

export default router;