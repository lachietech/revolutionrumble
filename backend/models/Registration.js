import mongoose from 'mongoose';

const registrationSchema = new mongoose.Schema({
    tournament: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tournament',
        required: true
    },
    bowler: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Bowler'
    },
    playerName: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true
    },
    phone: {
        type: String,
        required: true,
        trim: true
    },
    averageScore: {
        type: Number,
        min: 0,
        max: 300
    },
    gender: {
        type: String,
        enum: ['male', 'female'],
        required: true
    },
    assignedSquads: [{
        type: mongoose.Schema.Types.ObjectId
    }],
    status: {
        type: String,
        enum: ['pending', 'confirmed', 'cancelled', 'waitlist'],
        default: 'pending'
    },
    notes: String,
    registeredAt: {
        type: Date,
        default: Date.now
    },
    // Stage-based scoring
    currentStage: {
        type: Number,
        default: 0 // 0 = qualifying/first stage
    },
    stageScores: [{
        stageIndex: Number,
        scores: [Number], // Game scores for this stage
        total: Number,
        carryover: Number // Pinfall carried from previous stage
    }]
}, {
    timestamps: true
});

// Index for faster queries
registrationSchema.index({ tournament: 1, email: 1 }, { unique: true });
registrationSchema.index({ tournament: 1, status: 1 });
registrationSchema.index({ bowler: 1 });

const Registration = mongoose.model('Registration', registrationSchema);

export default Registration;
