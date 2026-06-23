import express from 'express';
import session from 'express-session';
import MongoStore from 'connect-mongo';
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

const isProduction = process.env.NODE_ENV === 'production';
const rawSessionSecret = process.env.SECRET_KEY || '';

if (isProduction && rawSessionSecret.length < 32) {
    throw new Error('SECRET_KEY must be at least 32 characters in production');
}

if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is required');
}

const sessionSecret = rawSessionSecret.length >= 32
    ? rawSessionSecret
    : 'development-session-secret'.padEnd(32, '_');
const trustProxy = Number(process.env.TRUST_PROXY_HOPS || 0);

const app = express();
app.set('trust proxy', trustProxy);

mongoose.connect(process.env.MONGO_URI, {
    maxPoolSize: Number(process.env.MONGO_MAX_POOL_SIZE) || 10,
    serverSelectionTimeoutMS: 10000
})
    .then(() => console.log('✅ MongoDB connected'))
    .catch(err => console.error('MongoDB connection error:', err));

// Core middleware
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());
app.use(session({
    secret: sessionSecret,
    saveUninitialized: false,
    resave: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGO_URI,
        collectionName: 'sessions',
        ttl: 24 * 60 * 60,
        autoRemove: 'native'
    }),
    cookie: {
        secure: isProduction,
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

const frontendRoot = path.join(import.meta.dirname, '../frontend');
app.use(express.static(frontendRoot, {
    etag: true,
    maxAge: isProduction ? '1d' : 0
}));

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
    return res.status(500).send({ error: 'Internal server error' });
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
