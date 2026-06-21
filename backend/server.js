import express from 'express';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import csurf from 'csurf';
import dotenv from 'dotenv';
import path from 'path';
import mainroutes from './routes/mainroutes.js';
import tournamentRoutes from './routes/tournamentRoutes.js';
import registrationRoutes from './routes/registrationRoutes.js';
import bowlerRoutes from './routes/bowlerRoutes.js';
import emailTemplateRoutes from './routes/emailTemplateRoutes.js';
import mongoose from 'mongoose';

dotenv.config();

const rawSessionSecret = process.env.SECRET_KEY || 'development-session-secret';
const sessionSecret = rawSessionSecret.length >= 32
    ? rawSessionSecret
    : rawSessionSecret.padEnd(32, '_');
const isProduction = process.env.NODE_ENV === 'production';

const app = express();
app.set('trust proxy', true);

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ MongoDB connected'))
    .catch(err => console.error('MongoDB connection error:', err));

// Core middleware
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session({
    secret: sessionSecret,
    saveUninitialized: false,
    resave: false,
    cookie: {
        secure: isProduction,
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

const frontendRoot = path.join(import.meta.dirname, '../frontend');
app.use(express.static(frontendRoot));

app.use((req, res, next) => {
    const originalSendFile = res.sendFile.bind(res);
    res.sendFile = (filePath, ...args) => {
        const normalized = path.isAbsolute(filePath) ? filePath : path.join(frontendRoot, filePath);
        return originalSendFile(normalized, ...args);
    };
    next();
});

// Apply CSRF globally to all unsafe methods except OTP endpoints
const csrfExemptPaths = new Set([
    '/admin/request-otp',
    '/admin/verify-otp',
    '/api/bowlers/request-otp',
    '/api/bowlers/verify-otp'
]);
const csrfProtection = csurf({
    value: (req) => req.headers['x-csrf-token'] || req.body?._csrf
});
app.use((req, res, next) => {
    if (csrfExemptPaths.has(req.path)) return next();
    csrfProtection(req, res, next);
});

app.use(mainroutes);
app.use('/api', tournamentRoutes);
app.use('/api', registrationRoutes);
app.use('/api', bowlerRoutes);
app.use('/api', emailTemplateRoutes);

app.use((err, req, res, next) => {
    if (err && err.code === 'EBADCSRFTOKEN') {
        return res.status(403).send({ error: 'Invalid CSRF token' });
    }
    console.error(err);
    return res.status(500).send({ error: err.message || 'Internal server error' });
});

async function start() {
    try {
        app.listen(5000, '0.0.0.0', () => {
            console.log('Server started on port 5000');
        });
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
start();
