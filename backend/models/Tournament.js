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
    startDate: {
        type: Date,
        required: false
    },
    endDate: {
        type: Date,
        required: false
    },
    // Keep old date field for backwards compatibility
    date: {
        type: Date,
        required: false
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
    registrationOpenDate: {
        type: Date,
        default: null // When registration opens (null = open immediately)
    },
    registrationManuallyOpened: {
        type: Boolean,
        default: false // Manual override to open registration regardless of date
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
    },
    allowReentry: {
        type: Boolean,
        default: true
    },
    // Format Configuration
    format: {
        gamesPerBowler: {
            type: Number,
            default: 3,
            min: 1
        },
        hasStages: {
            type: Boolean,
            default: false
        },
        stages: [{
            name: {
                type: String,
                required: true
            },
            games: {
                type: Number,
                required: true,
                min: 1
            },
            carryoverPinfall: {
                type: Boolean,
                default: false
            },
            carryoverPercentage: {
                type: Number,
                default: 100,
                min: 0,
                max: 100
            },
            advancingBowlers: {
                type: Number,
                default: null
            }
        }],
        // Scoring Options
        useHandicap: {
            type: Boolean,
            default: false
        },
        handicapBase: {
            type: Number,
            default: 200
        },
        handicapPercentage: {
            type: Number,
            default: 90,
            min: 0,
            max: 100
        },
        // Gender Division Options
        separateDivisions: {
            type: Boolean,
            default: false
        },
        femaleHandicapPins: {
            type: Number,
            default: 8,
            min: 0
        },
        bonusPoints: {
            enabled: {
                type: Boolean,
                default: false
            },
            perGame: {
                type: Number,
                default: 0
            },
            perSeries: {
                type: Number,
                default: 0
            }
        },
        // Scoring Method
        scoringMethod: {
            type: String,
            enum: ['total-pinfall', 'match-play', 'head-to-head', 'points'],
            default: 'total-pinfall'
        },
        // Match Play Options (if applicable)
        matchPlay: {
            pointsForWin: {
                type: Number,
                default: 30
            },
            pointsForTie: {
                type: Number,
                default: 15
            },
            pointsForLoss: {
                type: Number,
                default: 0
            },
            includePinfall: {
                type: Boolean,
                default: true
            }
        }
    }
}, {
    timestamps: true
});

// Pre-save hook to auto-populate date field from startDate for backwards compatibility
tournamentSchema.pre('save', function(next) {
    // Ensure we have at least one date field
    if (!this.startDate && !this.date) {
        return next(new Error('Tournament must have a start date'));
    }
    
    // If startDate exists but date doesn't, copy startDate to date
    if (this.startDate && !this.date) {
        this.date = this.startDate;
    }
    // If date exists but startDate doesn't (old records), copy date to startDate/endDate
    if (this.date && !this.startDate) {
        this.startDate = this.date;
        this.endDate = this.date;
    }
    // If endDate doesn't exist, default to startDate
    if (this.startDate && !this.endDate) {
        this.endDate = this.startDate;
    }
    next();
});

export default mongoose.model('Tournament', tournamentSchema);
