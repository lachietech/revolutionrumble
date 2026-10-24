import express from 'express';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import csurf from 'csurf';
import path from 'path';
import mainroutes from './routes/mainroutes.js';
import tournamentRoutes from './routes/tournamentRoutes.js';
import registrationRoutes from './routes/registrationRoutes.js';
import bowlerRoutes from './routes/bowlerRoutes.js';
import emailTemplateRoutes from './routes/emailTemplateRoutes.js';

import { mountFrontend } from './frontend.js';

import { requireAdmin } from './middleware/auth.js';

export function createApp({ store, sessionSecret, isProduction = false, trustProxy = 0, frontendMiddleware = null }) {
    const app = express();
    app.disable('x-powered-by');
    app.set('trust proxy', trustProxy);

    // Core middleware
    app.use((req, res, next) => {
        res.set({
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'DENY',
            'Referrer-Policy': 'strict-origin-when-cross-origin',
            'Content-Security-Policy': "object-src 'none'; base-uri 'self'; frame-ancestors 'none'"
        });
        if (isProduction) res.set('Strict-Transport-Security', 'max-age=31536000');
        if (req.path.startsWith('/api/') || req.path.startsWith('/admin')) res.set('Cache-Control', 'no-store');
        next();
    });
    app.use(compression());
    app.use(express.json({ limit: '1mb' }));
    app.use(express.urlencoded({ extended: true, limit: '1mb' }));
    app.use(cookieParser());
    app.use(session({
        secret: sessionSecret,
        saveUninitialized: false,
        resave: false,
        store,
        cookie: {
            secure: isProduction,
            httpOnly: true,
            sameSite: 'lax',
            maxAge: 24 * 60 * 60 * 1000 // 24 hours
        }
    }));

    const frontendRoot = path.join(import.meta.dirname, '../frontend');
    app.get('/favicon.ico', (req, res) => res.type('image/svg+xml').sendFile(path.join(frontendRoot, 'static/images/rumble-mark.svg')));
    app.use((req, res, next) => {
        // Static HTML aliases must enforce the same authorization as their page routes.
        let staticPath;
        try { staticPath = path.posix.normalize(decodeURIComponent(req.path).replaceAll('\\', '/')); }
        catch { return res.status(400).send({ error: 'Invalid path' }); }
        if (/^\/admin(?:[-/]).*\.html$/i.test(staticPath) && staticPath.toLowerCase() !== '/admin-login.html') {
            res.set('Cache-Control', 'no-store');
            return requireAdmin(req, res, next);
        }
        next();
    });
    app.use('/static', express.static(path.join(frontendRoot, 'static'), { maxAge: isProduction ? '1d' : 0 }));

    const csrfProtection = csurf({
        value: (req) => req.headers['x-csrf-token'] || req.body?._csrf
    });
    app.use(csrfProtection);

    app.use(mainroutes);
    app.use('/api', tournamentRoutes);
    app.use('/api', registrationRoutes);
    app.use('/api', bowlerRoutes);
    app.use('/api', emailTemplateRoutes);

    app.use('/api', (req, res) => res.status(404).send({ error: 'API endpoint not found' }));
    mountFrontend(app, frontendMiddleware);

    app.use((err, req, res, next) => {
        if (err && err.code === 'EBADCSRFTOKEN') {
            return res.status(403).send({ error: 'Invalid CSRF token' });
        }
        if (err?.type === 'entity.too.large') return res.status(413).send({ error: 'Request body too large' });
        if (err?.type === 'entity.parse.failed') return res.status(400).send({ error: 'Invalid JSON body' });
        console.error(err);
        return res.status(500).send({ error: 'Internal server error' });
    });

    return app;
}
