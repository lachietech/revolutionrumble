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
    res.sendFile(path.join(import.meta.dirname, '../../frontend/bowlerstats.html'));
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
        return res.redirect('/admin/tournaments');
    }
    return res.status(401).send('Invalid password');
});

// Admin logout
router.get('/admin/logout', (req, res) => {
    req.session.isAdmin = false;
    req.session.destroy?.(() => res.redirect('/'));
});

// Admin sub-pages (protected)
router.get('/admin/tournaments', requireAdmin, (req, res) => {
    res.sendFile(path.join(import.meta.dirname, '../../frontend/admin-tournaments.html'));
});

router.get('/admin/registrations', requireAdmin, (req, res) => {
    res.sendFile(path.join(import.meta.dirname, '../../frontend/admin-registrations.html'));
});

router.get('/admin/results', requireAdmin, (req, res) => {
    res.sendFile(path.join(import.meta.dirname, '../../frontend/admin-results.html'));
});

export default router;