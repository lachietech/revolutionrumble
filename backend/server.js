import 'dotenv/config';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import MongoStore from 'connect-mongo';
import { createApp } from './app.js';

const isProduction = process.env.NODE_ENV === 'production';
const rawSessionSecret = process.env.SECRET_KEY || '';
if (isProduction && rawSessionSecret.length < 32) {
    throw new Error('SECRET_KEY must be at least 32 characters in production');
}
if (!process.env.MONGO_URI) throw new Error('MONGO_URI is required');
const trustProxy = Number(process.env.TRUST_PROXY_HOPS || 0);
if (!Number.isSafeInteger(trustProxy) || trustProxy < 0) throw new Error('Invalid TRUST_PROXY_HOPS');
const port = Number(process.env.PORT || 5000);

try {
    await mongoose.connect(process.env.MONGO_URI, {
        maxPoolSize: Number(process.env.MONGO_MAX_POOL_SIZE) || 10,
        serverSelectionTimeoutMS: 10000
    });
    const store = MongoStore.create({
        client: mongoose.connection.getClient(),
        collectionName: 'sessions',
        ttl: 24 * 60 * 60,
        autoRemove: 'native'
    });
    const app = createApp({
        store,
        sessionSecret: rawSessionSecret.length >= 32 ? rawSessionSecret : crypto.randomBytes(32).toString('hex'),
        isProduction,
        trustProxy
    });
    app.listen(port, '0.0.0.0', () => console.log(`Server started on port ${port}`))
        .on('error', async () => {
            console.error('Unable to listen on configured port');
            await mongoose.disconnect();
            process.exit(1);
        });
} catch {
    console.error('Unable to start server: check database and server configuration');
    await mongoose.disconnect();
    process.exit(1);
}
