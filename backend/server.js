import express from 'express';
import dotenv from 'dotenv';
import session from 'express-session';
import path from 'path';
import bodyParser from 'body-parser';
import mainroutes from'./routes/mainroutes.js';
import tournamentRoutes from './routes/tournamentRoutes.js';
import registrationRoutes from './routes/registrationRoutes.js';
import bowlerRoutes from './routes/bowlerRoutes.js';
import mongoose from 'mongoose';
import lusca from 'lusca';

dotenv.config();
const app = express();

mongoose.connect(process.env.MONGO_URI).then(() => console.log('✅ MongoDB connected')).catch(err => console.error('MongoDB connection error:', err));

app.use(express.static(path.join(import.meta.dirname, '../frontend')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({
    secret: process.env.SECRET_KEY,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // set to true only in production with HTTPS
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// CSRF middleware - exclude OTP routes (they have rate limiting + short-lived codes)
app.use((req, res, next) => {
    const otpPaths = ['/admin/request-otp', '/admin/verify-otp', '/api/bowlers/request-otp', '/api/bowlers/verify-otp'];
    if (otpPaths.includes(req.path)) {
        return next();
    }
    return lusca.csrf({
        header: 'X-CSRF-Token',
        secret: process.env.SECRET_KEY
    })(req, res, next);
});

// Routes
app.use('/', mainroutes);
app.use('/api', tournamentRoutes);
app.use('/api', registrationRoutes);
app.use('/api', bowlerRoutes);

app.listen(5000, () => {
    console.log("Server started");
});
