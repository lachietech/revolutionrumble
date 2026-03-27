import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifySession from '@fastify/session';
import fastifyCookie from '@fastify/cookie';
import fastifyCsrf from '@fastify/csrf-protection';
import fastifyCompress from '@fastify/compress';
import fastifyFormbody from '@fastify/formbody';
import fastifyRateLimit from '@fastify/rate-limit';
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

const fastify = Fastify({
    logger: true,
    trustProxy: true
});

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ MongoDB connected'))
    .catch(err => console.error('MongoDB connection error:', err));

// Register plugins
await fastify.register(fastifyCompress);
await fastify.register(fastifyFormbody);
await fastify.register(fastifyCookie);
await fastify.register(fastifySession, {
    secret: sessionSecret,
    saveUninitialized: false,
    cookie: {
        secure: isProduction,
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
});
await fastify.register(fastifyRateLimit, { global: false });
await fastify.register(fastifyStatic, {
    root: path.join(import.meta.dirname, '../frontend'),
    decorateReply: true
});
// CSRF - uses session to store secret; reads token from X-CSRF-Token header
await fastify.register(fastifyCsrf, {
    sessionPlugin: '@fastify/session',
    getToken: (req) => req.headers['x-csrf-token'] || req.body?._csrf
});

// Apply CSRF globally to all unsafe methods except OTP endpoints
const csrfExemptPaths = new Set([
    '/admin/request-otp',
    '/admin/verify-otp',
    '/api/bowlers/request-otp',
    '/api/bowlers/verify-otp'
]);
fastify.addHook('preHandler', async (req, reply) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return;
    if (csrfExemptPaths.has(req.url.split('?')[0])) return;
    return fastify.csrfProtection(req, reply);
});

// Routes
await fastify.register(mainroutes);
await fastify.register(tournamentRoutes, { prefix: '/api' });
await fastify.register(registrationRoutes, { prefix: '/api' });
await fastify.register(bowlerRoutes, { prefix: '/api' });
await fastify.register(emailTemplateRoutes, { prefix: '/api' });

async function start() {
    try {
        await fastify.listen({ port: 5000, host: '0.0.0.0' });
        console.log('Server started on port 5000');
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
}
start();
