import mongoose from 'mongoose';

const bowlerSchema = new mongoose.Schema({
    // Core identity (from first registration)
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    playerName: {
        type: String,
        required: true
    },
    phone: String,
    gender: {
        type: String,
        enum: ['male', 'female', ''],
        default: 'male' // Default for existing users
    },
    
    // Profile customization
    nickname: String,
    hand: {
        type: String,
        enum: ['right', 'left', 'both', ''],
        default: ''
    },
    bio: String,
    homeCenter: String,
    yearsExperience: Number,
    
    // Stats
    currentAverage: Number, // Self-reported average from registrations
    tournamentAverage: Number, // Calculated from actual tournament results
    highGame: Number,
    highSeries: Number,
    
    // Tournament history tracking
    tournamentsEntered: [{
        tournament: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Tournament'
        },
        registeredAt: Date,
        status: String // 'registered', 'completed', 'cancelled'
    }],
    
    // Authentication
    claimedAt: Date, // When bowler claimed their profile
    lastLogin: Date,
    otpCode: String, // Current OTP code
    otpExpires: Date, // OTP expiration time
    otpAttempts: { type: Number, default: 0 }, // Failed OTP attempts
    
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Update the updatedAt timestamp before saving
bowlerSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

export default mongoose.model('Bowler', bowlerSchema);
