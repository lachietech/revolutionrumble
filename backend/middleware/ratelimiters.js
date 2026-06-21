import rateLimit from 'express-rate-limit';

function createLimiter(max, windowMs, errorMessage) {
    return rateLimit({
        windowMs,
        max,
        standardHeaders: true,
        legacyHeaders: false,
        handler: (req, res) => {
            return res.status(429).send({ error: errorMessage });
        }
    });
}

export const otpRequestLimiter = createLimiter(
    5,
    15 * 60 * 1000,
    'Too many OTP requests, please try again later'
);

export const otpVerifyLimiter = createLimiter(
    10,
    15 * 60 * 1000,
    'Too many verification attempts, please try again later'
);

export const generalWriteLimiter = createLimiter(
    30,
    1 * 60 * 1000,
    'Too many requests, please try again later'
);

export const strictWriteLimiter = createLimiter(
    20,
    1 * 60 * 1000,
    'Too many requests, please try again later'
);

export const pageViewLimiter = createLimiter(
    120,
    1 * 60 * 1000,
    'Too many requests, please try again later'
);

export const reservationLimiter = createLimiter(
    10,
    1 * 60 * 1000,
    'Too many reservation requests, please try again later'
);

export const registrationLimiter = createLimiter(
    10,
    5 * 60 * 1000,
    'Too many registration attempts, please try again later'
);


