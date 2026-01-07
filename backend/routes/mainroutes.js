import express from 'express';
import path from 'path';
import AdminSession from '../models/AdminSession.js';
import { Resend } from 'resend';
import rateLimit from 'express-rate-limit';

const router = express.Router();

// Rate limiter for admin OTP verification
const verifyOtpLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // limit each IP to 10 verification requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false
});

// Initialize Resend client
let resend;
function getResendClient() {
    if (!resend) {
        if (!process.env.RESEND_API_KEY) {
            throw new Error('RESEND_API_KEY not configured');
        }
        resend = new Resend(process.env.RESEND_API_KEY);
    }
    return resend;
}

// Allowed admin emails (from environment variable)
function getAllowedAdminEmails() {
    const emails = process.env.ADMIN_EMAILS || '';
    return emails.split(',').map(e => e.trim().toLowerCase()).filter(e => e);
}

// simple admin-check middleware
function requireAdmin(req, res, next) {
    if (req.session && req.session.isAdmin) return next();
    return res.redirect('/admin/login');
}

// Home page
router.get('/', (req, res) => {
    res.sendFile(path.join(import.meta.dirname, '../../frontend/index.html'));
});

router.get('/register', (req, res) => {
    res.sendFile(path.join(import.meta.dirname, '../../frontend/register.html'));
});

router.get('/playerstats', (req, res) => {
    res.sendFile(path.join(import.meta.dirname, '../../frontend/bowlerstats.html'));
});

router.get('/bowlerstats', (req, res) => {
    res.sendFile(path.join(import.meta.dirname, '../../frontend/bowlerstats.html'));
});

router.get('/bowler-hub', (req, res) => {
    res.sendFile(path.join(import.meta.dirname, '../../frontend/bowler-hub.html'));
});

router.get('/results', (req, res) => {
    res.sendFile(path.join(import.meta.dirname, '../../frontend/results.html'));
});

router.get('/events', (req, res) => {
    res.sendFile(path.join(import.meta.dirname, '../../frontend/events.html'));
});

router.get('/squads', (req, res) => {
    res.sendFile(path.join(import.meta.dirname, '../../frontend/squads.html'));
});

// Admin login page
router.get('/admin', (req, res) => {
    res.redirect('/admin/login');
});
router.get('/admin/login', (req, res) => {
    res.sendFile(path.join(import.meta.dirname, '../../frontend/admin-login.html'));
});

// Get available admin email options (no email shown for security)
router.get('/admin/email-options', (req, res) => {
    const allowedEmails = getAllowedAdminEmails();
    const options = allowedEmails.map((email, index) => {
        return { id: index, label: `Admin ${index + 1}` };
    });
    res.json(options);
});

// Request admin OTP
router.post('/admin/request-otp', verifyOtpLimiter, async (req, res) => {
    try {
        const { emailIndex } = req.body;
        if (emailIndex === undefined) {
            return res.status(400).json({ error: 'Email selection required' });
        }

        const allowedEmails = getAllowedAdminEmails();
        const email = allowedEmails[emailIndex];
        
        if (!email) {
            return res.status(400).json({ error: 'Invalid email selection' });
        }

        // Generate 6-digit OTP
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        // Create or update admin session
        await AdminSession.findOneAndUpdate(
            { email: email },
            {
                email: email,
                otpCode,
                otpExpires,
                otpAttempts: 0
            },
            { upsert: true, new: true }
        );

        // Send OTP via Resend
        const resendClient = getResendClient();
        await resendClient.emails.send({
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

        res.json({ success: true, message: 'OTP sent to email' });
    } catch (error) {
        console.error('Admin OTP request error:', error);
        res.status(500).json({ error: 'Failed to send OTP' });
    }
});

// Verify admin OTP
router.post('/admin/verify-otp', verifyOtpLimiter, async (req, res) => {
    try {
        const { emailIndex, otp } = req.body;
        if (emailIndex === undefined || !otp) {
            return res.status(400).json({ error: 'Email selection and OTP required' });
        }

        const allowedEmails = getAllowedAdminEmails();
        const email = allowedEmails[emailIndex];
        
        if (!email) {
            return res.status(400).json({ error: 'Invalid email selection' });
        }

        // Find admin session
        const session = await AdminSession.findOne({ email: email });
        if (!session) {
            return res.status(401).json({ error: 'No OTP found. Please request a new code.' });
        }

        // Check if OTP has expired
        if (new Date() > session.otpExpires) {
            await AdminSession.deleteOne({ _id: session._id });
            return res.status(401).json({ error: 'OTP expired. Please request a new code.' });
        }

        // Check attempt limit
        if (session.otpAttempts >= 5) {
            await AdminSession.deleteOne({ _id: session._id });
            return res.status(429).json({ error: 'Too many failed attempts. Please request a new code.' });
        }

        // Verify OTP
        if (session.otpCode !== otp.trim()) {
            session.otpAttempts += 1;
            await session.save();
            return res.status(401).json({ 
                error: 'Invalid OTP', 
                attemptsRemaining: 5 - session.otpAttempts 
            });
        }

        // Success - delete session and create admin session
        await AdminSession.deleteOne({ _id: session._id });
        req.session.isAdmin = true;
        req.session.adminEmail = email;

        res.json({ success: true, redirect: '/admin/tournaments' });
    } catch (error) {
        console.error('Admin OTP verification error:', error);
        res.status(500).json({ error: 'Failed to verify OTP' });
    }
});

// Admin logout
router.get('/admin/logout', verifyOtpLimiter, (req, res) => {
    req.session.isAdmin = false;
    req.session.destroy?.(() => res.redirect('/'));
});

// Admin sub-pages (protected)
router.get('/admin/tournaments', verifyOtpLimiter, requireAdmin, (req, res) => {
    res.sendFile(path.join(import.meta.dirname, '../../frontend/admin-tournaments.html'));
});

router.get('/admin/registrations', verifyOtpLimiter, requireAdmin, (req, res) => {
    res.sendFile(path.join(import.meta.dirname, '../../frontend/admin-registrations.html'));
});

router.get('/admin/results', verifyOtpLimiter, requireAdmin, (req, res) => {
    res.sendFile(path.join(import.meta.dirname, '../../frontend/admin-results.html'));
});

export default router;