// Fastify preHandler: check bowler authentication
export async function requireBowlerAuth(req, reply) {
    if (req.session && req.session.bowlerId) return;
    return reply.code(403).send({ error: 'Authentication required' });
}

// Allowed admin emails (from environment variable)
export function getAllowedAdminEmails() {
    const emails = process.env.ADMIN_EMAILS || '';
    return emails.split(',').map(e => e.trim().toLowerCase()).filter(e => e);
}

// Fastify preHandler: check admin session
export async function requireAdmin(req, reply) {
    console.log('requireAdmin check:', {
        hasSession: !!req.session,
        isAdmin: req.session?.isAdmin,
        adminEmail: req.session?.adminEmail,
        sessionId: req.session?.sessionId
    });
    if (req.session && req.session.isAdmin) return;
    console.log('Admin check failed - redirecting to login');
    return reply.redirect('/admin/login');
}