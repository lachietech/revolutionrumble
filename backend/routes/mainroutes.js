import path from 'path';
import AdminSession from '../models/AdminSession.js';
import {
    pageViewLimiter,
    otpVerifyLimiter
} from '../middleware/ratelimiters.js';
import { 
    getResendClient 
} from '../middleware/resend.js';
import { 
    getAllowedAdminEmails,
    requireAdmin
} from '../middleware/auth.js';

async function mainroutes(fastify, options) {

// Home page
fastify.get('/', { config: { rateLimit: pageViewLimiter } }, (req, res) => {
    return res.sendFile('index.html');
});

fastify.get('/register', { config: { rateLimit: pageViewLimiter } }, (req, res) => {
    return res.sendFile('register.html');
});

fastify.get('/playerstats', { config: { rateLimit: pageViewLimiter } }, (req, res) => {
    return res.redirect('/results?tab=stats');
});

fastify.get('/bowlerstats', { config: { rateLimit: pageViewLimiter } }, (req, res) => {
    return res.redirect('/results?tab=stats');
});

fastify.get('/bowler-hub', { config: { rateLimit: pageViewLimiter } }, (req, res) => {
    return res.sendFile('bowler-hub.html');
});

fastify.get('/results', { config: { rateLimit: pageViewLimiter } }, (req, res) => {
    return res.sendFile('results.html');
});

fastify.get('/events', { config: { rateLimit: pageViewLimiter } }, (req, res) => {
    return res.sendFile('events.html');
});

fastify.get('/squads', { config: { rateLimit: pageViewLimiter } }, (req, res) => {
    return res.sendFile('squads.html');
});

// Admin login page
fastify.get('/admin', { config: { rateLimit: pageViewLimiter } }, (req, res) => {
    return res.redirect('/admin/login');
});
fastify.get('/admin/login', { config: { rateLimit: pageViewLimiter } }, (req, res) => {
    return res.sendFile('admin-login.html');
});

// Get CSRF token (public endpoint)
fastify.get('/api/csrf-token', { config: { rateLimit: pageViewLimiter } }, async (req, res) => {
    const token = await res.generateCsrf();
    console.log('CSRF token request - token available:', !!token);
    return res.send({ csrfToken: token || '' });
});

// Get available admin email options (no email shown for security)
fastify.get('/admin/email-options', { config: { rateLimit: otpVerifyLimiter } }, async (req, res) => {
    const allowedEmails = getAllowedAdminEmails();
    const options = allowedEmails.map((email, index) => {
        return { id: index, label: `Admin ${index + 1}` };
    });
    const csrfToken = await res.generateCsrf();
    return res.send({ options, csrfToken: csrfToken || '' });
});

// Request admin OTP
fastify.post('/admin/request-otp', { config: { rateLimit: otpVerifyLimiter } }, async (req, res) => {
    try {
        const { emailIndex } = req.body;
        if (emailIndex === undefined) {
            return res.status(400).send({ error: 'Email selection required' });
        }

        const allowedEmails = getAllowedAdminEmails();
        const email = allowedEmails[emailIndex];
        
        if (!email) {
            return res.status(400).send({ error: 'Invalid email selection' });
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

        return res.send({ success: true, message: 'OTP sent to email' });
    } catch (error) {
        console.error('Admin OTP request error:', error);
        return res.status(500).send({ error: 'Failed to send OTP' });
    }
});

// Verify admin OTP
fastify.post('/admin/verify-otp', { config: { rateLimit: otpVerifyLimiter } }, async (req, res) => {
    try {
        const { emailIndex, otp } = req.body;
        if (emailIndex === undefined || !otp) {
            return res.status(400).send({ error: 'Email selection and OTP required' });
        }

        const allowedEmails = getAllowedAdminEmails();
        const email = allowedEmails[emailIndex];
        
        if (!email) {
            return res.status(400).send({ error: 'Invalid email selection' });
        }

        // Find admin session
        const session = await AdminSession.findOne({ email: email });
        if (!session) {
            return res.status(401).send({ error: 'No OTP found. Please request a new code.' });
        }

        // Check if OTP has expired
        if (new Date() > session.otpExpires) {
            await AdminSession.deleteOne({ _id: session._id });
            return res.status(401).send({ error: 'OTP expired. Please request a new code.' });
        }

        // Check attempt limit
        if (session.otpAttempts >= 5) {
            await AdminSession.deleteOne({ _id: session._id });
            return res.status(429).send({ error: 'Too many failed attempts. Please request a new code.' });
        }

        // Verify OTP
        console.log('OTP Verification:', {
            received: otp.trim(),
            stored: session.otpCode,
            match: session.otpCode === otp.trim(),
            receivedType: typeof otp,
            storedType: typeof session.otpCode
        });

        if (session.otpCode !== otp.trim()) {
            session.otpAttempts += 1;
            await session.save();
            return res.status(401).send({
                error: 'Invalid OTP',
                attemptsRemaining: 5 - session.otpAttempts
            });
        }

        // Success - delete session and create admin session
        await AdminSession.deleteOne({ _id: session._id });

        console.log('Setting admin session:', {
            email,
            sessionId: req.session.sessionId,
            sessionBefore: { ...req.session }
        });

        req.session.isAdmin = true;
        req.session.adminEmail = email;

        try {
            await req.session.save();
            console.log('Admin session saved successfully:', {
                sessionId: req.session.sessionId,
                isAdmin: req.session.isAdmin,
                adminEmail: req.session.adminEmail
            });
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
fastify.get('/admin/logout', { config: { rateLimit: otpVerifyLimiter } }, async (req, res) => {
    await req.session.destroy();
    return res.redirect('/');
});

// Admin sub-pages (protected)
fastify.get('/admin/tournaments', { config: { rateLimit: pageViewLimiter }, preHandler: [requireAdmin] }, (req, res) => {
    return res.sendFile('admin-tournaments.html');
});

fastify.get('/admin/registrations', { config: { rateLimit: pageViewLimiter }, preHandler: [requireAdmin] }, (req, res) => {
    return res.sendFile('admin-registrations.html');
});

fastify.get('/admin/results', { config: { rateLimit: pageViewLimiter }, preHandler: [requireAdmin] }, (req, res) => {
    return res.sendFile('admin-results.html');
});

fastify.get('/admin/email-templates', { config: { rateLimit: pageViewLimiter }, preHandler: [requireAdmin] }, (req, res) => {
    return res.sendFile('admin/admin-email-templates.html');
});

}

export default mainroutes;