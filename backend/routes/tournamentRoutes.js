import express from 'express';
import Tournament from '../models/Tournament.js';
import Registration from '../models/Registration.js';
import SpotReservation from '../models/SpotReservation.js';
import rateLimit from 'express-rate-limit';
import { validateObjectId } from '../utils/validation.js';

const router = express.Router();

// Rate limiters
const generalWriteLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 30, // 30 operations per minute per IP
    message: 'Too many requests, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false
});

const strictWriteLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 20, // 20 admin operations per minute per IP
    message: 'Too many requests, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false
});

// Middleware to require admin session
function requireAdmin(req, res, next) {
    if (req.session && req.session.isAdmin) return next();
    return res.status(401).json({ error: 'Unauthorized' });
}

// GET all tournaments
router.get('/tournaments', generalWriteLimiter, async (req, res) => {
    try {
        const tournaments = await Tournament.find().sort({ startDate: 1 });
        res.json(tournaments);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET single tournament by ID
router.get('/tournaments/:id', generalWriteLimiter, async (req, res) => {
    try {
        // Validate tournament ID
        const tournamentId = validateObjectId(req.params.id);
        if (!tournamentId) {
            return res.status(400).json({ error: 'Invalid tournament ID' });
        }
        
        const tournament = await Tournament.findById(tournamentId);
        if (!tournament) return res.status(404).json({ error: 'Tournament not found' });
        res.json(tournament);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST create new tournament (admin only)
router.post('/tournaments', strictWriteLimiter, requireAdmin, async (req, res) => {
    try {
        const tournament = new Tournament(req.body);
        await tournament.save();
        res.status(201).json(tournament);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// PUT update tournament (admin only)
router.put('/tournaments/:id', strictWriteLimiter, requireAdmin, async (req, res) => {
    try {
        const tournament = await Tournament.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );
        if (!tournament) return res.status(404).json({ error: 'Tournament not found' });
        res.json(tournament);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// DELETE tournament (admin only)
router.delete('/tournaments/:id', strictWriteLimiter, requireAdmin, async (req, res) => {
    try {
        // Validate tournament ID
        const tournamentId = validateObjectId(req.params.id);
        if (!tournamentId) {
            return res.status(400).json({ error: 'Invalid tournament ID' });
        }
        
        const tournament = await Tournament.findById(tournamentId);
        if (!tournament) return res.status(404).json({ error: 'Tournament not found' });
        res.json({ message: 'Tournament deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET squad availability for a tournament (public)
router.get('/tournaments/:id/squads/availability', generalWriteLimiter, async (req, res) => {
    try {
        const tournamentId = validateObjectId(req.params.id);
        if (!tournamentId) {
            return res.status(400).json({ error: 'Invalid tournament ID' });
        }
        
        const tournament = await Tournament.findById(tournamentId);
        if (!tournament) return res.status(404).json({ error: 'Tournament not found' });

        // Get all confirmed registrations for this tournament
        const registrations = await Registration.find({
            tournament: tournamentId,
            status: { $in: ['pending', 'confirmed'] }
        });
        
        // Get active reservations
        const activeReservations = await SpotReservation.find({
            tournament: req.params.id,
            expiresAt: { $gt: new Date() }
        });

        // Count registrations per squad
        const squadCounts = {};
        registrations.forEach(reg => {
            if (reg.assignedSquads && reg.assignedSquads.length > 0) {
                reg.assignedSquads.forEach(squadId => {
                    const id = squadId.toString();
                    squadCounts[id] = (squadCounts[id] || 0) + 1;
                });
            }
        });

        // Count reservations per squad
        const reservationCounts = {};
        activeReservations.forEach(res => {
            if (res.squads && res.squads.length > 0) {
                res.squads.forEach(squadId => {
                    const id = squadId.toString();
                    reservationCounts[id] = (reservationCounts[id] || 0) + 1;
                });
            }
        });

        // Build availability data
        const squadsWithAvailability = tournament.squads.map(squad => {
            const registered = squadCounts[squad._id.toString()] || 0;
            const reserved = reservationCounts[squad._id.toString()] || 0;
            return {
                _id: squad._id,
                name: squad.name,
                date: squad.date,
                time: squad.time,
                capacity: squad.capacity,
                isQualifying: squad.isQualifying,
                registered,
                reserved,
                available: squad.capacity - registered - reserved
            };
        });

        res.json({
            tournament: {
                _id: tournament._id,
                name: tournament.name,
                squadsRequiredToQualify: tournament.squadsRequiredToQualify
            },
            squads: squadsWithAvailability
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET squad lists with bowler names (public)
router.get('/tournaments/:id/squads/list', generalWriteLimiter, async (req, res) => {
    try {
        // Validate tournament ID
        const tournamentId = validateObjectId(req.params.id);
        if (!tournamentId) {
            return res.status(400).json({ error: 'Invalid tournament ID' });
        }
        
        const tournament = await Tournament.findById(tournamentId);
        if (!tournament) return res.status(404).json({ error: 'Tournament not found' });

        // Get all confirmed registrations for this tournament
        const registrations = await Registration.find({
            tournament: tournamentId,
            status: { $in: ['pending', 'confirmed'] }
        }).select('playerName averageScore assignedSquads bowler').populate('bowler', '_id');

        // Organize bowlers by squad
        const squadData = tournament.squads.map(squad => {
            const bowlers = registrations
                .filter(reg => reg.assignedSquads && reg.assignedSquads.some(sid => sid.toString() === squad._id.toString()))
                .map(reg => ({
                    name: reg.playerName,
                    averageScore: reg.averageScore,
                    bowlerId: reg.bowler?._id
                }))
                .sort((a, b) => {
                    // Sort by average score descending, then by name
                    if (b.averageScore && a.averageScore) {
                        return b.averageScore - a.averageScore;
                    }
                    if (b.averageScore) return 1;
                    if (a.averageScore) return -1;
                    return a.name.localeCompare(b.name);
                });

            return {
                _id: squad._id,
                name: squad.name,
                date: squad.date,
                time: squad.time,
                capacity: squad.capacity,
                isQualifying: squad.isQualifying,
                registered: bowlers.length,
                spotsRemaining: squad.capacity - bowlers.length,
                bowlers: bowlers
            };
        });

        res.json({
            tournament: {
                _id: tournament._id,
                name: tournament.name,
                startDate: tournament.startDate,
                endDate: tournament.endDate,
                date: tournament.date || tournament.startDate, // Fallback for backwards compatibility
                location: tournament.location,
                squadsRequiredToQualify: tournament.squadsRequiredToQualify
            },
            squads: squadData
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
