import express from 'express';
import Registration from '../models/Registration.js';
import Tournament from '../models/Tournament.js';

const router = express.Router();

// Middleware to check admin
function requireAdmin(req, res, next) {
    if (req.session && req.session.isAdmin) return next();
    return res.status(403).json({ error: 'Admin access required' });
}

// GET all registrations for a specific tournament (public - for displaying count)
router.get('/tournaments/:tournamentId/registrations/count', async (req, res) => {
    try {
        const count = await Registration.countDocuments({
            tournament: req.params.tournamentId,
            status: { $in: ['pending', 'confirmed'] }
        });
        res.json({ count });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET all registrations (admin only - with optional tournament filter)
router.get('/registrations', requireAdmin, async (req, res) => {
    try {
        const filter = {};
        if (req.query.tournamentId) {
            filter.tournament = req.query.tournamentId;
        }
        if (req.query.status) {
            filter.status = req.query.status;
        }

        const registrations = await Registration.find(filter)
            .populate('tournament', 'name date location')
            .sort({ createdAt: -1 });
        
        res.json(registrations);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET single registration (admin only)
router.get('/registrations/:id', requireAdmin, async (req, res) => {
    try {
        const registration = await Registration.findById(req.params.id)
            .populate('tournament');
        
        if (!registration) {
            return res.status(404).json({ error: 'Registration not found' });
        }
        
        res.json(registration);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST new registration (public)
router.post('/registrations', async (req, res) => {
    try {
        const { tournamentId, playerName, email, phone, averageScore, notes, assignedSquads } = req.body;

        // Verify tournament exists and is accepting registrations
        const tournament = await Tournament.findById(tournamentId);
        if (!tournament) {
            return res.status(404).json({ error: 'Tournament not found' });
        }

        if (tournament.status !== 'upcoming') {
            return res.status(400).json({ error: 'This tournament is not accepting registrations' });
        }

        // Check registration deadline
        if (tournament.registrationDeadline && new Date(tournament.registrationDeadline) < new Date()) {
            return res.status(400).json({ error: 'Registration deadline has passed' });
        }

        // Validate squad selections if tournament has squads
        if (tournament.squads && tournament.squads.length > 0) {
            if (!assignedSquads || assignedSquads.length === 0) {
                return res.status(400).json({ error: 'Please select at least one squad' });
            }

            // Validate each selected squad exists and has capacity
            for (const squadId of assignedSquads) {
                const squad = tournament.squads.id(squadId);
                if (!squad) {
                    return res.status(400).json({ error: 'Invalid squad selection' });
                }

                // Count current registrations for this squad
                const registrationsWithSquad = await Registration.countDocuments({
                    tournament: tournamentId,
                    status: { $in: ['pending', 'confirmed'] },
                    assignedSquads: squadId
                });

                if (registrationsWithSquad >= squad.capacity) {
                    return res.status(400).json({ error: `Squad "${squad.name}" is full. Please select different squads.` });
                }
            }

            // Validate qualifying squad requirement
            if (tournament.squadsRequiredToQualify > 0) {
                const qualifyingSquadsSelected = assignedSquads.filter(squadId => {
                    const squad = tournament.squads.id(squadId);
                    return squad && squad.isQualifying;
                }).length;

                if (qualifyingSquadsSelected < tournament.squadsRequiredToQualify) {
                    return res.status(400).json({ 
                        error: `Must select at least ${tournament.squadsRequiredToQualify} qualifying squad${tournament.squadsRequiredToQualify > 1 ? 's' : ''}` 
                    });
                }
            }
        }

        // Check if tournament is full (overall capacity)
        if (tournament.maxParticipants) {
            const currentCount = await Registration.countDocuments({
                tournament: tournamentId,
                status: { $in: ['pending', 'confirmed'] }
            });

            if (currentCount >= tournament.maxParticipants) {
                return res.status(400).json({ error: 'Tournament is full', waitlistAvailable: true });
            }
        }

        // Check for duplicate registration
        const existingReg = await Registration.findOne({
            tournament: tournamentId,
            email: email.toLowerCase()
        });

        if (existingReg) {
            return res.status(400).json({ error: 'You have already registered for this tournament' });
        }

        // Create registration
        const registration = new Registration({
            tournament: tournamentId,
            playerName,
            email,
            phone,
            averageScore,
            notes,
            assignedSquads: assignedSquads || [],
            status: 'confirmed' // Auto-confirm for now
        });

        await registration.save();
        
        const populated = await Registration.findById(registration._id)
            .populate('tournament', 'name date location');
        
        res.status(201).json(populated);
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ error: 'You have already registered for this tournament' });
        }
        res.status(500).json({ error: error.message });
    }
});

// PUT update registration status (admin only)
router.put('/registrations/:id', requireAdmin, async (req, res) => {
    try {
        const { status, notes } = req.body;
        
        const registration = await Registration.findByIdAndUpdate(
            req.params.id,
            { status, notes },
            { new: true, runValidators: true }
        ).populate('tournament');

        if (!registration) {
            return res.status(404).json({ error: 'Registration not found' });
        }

        res.json(registration);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE registration (admin only)
router.delete('/registrations/:id', requireAdmin, async (req, res) => {
    try {
        const registration = await Registration.findByIdAndDelete(req.params.id);
        
        if (!registration) {
            return res.status(404).json({ error: 'Registration not found' });
        }

        res.json({ message: 'Registration deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
