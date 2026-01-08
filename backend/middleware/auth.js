// Middleware to check bowler authentication
export function requireBowlerAuth(req, res, next) {
    if (req.session && req.session.bowlerId) return next();
    return res.status(403).json({ error: 'Authentication required' });
}

// Allowed admin emails (from environment variable)
export function getAllowedAdminEmails() {
    const emails = process.env.ADMIN_EMAILS || '';
    return emails.split(',').map(e => e.trim().toLowerCase()).filter(e => e);
}

// simple admin-check middleware
export function requireAdmin(req, res, next) {
    if (req.session && req.session.isAdmin) return next();
    return res.redirect('/admin/login');
}