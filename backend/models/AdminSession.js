/**
 * @fileoverview Admin Session Model - Stores temporary OTP codes for admin authentication
 * @module models/AdminSession
 */

import mongoose from 'mongoose';

/**
 * Schema for admin OTP sessions
 * Stores temporary one-time passwords for admin email authentication
 */
const adminSessionSchema = new mongoose.Schema({
    /**
     * Admin email address (lowercase)
     * @type {string}
     */
    email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true
    },
    
    /**
     * 6-digit OTP code
     * @type {string}
     */
    otpCode: {
        type: String,
        required: true
    },
    
    /**
     * OTP expiration timestamp
     * @type {Date}
     */
    otpExpires: {
        type: Date,
        required: true
    },
    
    /**
     * Number of failed OTP verification attempts
     * @type {number}
     */
    otpAttempts: {
        type: Number,
        default: 0
    },
    
    /**
     * Creation timestamp
     * @type {Date}
     */
    createdAt: {
        type: Date,
        default: Date.now,
        expires: 600 // Auto-delete documents after 10 minutes
    }
});

const AdminSession = mongoose.model('AdminSession', adminSessionSchema);

export default AdminSession;
