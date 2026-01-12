import express from 'express';
import Tournament from '../models/Tournament.js';
import Registration from '../models/Registration.js';
import SpotReservation from '../models/SpotReservation.js';
import { 
    validateObjectId 
} from '../middleware/validation.js';
import {
    generalWriteLimiter,
    strictWriteLimiter
} from '../middleware/ratelimiters.js';
import { 
    requireAdmin 
} from '../middleware/auth.js';

const router = express.Router();
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
        // Validate tournament ID
        const tournamentId = validateObjectId(req.params.id);
        if (!tournamentId) {
            return res.status(400).json({ error: 'Invalid tournament ID' });
        }
        
        // Build sanitized update object explicitly field by field
        const updateData = {};
        
        // String fields - sanitize
        if (req.body.name !== undefined && typeof req.body.name === 'string') {
            updateData.name = req.body.name.replace(/\$/g, '');
        }
        if (req.body.description !== undefined && typeof req.body.description === 'string') {
            updateData.description = req.body.description.replace(/\$/g, '');
        }
        if (req.body.location !== undefined && typeof req.body.location === 'string') {
            updateData.location = req.body.location.replace(/\$/g, '');
        }
        if (req.body.paymentInstructions !== undefined && typeof req.body.paymentInstructions === 'string') {
            updateData.paymentInstructions = req.body.paymentInstructions.replace(/\$/g, '');
        }
        
        // Date fields
        if (req.body.startDate !== undefined) {
            updateData.startDate = req.body.startDate;
        }
        if (req.body.endDate !== undefined) {
            updateData.endDate = req.body.endDate;
        }
        
        // Numeric fields
        if (req.body.entryFee !== undefined && typeof req.body.entryFee === 'number') {
            updateData.entryFee = req.body.entryFee;
        }
        if (req.body.maxParticipants !== undefined && typeof req.body.maxParticipants === 'number') {
            updateData.maxParticipants = req.body.maxParticipants;
        }
        if (req.body.squadsRequiredToQualify !== undefined && typeof req.body.squadsRequiredToQualify === 'number') {
            updateData.squadsRequiredToQualify = req.body.squadsRequiredToQualify;
        }
        
        // Registration control date fields
        if (req.body.registrationOpenDate !== undefined) {
            updateData.registrationOpenDate = req.body.registrationOpenDate;
        }
        if (req.body.registrationDeadline !== undefined) {
            updateData.registrationDeadline = req.body.registrationDeadline;
        }
        if (req.body.registrationManuallyOpened !== undefined && typeof req.body.registrationManuallyOpened === 'boolean') {
            updateData.registrationManuallyOpened = req.body.registrationManuallyOpened;
        }
        
        // Boolean fields
        if (req.body.allowReentry !== undefined && typeof req.body.allowReentry === 'boolean') {
            updateData.allowReentry = req.body.allowReentry;
        }
        
        // Status - allowlist validation
        if (req.body.status !== undefined) {
            const validStatuses = ['upcoming', 'active', 'completed', 'cancelled'];
            if (validStatuses.includes(req.body.status)) {
                updateData.status = req.body.status;
            }
        }
        
        // Format object
        if (req.body.format !== undefined && typeof req.body.format === 'object') {
            updateData.format = req.body.format;
        }
        
        // Squads array - needs deep sanitization
        if (req.body.squads !== undefined && Array.isArray(req.body.squads)) {
            updateData.squads = req.body.squads;
        }
        
        const tournament = await Tournament.findByIdAndUpdate(
            tournamentId,
            { $set: updateData },
            { new: true, runValidators: true }
        );
        if (!tournament) return res.status(404).json({ error: 'Tournament not found' });
        res.json(tournament);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// POST manually open registration for a tournament (admin only)
router.post('/tournaments/:id/open-registration', strictWriteLimiter, requireAdmin, async (req, res) => {
    try {
        // Validate tournament ID
        const tournamentId = validateObjectId(req.params.id);
        if (!tournamentId) {
            return res.status(400).json({ error: 'Invalid tournament ID' });
        }
        
        const tournament = await Tournament.findByIdAndUpdate(
            tournamentId,
            { $set: { registrationManuallyOpened: true } },
            { new: true }
        );
        
        if (!tournament) {
            return res.status(404).json({ error: 'Tournament not found' });
        }
        
        res.json({ 
            message: 'Registration opened successfully',
            tournament 
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
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
                squadsRequiredToQualify: tournament.squadsRequiredToQualify,
                allowReentry: tournament.allowReentry
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
