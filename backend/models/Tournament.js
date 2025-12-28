import mongoose from 'mongoose';

const squadSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    date: {
        type: Date,
        required: true
    },
    time: {
        type: String,
        required: true
    },
    capacity: {
        type: Number,
        required: true,
        min: 1
    },
    isQualifying: {
        type: Boolean,
        default: false
    }
}, { _id: true });

const tournamentSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    date: {
        type: Date,
        required: true
    },
    location: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        default: ''
    },
    status: {
        type: String,
        enum: ['upcoming', 'ongoing', 'completed'],
        default: 'upcoming'
    },
    maxParticipants: {
        type: Number,
        default: null
    },
    registrationDeadline: {
        type: Date,
        default: null
    },
    squads: [squadSchema],
    squadsRequiredToQualify: {
        type: Number,
        default: 1,
        min: 1
    }
}, {
    timestamps: true
});

export default mongoose.model('Tournament', tournamentSchema);
