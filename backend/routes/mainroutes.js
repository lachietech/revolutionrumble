import { Router } from 'express';
import crypto from 'crypto';
import { hashOtp, validateOtp } from '../utils/otp.js';
import { regenerateSession, saveSession, destroySession } from '../utils/session.js';
import AdminSession from '../models/AdminSession.js';
import {
    pageViewLimiter,
    otpRequestLimiter,
    otpVerifyLimiter
} from '../middleware/ratelimiters.js';
import { 
    getResendClient 
} from '../middleware/resend.js';
import { 
    getAllowedAdminEmails,
    requireAdmin
} from '../middleware/auth.js';

const router = Router();

// Home page
router.get('/', pageViewLimiter, (req, res) => {
    return res.sendFile('index.html');
});

router.get('/register', pageViewLimiter, (req, res) => {
    return res.sendFile('register.html');
});

router.get('/player-stats', pageViewLimiter, (req, res) => {
    return res.sendFile('bowlerstats.html');
});

router.get('/playerstats', pageViewLimiter, (req, res) => {
    return res.redirect(301, '/player-stats');
});

router.get('/bowlerstats', pageViewLimiter, (req, res) => {
    return res.redirect(301, '/player-stats');
});

router.get('/bowler-hub', pageViewLimiter, (req, res) => {
    return res.sendFile('bowler-hub.html');
});

router.get('/results', pageViewLimiter, (req, res) => {
    if (req.query.tab === 'stats') {
        return res.redirect(301, '/player-stats');
    }
    return res.sendFile('results.html');
});

router.get('/events', pageViewLimiter, (req, res) => {
    return res.sendFile('events.html');
});

router.get('/squads', pageViewLimiter, (req, res) => {
    return res.sendFile('squads.html');
});

// Admin login page
router.get('/admin', pageViewLimiter, (req, res) => {
    return res.redirect('/admin/login');
});
router.get('/admin/login', pageViewLimiter, (req, res) => {
    return res.sendFile('admin-login.html');
});

// Get CSRF token (public endpoint)
router.get('/api/csrf-token', pageViewLimiter, async (req, res) => {
    const token = typeof req.csrfToken === 'function' ? req.csrfToken() : '';
    return res.send({ csrfToken: token || '' });
});

// Get available admin email options (no email shown for security)
router.get('/admin/email-options', otpVerifyLimiter, async (req, res) => {
    const allowedEmails = getAllowedAdminEmails();
    const options = allowedEmails.map((email, index) => {
        return { id: index, label: `Admin ${index + 1}` };
    });
    const csrfToken = typeof req.csrfToken === 'function' ? req.csrfToken() : '';
    return res.send({ options, csrfToken: csrfToken || '' });
});

// Request admin OTP
router.post('/admin/request-otp', otpRequestLimiter, async (req, res) => {
    try {
        const { emailIndex } = req.body;
        if (emailIndex === undefined) {
            return res.status(400).send({ error: 'Email selection required' });
        }

        const allowedEmails = getAllowedAdminEmails();
        const email = Number.isInteger(emailIndex) && emailIndex >= 0 ? allowedEmails[emailIndex] : null;
        
        if (!email) {
            return res.status(400).send({ error: 'Invalid email selection' });
        }

        // Generate 6-digit OTP
        const otpCode = crypto.randomInt(100000, 1000000).toString();
        const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        // Create or update admin session
        await AdminSession.findOneAndUpdate(
            { email: email },
            {
                email: email,
                otpCode: hashOtp(otpCode),
                otpExpires,
                otpAttempts: 0,
                createdAt: new Date()
            },
            { upsert: true, new: true }
        );

        // Send OTP via Resend
        const resendClient = getResendClient();
        const delivery = await resendClient.emails.send({
            from: 'Revolution Rumble Admin <rradmin@nielseninnovations.com>',
            to: email,
            subject: 'Your Admin Login Code',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #dc2626;">Revolution Rumble Admin Portal</h2>
                    <p>Your admin login code is:</p>
                    <div style="background: #fee2e2; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 8px; margin: 20px 0; color: #991b1b;">
                        ${otpCode}
                    </div>
                    <p style="color: #6b7280;">This code will expire in 10 minutes.</p>
                    <p style="color: #dc2626; font-weight: 600;">⚠️ This is an admin login code. Do not share it with anyone.</p>
                </div>
            `
        });

        if (delivery.error) throw new Error('OTP delivery failed');
        return res.send({ success: true, message: 'OTP sent to email' });
    } catch (error) {
        console.error('Admin OTP request error:', error);
        return res.status(500).send({ error: 'Failed to send OTP' });
    }
});

// Verify admin OTP
router.post('/admin/verify-otp', otpVerifyLimiter, async (req, res) => {
    try {
        const { emailIndex, otp } = req.body;
        const sanitizedOtp = validateOtp(otp);
        if (!Number.isInteger(emailIndex) || emailIndex < 0 || !sanitizedOtp) {
            return res.status(400).send({ error: 'Email selection and OTP required' });
        }

        const allowedEmails = getAllowedAdminEmails();
        const email = allowedEmails[emailIndex];
        
        if (!email) {
            return res.status(400).send({ error: 'Invalid email selection' });
        }

        // Find admin session
        const session = await AdminSession.findOneAndUpdate(
            { email, otpExpires: { $gt: new Date() }, otpAttempts: { $lt: 5 } },
            { $inc: { otpAttempts: 1 } },
            { new: true }
        );
        if (!session) {
            return res.status(401).send({ error: 'No OTP found. Please request a new code.' });
        }

        if (session.otpCode !== hashOtp(sanitizedOtp)) {
            return res.status(401).send({
                error: 'Invalid OTP',
                attemptsRemaining: 5 - session.otpAttempts
            });
        }

        // Success - delete session and create admin session
        const consumed = await AdminSession.findOneAndDelete({
            _id: session._id, otpCode: session.otpCode, otpExpires: { $gt: new Date() }
        });
        if (!consumed) return res.status(401).send({ error: 'OTP already used or expired' });
        await regenerateSession(req);
        req.session.isAdmin = true;
        req.session.adminEmail = email;

        try {
            await saveSession(req);
            return res.send({ success: true, redirect: '/admin/tournaments' });
        } catch (err) {
            console.error('Session save error:', err);
            return res.status(500).send({ error: 'Failed to create session' });
        }
    } catch (error) {
        console.error('Admin OTP verification error:', error);
        return res.status(500).send({ error: 'Failed to verify OTP' });
    }
});

// Admin logout
router.post('/admin/logout', otpVerifyLimiter, async (req, res, next) => {
    try {
        await destroySession(req);
        res.clearCookie('connect.sid');
        return res.redirect('/');
    } catch (error) { next(error); }
});

// Admin sub-pages (protected)
router.get('/admin/tournaments', pageViewLimiter, requireAdmin, (req, res) => {
    return res.sendFile('admin-tournaments.html');
});

router.get('/admin/registrations', pageViewLimiter, requireAdmin, (req, res) => {
    return res.sendFile('admin-registrations.html');
});

router.get('/admin/results', pageViewLimiter, requireAdmin, (req, res) => {
    return res.sendFile('admin-results.html');
});

router.get('/admin/email-templates', pageViewLimiter, requireAdmin, (req, res) => {
    return res.sendFile('admin/admin-email-templates.html');
});

export default router;
