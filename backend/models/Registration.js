import mongoose from 'mongoose';

const registrationSchema = new mongoose.Schema({
    tournament: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tournament',
        required: true
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
    }
}, {
    timestamps: true
});

// Index for faster queries
registrationSchema.index({ tournament: 1, email: 1 }, { unique: true });
registrationSchema.index({ tournament: 1, status: 1 });

const Registration = mongoose.model('Registration', registrationSchema);

export default Registration;
