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
        bonusPins: [Number], // Matchplay bonus pins per game
        handicap: Number, // Handicap per game
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

// After saving registration with scores, update bowler stats
registrationSchema.post('save', async function(doc) {
    try {
        // Only update if there are scores
        if (doc.stageScores && doc.stageScores.length > 0) {
            const Bowler = mongoose.model('Bowler');
            
            // Find bowler by email
            const bowler = await Bowler.findOne({ email: doc.email });
            if (bowler) {
                // Import the update function (this is a workaround since we can't import from routes)
                // Instead, we'll recalculate directly here
                const Registration = mongoose.model('Registration');
                const registrations = await Registration.find({ email: doc.email });
                
                let totalPins = 0;
                let totalGames = 0;
                let highGame = 0;
                let highSeries = 0;
                
                registrations.forEach(reg => {
                    if (reg.stageScores && reg.stageScores.length > 0) {
                        reg.stageScores.forEach(stage => {
                            if (stage.scores && stage.scores.length > 0) {
                                stage.scores.forEach(score => {
                                    totalPins += score;
                                    totalGames++;
                                    if (score > highGame) {
                                        highGame = score;
                                    }
                                });
                                
                                // Calculate 3-game series
                                if (stage.scores.length >= 3) {
                                    for (let i = 0; i <= stage.scores.length - 3; i++) {
                                        const series = stage.scores[i] + stage.scores[i + 1] + stage.scores[i + 2];
                                        if (series > highSeries) {
                                            highSeries = series;
                                        }
                                    }
                                }
                            }
                        });
                    }
                });
                
                const tournamentAverage = totalGames > 0 ? Math.round(totalPins / totalGames) : null;
                
                await Bowler.findByIdAndUpdate(bowler._id, {
                    tournamentAverage,
                    highGame: highGame || undefined,
                    highSeries: highSeries || undefined
                });
            }
        }
    } catch (error) {
        console.error('Error updating bowler stats after registration save:', error);
    }
});

const Registration = mongoose.model('Registration', registrationSchema);

export default Registration;
