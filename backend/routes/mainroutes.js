import express from 'express';
import path from 'path';

const router = express.Router();

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
    res.sendFile(path.join(import.meta.dirname, '../../frontend/playerstats.html'));
});

router.get('/results', (req, res) => {
    res.sendFile(path.join(import.meta.dirname, '../../frontend/results.html'));
});

router.get('/events', (req, res) => {
    res.sendFile(path.join(import.meta.dirname, '../../frontend/events.html'));
});

// Admin login page
router.get('/admin/login', (req, res) => {
    res.sendFile(path.join(import.meta.dirname, '../../frontend/admin-login.html'));
});

// Handle admin login POST
router.post('/admin/login', (req, res) => {
    const pw = req.body && req.body.password;
    if (!process.env.ADMIN_PASS) {
        console.error('ADMIN_PASS not set in environment');
        return res.status(500).send('Admin not configured');
    }
    if (pw === process.env.ADMIN_PASS) {
        req.session.isAdmin = true;
        return res.redirect('/admin');
    }
    return res.status(401).send('Invalid password');
});

// Admin logout
router.get('/admin/logout', (req, res) => {
    req.session.isAdmin = false;
    req.session.destroy?.(() => res.redirect('/'));
});

// Admin dashboard (protected)
router.get('/admin', requireAdmin, (req, res) => {
    res.sendFile(path.join(import.meta.dirname, '../../frontend/admin.html'));
});

export default router;