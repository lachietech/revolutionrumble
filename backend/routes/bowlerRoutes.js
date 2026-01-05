import express from 'express';
import Bowler from '../models/Bowler.js';
import Registration from '../models/Registration.js';
import TournamentResult from '../models/TournamentResult.js';
import Tournament from '../models/Tournament.js';

const router = express.Router();

// Middleware to check admin
function requireAdmin(req, res, next) {
    if (req.session && req.session.isAdmin) return next();
    return res.status(403).json({ error: 'Admin access required' });
}

// GET bowler by email (public - for profile lookup)
router.get('/bowlers/lookup', async (req, res) => {
    try {
        const { email } = req.query;
        if (!email) {
            return res.status(400).json({ error: 'Email required' });
        }

        const bowler = await Bowler.findOne({ email: email.toLowerCase() })
            .populate('tournamentsEntered.tournament', 'name date location status');
        
        if (!bowler) {
            return res.status(404).json({ error: 'Bowler not found' });
        }

        res.json(bowler);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET bowler by ID (public)
router.get('/bowlers/:id', async (req, res) => {
    try {
        const bowler = await Bowler.findById(req.params.id)
            .populate('tournamentsEntered.tournament', 'name date location status');
        
        if (!bowler) {
            return res.status(404).json({ error: 'Bowler not found' });
        }

        res.json(bowler);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET all bowlers (public - for leaderboards, etc.)
router.get('/bowlers', async (req, res) => {
    try {
        const bowlers = await Bowler.find()
            .select('playerName nickname email tournamentAverage currentAverage highGame highSeries tournamentsEntered')
            .sort({ tournamentAverage: -1 });
        
        res.json(bowlers);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PUT update bowler profile (requires email verification)
router.put('/bowlers/:id', async (req, res) => {
    try {
        const { email, nickname, hand, bio, homeCenter, yearsExperience, currentAverage, highGame, highSeries } = req.body;

        const bowler = await Bowler.findById(req.params.id);
        if (!bowler) {
            return res.status(404).json({ error: 'Bowler not found' });
        }

        // Simple email verification (in production, you'd use proper auth)
        if (email.toLowerCase() !== bowler.email.toLowerCase()) {
            return res.status(403).json({ error: 'Email verification failed' });
        }

        // Update allowed fields
        if (nickname !== undefined) bowler.nickname = nickname;
        if (hand !== undefined) bowler.hand = hand;
        if (bio !== undefined) bowler.bio = bio;
        if (homeCenter !== undefined) bowler.homeCenter = homeCenter;
        if (yearsExperience !== undefined) bowler.yearsExperience = yearsExperience;
        if (currentAverage !== undefined) bowler.currentAverage = currentAverage;
        if (highGame !== undefined) bowler.highGame = highGame;
        if (highSeries !== undefined) bowler.highSeries = highSeries;

        // Mark as claimed if not already
        if (!bowler.claimedAt) {
            bowler.claimedAt = new Date();
        }
        bowler.lastLogin = new Date();

        await bowler.save();
        res.json(bowler);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET bowler tournament history with results
router.get('/bowlers/:id/history', async (req, res) => {
    try {
        const bowler = await Bowler.findById(req.params.id);
        if (!bowler) {
            return res.status(404).json({ error: 'Bowler not found' });
        }

        // Get all registrations
        const registrations = await Registration.find({ bowler: req.params.id })
            .populate('tournament', 'name date location status')
            .sort({ registeredAt: -1 });

        // Get all tournament results
        const results = await TournamentResult.find({ bowler: req.params.id })
            .populate('tournament', 'name date location')
            .sort({ 'tournament.date': -1 });

        // Calculate overall tournament average from results
        let totalPins = 0;
        let totalGames = 0;
        results.forEach(result => {
            if (result.totalPins && result.totalGames) {
                totalPins += result.totalPins;
                totalGames += result.totalGames;
            }
        });

        const overallAverage = totalGames > 0 ? Math.round(totalPins / totalGames) : null;

        res.json({
            bowler: {
                _id: bowler._id,
                playerName: bowler.playerName,
                nickname: bowler.nickname,
                email: bowler.email
            },
            registrations,
            results,
            stats: {
                tournamentsEntered: registrations.length,
                tournamentsCompleted: results.length,
                overallAverage,
                totalGames
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST create/update tournament result (admin only)
router.post('/results', requireAdmin, async (req, res) => {
    try {
        const { bowlerId, tournamentId, squadResults, finalPosition, totalParticipants } = req.body;

        // Check if result already exists
        let result = await TournamentResult.findOne({
            bowler: bowlerId,
            tournament: tournamentId
        });

        if (result) {
            // Update existing
            result.squadResults = squadResults;
            result.finalPosition = finalPosition;
            result.totalParticipants = totalParticipants;
            result.enteredBy = 'admin';
            result.verified = true;
        } else {
            // Create new
            result = new TournamentResult({
                bowler: bowlerId,
                tournament: tournamentId,
                squadResults,
                finalPosition,
                totalParticipants,
                enteredBy: 'admin',
                verified: true
            });
        }

        await result.save();

        // Update bowler's tournament average and high scores
        await updateBowlerStats(bowlerId);

        res.status(201).json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Helper function to recalculate bowler stats from all results
async function updateBowlerStats(bowlerId) {
    const results = await TournamentResult.find({ bowler: bowlerId });
    
    let totalPins = 0;
    let totalGames = 0;
    let highGame = 0;
    let highSeries = 0;

    results.forEach(result => {
        if (result.totalPins && result.totalGames) {
            totalPins += result.totalPins;
            totalGames += result.totalGames;
        }
        if (result.highGame > highGame) {
            highGame = result.highGame;
        }
        if (result.highSeries > highSeries) {
            highSeries = result.highSeries;
        }
    });

    const tournamentAverage = totalGames > 0 ? Math.round(totalPins / totalGames) : null;

    await Bowler.findByIdAndUpdate(bowlerId, {
        tournamentAverage,
        highGame: highGame || undefined,
        highSeries: highSeries || undefined
    });
}

export default router;
