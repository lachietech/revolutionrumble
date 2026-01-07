import express from 'express';
import Registration from '../models/Registration.js';
import Tournament from '../models/Tournament.js';
import Bowler from '../models/Bowler.js';
import SpotReservation from '../models/SpotReservation.js';
import rateLimit from 'express-rate-limit';

const router = express.Router();

<<<<<<< HEAD
// Rate limiters
const reservationLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 10, // 10 reservation requests per minute per IP
    message: 'Too many reservation requests, please try again later',
    standardHeaders: true,
    legacyHeaders: false
});

const registrationLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 10, // 10 registration submissions per 5 minutes per IP
    message: 'Too many registration attempts, please try again later',
    standardHeaders: true,
    legacyHeaders: false
});

const generalWriteLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 30, // 30 write operations per minute per IP
    message: 'Too many requests, please try again later',
    standardHeaders: true,
    legacyHeaders: false
});

const strictWriteLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 20, // 20 admin operations per minute per IP
    message: 'Too many requests, please try again later',
    standardHeaders: true,
    legacyHeaders: false
=======
const adminDeleteLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 20, // limit each admin IP to 20 delete requests per windowMs
>>>>>>> 3efd3d3f615b87808b780ca6308991a492326021
});

// Middleware to check admin
function requireAdmin(req, res, next) {
    if (req.session && req.session.isAdmin) return next();
    return res.status(403).json({ error: 'Admin access required' });
}

// POST create spot reservation (holds spots for 10 minutes)
router.post('/reservations', reservationLimiter, async (req, res) => {
    try {
        const { tournamentId, squads } = req.body;
        
        // Generate or use session ID
        let sessionId = req.session.reservationId;
        if (!sessionId) {
            sessionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            req.session.reservationId = sessionId;
        }
        
        // Check if session already has an active reservation
        const existingReservation = await SpotReservation.findOne({
            sessionId,
            expiresAt: { $gt: new Date() }
        });
        
        if (existingReservation) {
            return res.json({ 
                reservation: existingReservation,
                message: 'Using existing reservation'
            });
        }
        
        // Create new reservation (expires in 10 minutes)
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
        const reservation = new SpotReservation({
            tournament: tournamentId,
            squads: squads || [],
            sessionId,
            expiresAt
        });
        
        await reservation.save();
        
        res.json({ 
            reservation,
            expiresAt,
            message: 'Spot reserved for 10 minutes'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET check reservation status
router.get('/reservations/:sessionId', async (req, res) => {
    try {
        const reservation = await SpotReservation.findOne({
            sessionId: req.params.sessionId,
            expiresAt: { $gt: new Date() }
        });
        
        if (!reservation) {
            return res.status(404).json({ error: 'Reservation not found or expired' });
        }
        
        const timeRemaining = Math.max(0, Math.floor((reservation.expiresAt - new Date()) / 1000));
        
        res.json({ 
            reservation,
            timeRemaining,
            expiresAt: reservation.expiresAt
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE release reservation
router.delete('/reservations/:sessionId', reservationLimiter, async (req, res) => {
    try {
        await SpotReservation.deleteOne({ sessionId: req.params.sessionId });
        res.json({ success: true, message: 'Reservation released' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 
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

// GET registrations for a tournament (public - for results page)
router.get('/tournaments/:tournamentId/registrations', async (req, res) => {
    try {
        const registrations = await Registration.find({
            tournament: req.params.tournamentId,
            status: { $in: ['pending', 'confirmed'] }
        })
            .populate('bowler', '_id')
            .select('playerName email bowler assignedSquads')
            .sort({ playerName: 1 });
        
        res.json(registrations);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET tournament results with stage scores (public - for results leaderboard)
router.get('/tournaments/:tournamentId/results', async (req, res) => {
    try {
        const tournament = await Tournament.findById(req.params.tournamentId);
        if (!tournament) {
            return res.status(404).json({ error: 'Tournament not found' });
        }

        const registrations = await Registration.find({
            tournament: req.params.tournamentId,
            status: { $in: ['pending', 'confirmed'] }
        })
            .select('playerName email gender averageScore assignedSquads stageScores currentStage')
            .sort({ playerName: 1 });

        // Format results by stage
        const stages = tournament.format?.stages || [];
        const hasStages = tournament.format?.hasStages && stages.length > 0;

        if (hasStages) {
            // Multi-stage tournament
            const stageResults = stages.map((stage, stageIndex) => {
                const stagePlayers = registrations
                    .map(reg => {
                        const stageScore = reg.stageScores?.find(s => s.stageIndex === stageIndex);
                        if (!stageScore || !stageScore.scores || stageScore.scores.length === 0) return null;

                        // Calculate scratch total
                        const scratchTotal = stageScore.scores.reduce((sum, s) => sum + s, 0);
                        
                        // Calculate handicap (only if tournament allows it)
                        let totalHandicapPerGame = 0;
                        let totalHandicap = 0;
                        
                        if (tournament.format?.useHandicap) {
                            const baseScore = tournament.format.handicapBase || 220;
                            const handicapPct = tournament.format.handicapPercentage || 90;
                            const avgScore = reg.averageScore || 180;
                            const handicapPerGame = avgScore < baseScore ? Math.round((baseScore - avgScore) * (handicapPct / 100)) : 0;
                            
                            // Female bonus only if NOT separate divisions
                            const femaleBonus = (reg.gender === 'female' && !tournament.format.separateDivisions) 
                                ? (tournament.format.femaleHandicapPins || 8) 
                                : 0;
                            
                            totalHandicapPerGame = handicapPerGame + femaleBonus;
                            totalHandicap = totalHandicapPerGame * stageScore.scores.length;
                        }
                        
                        // Calculate bonus pins (matchplay)
                        const totalBonus = stageScore.bonusPins ? stageScore.bonusPins.reduce((sum, b) => sum + b, 0) : 0;
                        
                        // Grand total with handicap, bonus, and carryover
                        const grandTotal = scratchTotal + totalHandicap + totalBonus + (stageScore.carryover || 0);
                        const avg = stageScore.scores.length > 0 ? scratchTotal / stageScore.scores.length : 0;

                        return {
                            playerName: reg.playerName,
                            squadIds: reg.assignedSquads || [],
                            scores: stageScore.scores,
                            bonusPins: stageScore.bonusPins || [],
                            handicapPerGame: totalHandicapPerGame,
                            totalHandicap: totalHandicap,
                            totalBonus: totalBonus,
                            scratchTotal: scratchTotal,
                            carryover: stageScore.carryover || 0,
                            total: grandTotal,
                            average: Math.round(avg),
                            high: stageScore.scores.length > 0 ? Math.max(...stageScore.scores) : 0,
                            gamesPlayed: stageScore.scores.length
                        };
                    })
                    .filter(p => p !== null)
                    .sort((a, b) => b.total - a.total)
                    .map((p, i) => ({ ...p, position: i + 1 }));

                return {
                    stageName: stage.name,
                    stageIndex,
                    games: stage.games,
                    advancingBowlers: stage.advancingBowlers,
                    players: stagePlayers
                };
            });

            res.json({
                tournament: {
                    _id: tournament._id,
                    name: tournament.name,
                    date: tournament.startDate || tournament.date,
                    location: tournament.location,
                    squads: tournament.squads
                },
                hasStages: true,
                stages: stageResults
            });
        } else {
            // Single stage tournament
            const players = registrations
                .map(reg => {
                    const stageScore = reg.stageScores?.[0];
                    if (!stageScore || !stageScore.scores || stageScore.scores.length === 0) return null;

                    // Calculate scratch total
                    const scratchTotal = stageScore.scores.reduce((sum, s) => sum + s, 0);
                    
                    // Calculate handicap (only if tournament allows it)
                    let totalHandicapPerGame = 0;
                    let totalHandicap = 0;
                    
                    if (tournament.format?.useHandicap) {
                        const baseScore = tournament.format.handicapBase || 220;
                        const handicapPct = tournament.format.handicapPercentage || 90;
                        const avgScore = reg.averageScore || 180;
                        const handicapPerGame = avgScore < baseScore ? Math.round((baseScore - avgScore) * (handicapPct / 100)) : 0;
                        
                        // Female bonus only if NOT separate divisions
                        const femaleBonus = (reg.gender === 'female' && !tournament.format.separateDivisions) 
                            ? (tournament.format.femaleHandicapPins || 8) 
                            : 0;
                        
                        totalHandicapPerGame = handicapPerGame + femaleBonus;
                        totalHandicap = totalHandicapPerGame * stageScore.scores.length;
                    }
                    
                    // Calculate bonus pins
                    const totalBonus = stageScore.bonusPins ? stageScore.bonusPins.reduce((sum, b) => sum + b, 0) : 0;
                    
                    // Grand total with handicap and bonus
                    const grandTotal = scratchTotal + totalHandicap + totalBonus;
                    const avg = stageScore.scores.length > 0 ? scratchTotal / stageScore.scores.length : 0;

                    return {
                        playerName: reg.playerName,
                        squadIds: reg.assignedSquads || [],
                        scores: stageScore.scores,
                        bonusPins: stageScore.bonusPins || [],
                        handicapPerGame: totalHandicapPerGame,
                        totalHandicap: totalHandicap,
                        totalBonus: totalBonus,
                        scratchTotal: scratchTotal,
                        total: grandTotal,
                        average: Math.round(avg),
                        high: stageScore.scores.length > 0 ? Math.max(...stageScore.scores) : 0,
                        gamesPlayed: stageScore.scores.length
                    };
                })
                .filter(p => p !== null)
                .sort((a, b) => b.total - a.total)
                .map((p, i) => ({ ...p, position: i + 1 }));

            res.json({
                tournament: {
                    _id: tournament._id,
                    name: tournament.name,
                    date: tournament.startDate || tournament.date,
                    location: tournament.location,
                    squads: tournament.squads
                },
                hasStages: false,
                players
            });
        }
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
router.post('/registrations', registrationLimiter, async (req, res) => {
    try {
        const { tournamentId, playerName, email, phone, gender, averageScore, notes, assignedSquads } = req.body;

        // Validate gender
        if (!gender || !['male', 'female'].includes(gender)) {
            return res.status(400).json({ error: 'Valid gender selection is required' });
        }

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

                // If re-entry is NOT allowed, cap squad selection to squadsRequiredToQualify
                if (tournament.allowReentry === false) {
                    if (qualifyingSquadsSelected > tournament.squadsRequiredToQualify) {
                        return res.status(400).json({ 
                            error: `Re-entry is not allowed. You can only register for ${tournament.squadsRequiredToQualify} qualifying squad${tournament.squadsRequiredToQualify > 1 ? 's' : ''}` 
                        });
                    }
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

        // Find or create bowler profile
        let bowler = await Bowler.findOne({ email: email.toLowerCase() });
        
        if (!bowler) {
            // Create new bowler profile
            bowler = new Bowler({
                email: email.toLowerCase(),
                playerName,
                phone,
                currentAverage: averageScore,
                tournamentsEntered: [{
                    tournament: tournamentId,
                    registeredAt: new Date(),
                    status: 'registered'
                }]
            });
            await bowler.save();
        } else {
            // Update existing bowler
            bowler.playerName = playerName; // Update name in case it changed
            bowler.phone = phone;
            if (averageScore) {
                bowler.currentAverage = averageScore;
            }
            
            // Add tournament to history if not already there
            const alreadyEntered = bowler.tournamentsEntered.some(
                t => t.tournament.toString() === tournamentId
            );
            
            if (!alreadyEntered) {
                bowler.tournamentsEntered.push({
                    tournament: tournamentId,
                    registeredAt: new Date(),
                    status: 'registered'
                });
            }
            
            await bowler.save();
        }

        // Create registration
        const registration = new Registration({
            tournament: tournamentId,
            bowler: bowler._id,
            playerName,
            email,
            phone,
            gender,
            averageScore,
            notes,
            assignedSquads: assignedSquads || [],
            status: 'confirmed' // Auto-confirm for now
        });

        await registration.save();
        
        const populated = await Registration.findById(registration._id)
            .populate('tournament', 'name date location')
            .populate('bowler', 'playerName nickname email');
        
        res.status(201).json(populated);
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ error: 'You have already registered for this tournament' });
        }
        res.status(500).json({ error: error.message });
    }
});

// PUT update registration status (admin only)
router.put('/registrations/:id', requireAdmin, strictWriteLimiter, async (req, res) => {
    try {
        const { status, notes, stageScores, currentStage, carryoverToNextStage } = req.body;
        
        console.log('PUT /registrations/:id - Received:', { 
            id: req.params.id, 
            stageScores, 
            currentStage 
        });
        
        const registration = await Registration.findById(req.params.id);
        if (!registration) {
            return res.status(404).json({ error: 'Registration not found' });
        }

        console.log('Registration before update:', {
            id: registration._id,
            currentStageScores: registration.stageScores
        });

        // Update basic fields
        if (status !== undefined) registration.status = status;
        if (notes !== undefined) registration.notes = notes;
        if (currentStage !== undefined) registration.currentStage = currentStage;

        // Handle stage-based scoring
        if (stageScores) {
            const { stageIndex, scores, bonusPins, handicap } = stageScores;
            
            console.log('Processing stageScores:', { stageIndex, scores, bonusPins, handicap });
            
            // Find or create stage score entry
            let stageScoreEntry = registration.stageScores.find(s => s.stageIndex === stageIndex);
            
            if (stageScoreEntry) {
                stageScoreEntry.scores = scores;
                stageScoreEntry.bonusPins = bonusPins || [];
                stageScoreEntry.handicap = handicap || 0;
                stageScoreEntry.total = scores.reduce((sum, s) => sum + s, 0);
                console.log('Updated existing stage entry:', stageScoreEntry);
            } else {
                const newEntry = {
                    stageIndex,
                    scores,
                    bonusPins: bonusPins || [],
                    handicap: handicap || 0,
                    total: scores.reduce((sum, s) => sum + s, 0),
                    carryover: 0
                };
                registration.stageScores.push(newEntry);
                console.log('Created new stage entry:', newEntry);
            }
        }

        // Handle carryover to next stage
        if (carryoverToNextStage !== undefined && currentStage !== undefined) {
            // Add carryover to the next stage entry
            let nextStageEntry = registration.stageScores.find(s => s.stageIndex === currentStage);
            
            if (nextStageEntry) {
                nextStageEntry.carryover = carryoverToNextStage;
            } else {
                registration.stageScores.push({
                    stageIndex: currentStage,
                    scores: [],
                    total: 0,
                    carryover: carryoverToNextStage
                });
            }
        }

        await registration.save();
        await registration.populate('tournament');

        console.log('Registration after save:', {
            id: registration._id,
            stageScores: registration.stageScores
        });

        res.json(registration);
    } catch (error) {
        console.error('Error updating registration:', error);
        res.status(500).json({ error: error.message });
    }
});

// PUT update bowler's own registration (bowler must be authenticated)
router.put('/registrations/:id/squads', generalWriteLimiter, async (req, res) => {
    try {
        // Check if bowler is authenticated
        if (!req.session || !req.session.bowlerId) {
            return res.status(403).json({ error: 'Authentication required' });
        }

        const registration = await Registration.findById(req.params.id);
        if (!registration) {
            return res.status(404).json({ error: 'Registration not found' });
        }

        // Verify this registration belongs to the authenticated bowler
        const bowler = await Bowler.findById(req.session.bowlerId);
        if (registration.email !== bowler.email) {
            return res.status(403).json({ error: 'You can only modify your own registrations' });
        }

        // Only allow squad changes for upcoming tournaments
        const tournament = await Tournament.findById(registration.tournament);
        if (tournament.status !== 'upcoming') {
            return res.status(400).json({ error: 'Cannot modify registration for tournaments that have started or completed' });
        }

        const { assignedSquads } = req.body;

        // Validate squad availability
        if (assignedSquads && assignedSquads.length > 0) {
            // Get current registrations per squad
            const allRegistrations = await Registration.find({
                tournament: registration.tournament,
                status: { $in: ['pending', 'confirmed'] },
                _id: { $ne: registration._id } // Exclude current registration
            });

            const squadCounts = {};
            allRegistrations.forEach(reg => {
                if (reg.assignedSquads && reg.assignedSquads.length > 0) {
                    reg.assignedSquads.forEach(squadId => {
                        const id = squadId.toString();
                        squadCounts[id] = (squadCounts[id] || 0) + 1;
                    });
                }
            });

            // Check availability for requested squads
            for (const squadId of assignedSquads) {
                const squad = tournament.squads.find(s => s._id.toString() === squadId);
                if (!squad) {
                    return res.status(400).json({ error: 'Invalid squad selected' });
                }
                const currentCount = squadCounts[squadId] || 0;
                if (currentCount >= squad.capacity) {
                    return res.status(400).json({ error: `Squad ${squad.name} is full` });
                }
            }
        }

        registration.assignedSquads = assignedSquads;
        await registration.save();
        await registration.populate('tournament');
        await registration.populate('assignedSquads');

        res.json(registration);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE bowler's own registration (bowler must be authenticated)
router.delete('/registrations/:id/cancel', generalWriteLimiter, async (req, res) => {
    try {
        // Check if bowler is authenticated
        if (!req.session || !req.session.bowlerId) {
            return res.status(403).json({ error: 'Authentication required' });
        }

        const registration = await Registration.findById(req.params.id);
        if (!registration) {
            return res.status(404).json({ error: 'Registration not found' });
        }

        // Verify this registration belongs to the authenticated bowler
        const bowler = await Bowler.findById(req.session.bowlerId);
        if (registration.email !== bowler.email) {
            return res.status(403).json({ error: 'You can only cancel your own registrations' });
        }

        // Only allow cancellation for upcoming tournaments
        const tournament = await Tournament.findById(registration.tournament);
        if (tournament.status !== 'upcoming') {
            return res.status(400).json({ error: 'Cannot cancel registration for tournaments that have started or completed' });
        }

        await Registration.findByIdAndDelete(req.params.id);

        res.json({ message: 'Registration cancelled successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE registration (admin only)
<<<<<<< HEAD
router.delete('/registrations/:id', requireAdmin, strictWriteLimiter, async (req, res) => {
=======
router.delete('/registrations/:id', requireAdmin, adminDeleteLimiter, async (req, res) => {
>>>>>>> 3efd3d3f615b87808b780ca6308991a492326021
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
