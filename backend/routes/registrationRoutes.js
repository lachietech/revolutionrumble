import express from 'express';
import Registration from '../models/Registration.js';
import Tournament from '../models/Tournament.js';
import Bowler from '../models/Bowler.js';

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
            .select('playerName email assignedSquads stageScores currentStage')
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

                        const total = stageScore.scores.reduce((sum, s) => sum + s, 0);
                        const grandTotal = total + (stageScore.carryover || 0);
                        const avg = stageScore.scores.length > 0 ? total / stageScore.scores.length : 0;

                        return {
                            playerName: reg.playerName,
                            squadIds: reg.assignedSquads || [],
                            scores: stageScore.scores,
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

                    const total = stageScore.scores.reduce((sum, s) => sum + s, 0);
                    const avg = stageScore.scores.length > 0 ? total / stageScore.scores.length : 0;

                    return {
                        playerName: reg.playerName,
                        squadIds: reg.assignedSquads || [],
                        scores: stageScore.scores,
                        total,
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
router.post('/registrations', async (req, res) => {
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
router.put('/registrations/:id', requireAdmin, async (req, res) => {
    try {
        const { status, notes, stageScores, currentStage, carryoverToNextStage } = req.body;
        
        const registration = await Registration.findById(req.params.id);
        if (!registration) {
            return res.status(404).json({ error: 'Registration not found' });
        }

        // Update basic fields
        if (status !== undefined) registration.status = status;
        if (notes !== undefined) registration.notes = notes;
        if (currentStage !== undefined) registration.currentStage = currentStage;

        // Handle stage-based scoring
        if (stageScores) {
            const { stageIndex, scores } = stageScores;
            
            // Find or create stage score entry
            let stageScoreEntry = registration.stageScores.find(s => s.stageIndex === stageIndex);
            
            if (stageScoreEntry) {
                stageScoreEntry.scores = scores;
                stageScoreEntry.total = scores.reduce((sum, s) => sum + s, 0);
            } else {
                registration.stageScores.push({
                    stageIndex,
                    scores,
                    total: scores.reduce((sum, s) => sum + s, 0),
                    carryover: 0
                });
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
