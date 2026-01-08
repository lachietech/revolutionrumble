import mongoose from 'mongoose';

/**
 * Schema for admin OTP sessions
 * Stores temporary one-time passwords for admin email authentication
 */
const adminSessionSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true
    },
    
    /**
     * 6-digit OTP code
     */
    otpCode: {
        type: String,
        required: true
    },
    
    otpExpires: {
        type: Date,
        required: true
    },
    
    /**
     * Number of failed OTP verification attempts
     */
    otpAttempts: {
        type: Number,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: 600 // Auto-delete documents after 10 minutes
    }
});

const AdminSession = mongoose.model('AdminSession', adminSessionSchema);

export default AdminSession;
