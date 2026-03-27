// Fastify route-level rate-limit configurations
export const otpRequestLimiter = {
    max: 5,
    timeWindow: 15 * 60 * 1000,
    errorResponseBuilder: () => ({
        error: 'Too many OTP requests, please try again later'
    })
};

export const otpVerifyLimiter = {
    max: 10,
    timeWindow: 15 * 60 * 1000,
    errorResponseBuilder: () => ({
        error: 'Too many verification attempts, please try again later'
    })
};

export const generalWriteLimiter = {
    max: 30,
    timeWindow: 1 * 60 * 1000,
    errorResponseBuilder: () => ({
        error: 'Too many requests, please try again later'
    })
};

export const strictWriteLimiter = {
    max: 20,
    timeWindow: 1 * 60 * 1000,
    errorResponseBuilder: () => ({
        error: 'Too many requests, please try again later'
    })
};

export const pageViewLimiter = {
    max: 120,
    timeWindow: 1 * 60 * 1000,
    errorResponseBuilder: () => ({
        error: 'Too many requests, please try again later'
    })
};

export const reservationLimiter = {
    max: 10,
    timeWindow: 1 * 60 * 1000,
    errorResponseBuilder: () => ({
        error: 'Too many reservation requests, please try again later'
    })
};

export const registrationLimiter = {
    max: 10,
    timeWindow: 5 * 60 * 1000,
    errorResponseBuilder: () => ({
        error: 'Too many registration attempts, please try again later'
    })
};


