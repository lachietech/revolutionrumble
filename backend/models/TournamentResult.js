import mongoose from 'mongoose';

const tournamentResultSchema = new mongoose.Schema({
    bowler: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Bowler',
        required: true
    },
    tournament: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tournament',
        required: true
    },
    registration: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Registration'
    },
    
    // Squad results (bowler can have multiple squads per tournament)
    squadResults: [{
        squadId: mongoose.Schema.Types.ObjectId,
        squadName: String,
        games: [Number], // Array of game scores
        totalPins: Number,
        gameCount: Number,
        average: Number
    }],
    
    // Overall tournament performance
    totalPins: Number,
    totalGames: Number,
    tournamentAverage: Number,
    highGame: Number,
    highSeries: Number, // Best 3-game series
    
    // Placement
    finalPosition: Number,
    totalParticipants: Number,
    
    // Metadata
    enteredBy: String, // 'admin' or 'self-reported'
    verified: {
        type: Boolean,
        default: false
    },
    
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Calculate averages before saving
tournamentResultSchema.pre('save', function(next) {
    if (this.squadResults && this.squadResults.length > 0) {
        let totalPins = 0;
        let totalGames = 0;
        let highGame = 0;
        
        this.squadResults.forEach(squad => {
            if (squad.games && squad.games.length > 0) {
                squad.totalPins = squad.games.reduce((sum, score) => sum + score, 0);
                squad.gameCount = squad.games.length;
                squad.average = Math.round(squad.totalPins / squad.gameCount);
                
                totalPins += squad.totalPins;
                totalGames += squad.gameCount;
                
                const squadHigh = Math.max(...squad.games);
                if (squadHigh > highGame) highGame = squadHigh;
            }
        });
        
        this.totalPins = totalPins;
        this.totalGames = totalGames;
        this.tournamentAverage = totalGames > 0 ? Math.round(totalPins / totalGames) : 0;
        this.highGame = highGame;
    }
    
    this.updatedAt = Date.now();
    next();
});

export default mongoose.model('TournamentResult', tournamentResultSchema);
