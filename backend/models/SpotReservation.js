import mongoose from 'mongoose';

const spotReservationSchema = new mongoose.Schema({
    tournament: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tournament',
        required: true
    },
    squads: [{
        type: mongoose.Schema.Types.ObjectId
    }],
    sessionId: {
        type: String,
        required: true,
        index: true
    },
    email: String,
    expiresAt: {
        type: Date,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Auto-delete expired reservations
spotReservationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('SpotReservation', spotReservationSchema);
