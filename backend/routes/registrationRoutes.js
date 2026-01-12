import express from 'express';
import Registration from '../models/Registration.js';
import Tournament from '../models/Tournament.js';
import Bowler from '../models/Bowler.js';
import SpotReservation from '../models/SpotReservation.js';
import crypto from 'crypto';
import { sendRegistrationConfirmation } from '../utils/emailService.js';
import { 
    validateObjectId, 
    sanitizeEmail, 
    sanitizeString, 
    sanitizePhone,
    validateGender,
    validateInteger,
    validateObjectIdArray 
} from '../middleware/validation.js';
import {
    reservationLimiter,
    generalWriteLimiter,
    strictWriteLimiter,
    registrationLimiter
} from '../middleware/ratelimiters.js';
import { 
    requireAdmin 
} from '../middleware/auth.js';


const router = express.Router();

// POST create spot reservation (holds spots for 10 minutes)
router.post('/reservations', reservationLimiter, async (req, res) => {
    try {
        const { tournamentId, squads } = req.body;
        
        // Generate or use session ID
        let sessionId = req.session.reservationId;
        if (!sessionId) {
            sessionId = crypto.randomBytes(16).toString('hex');
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
router.get('/reservations/:sessionId', generalWriteLimiter, async (req, res) => {
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
router.get('/tournaments/:tournamentId/registrations/count', generalWriteLimiter, async (req, res) => {
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
router.get('/tournaments/:tournamentId/registrations', generalWriteLimiter, async (req, res) => {
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
router.get('/tournaments/:tournamentId/results', generalWriteLimiter, async (req, res) => {
    try {
        // Validate tournament ID
        const tournamentId = validateObjectId(req.params.tournamentId);
        if (!tournamentId) {
            return res.status(400).json({ error: 'Invalid tournament ID' });
        }
        
        const tournament = await Tournament.findById(tournamentId);
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
router.get('/registrations', generalWriteLimiter, requireAdmin, async (req, res) => {
    try {
        const filter = {};
        if (req.query.tournamentId) {
            const tournamentId = validateObjectId(req.query.tournamentId);
            if (tournamentId) {
                filter.tournament = tournamentId;
            }
        }
        if (req.query.status) {
            const status = sanitizeString(req.query.status, 20);
            if (status) {
                filter.status = status;
            }
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
router.get('/registrations/:id', generalWriteLimiter, requireAdmin, async (req, res) => {
    try {
        // Validate registration ID
        const registrationId = validateObjectId(req.params.id);
        if (!registrationId) {
            return res.status(400).json({ error: 'Invalid registration ID' });
        }
        
        const registration = await Registration.findById(registrationId)
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

        // Validate and sanitize inputs
        const validTournamentId = validateObjectId(tournamentId);
        if (!validTournamentId) {
            return res.status(400).json({ error: 'Invalid tournament ID' });
        }
        
        const sanitizedName = sanitizeString(playerName, 100);
        if (!sanitizedName || sanitizedName.length < 2) {
            return res.status(400).json({ error: 'Valid player name is required' });
        }
        
        const sanitizedEmail = sanitizeEmail(email);
        if (!sanitizedEmail) {
            return res.status(400).json({ error: 'Valid email is required' });
        }
        
        const sanitizedPhone = sanitizePhone(phone);
        if (!sanitizedPhone) {
            return res.status(400).json({ error: 'Valid phone number is required' });
        }
        
        const validGender = validateGender(gender);
        if (!validGender) {
            return res.status(400).json({ error: 'Valid gender selection is required' });
        }
        
        const validAverage = validateInteger(averageScore, 0, 300);
        const sanitizedNotes = sanitizeString(notes, 500);
        const validSquads = validateObjectIdArray(assignedSquads);

        // Verify tournament exists and is accepting registrations
        const tournament = await Tournament.findById(validTournamentId);
        if (!tournament) {
            return res.status(404).json({ error: 'Tournament not found' });
        }

        if (tournament.status !== 'upcoming') {
            return res.status(400).json({ error: 'This tournament is not accepting registrations' });
        }

        // Check if registration is manually closed
        if (tournament.registrationManuallyClosed) {
            return res.status(400).json({ error: 'Registration has been closed for this tournament' });
        }

        // Check if registration is open
        const now = new Date();
        const openDate = tournament.registrationOpenDate ? new Date(tournament.registrationOpenDate) : null;
        
        if (!tournament.registrationManuallyOpened && openDate && now < openDate) {
            return res.status(400).json({ error: 'Registration has not opened yet' });
        }

        // Check registration deadline
        if (tournament.registrationDeadline && new Date(tournament.registrationDeadline) < new Date()) {
            return res.status(400).json({ error: 'Registration deadline has passed' });
        }

        // Validate squad selections if tournament has squads
        if (tournament.squads && tournament.squads.length > 0) {
            if (!validSquads || validSquads.length === 0) {
                return res.status(400).json({ error: 'Please select at least one squad' });
            }

            // Validate each selected squad exists and has capacity
            for (const sanitizedSquadId of validSquads) {
                const squad = tournament.squads.id(sanitizedSquadId);
                if (!squad) {
                    return res.status(400).json({ error: 'Invalid squad selection' });
                }

                // Count current registrations for this squad
                // Using inline query construction to satisfy CodeQL taint analysis
                const registrationsWithSquad = await Registration.countDocuments({
                    tournament: validTournamentId,
                    status: { $in: ['pending', 'confirmed'] },
                    assignedSquads: sanitizedSquadId
                });

                if (registrationsWithSquad >= squad.capacity) {
                    return res.status(400).json({ error: `Squad "${squad.name}" is full. Please select different squads.` });
                }
            }

            // Validate qualifying squad requirement
            if (tournament.squadsRequiredToQualify > 0) {
                const qualifyingSquadsSelected = validSquads.filter(squadId => {
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
                tournament: validTournamentId,
                status: { $in: ['pending', 'confirmed'] }
            });

            if (currentCount >= tournament.maxParticipants) {
                return res.status(400).json({ error: 'Tournament is full', waitlistAvailable: true });
            }
        }

        // Check for duplicate registration
        const existingReg = await Registration.findOne({
            tournament: validTournamentId,
            email: sanitizedEmail
        });

        if (existingReg) {
            return res.status(400).json({ error: 'You have already registered for this tournament' });
        }

        // Find or create bowler profile
        let bowler = await Bowler.findOne({ email: sanitizedEmail });
        
        if (!bowler) {
            // Create new bowler profile
            bowler = new Bowler({
                email: sanitizedEmail,
                playerName: sanitizedName,
                phone: sanitizedPhone,
                gender: validGender,
                currentAverage: validAverage,
                tournamentsEntered: [{
                    tournament: validTournamentId,
                    registeredAt: new Date(),
                    status: 'registered'
                }]
            });
            await bowler.save();
        } else {
            // Update existing bowler
            bowler.playerName = sanitizedName;
            bowler.phone = sanitizedPhone;
            if (validGender) {
                bowler.gender = validGender;
            }
            if (validAverage) {
                bowler.currentAverage = validAverage;
            }
            
            // Add tournament to history if not already there
            const alreadyEntered = bowler.tournamentsEntered.some(
                t => t.tournament.toString() === validTournamentId
            );
            
            if (!alreadyEntered) {
                bowler.tournamentsEntered.push({
                    tournament: validTournamentId,
                    tournament: tournamentId,
                    registeredAt: new Date(),
                    status: 'registered'
                });
            }
            
            await bowler.save();
        }

        // Create registration
        const registration = new Registration({
            tournament: validTournamentId,
            bowler: bowler._id,
            playerName: sanitizedName,
            email: sanitizedEmail,
            phone: sanitizedPhone,
            gender: validGender,
            averageScore: validAverage,
            notes: sanitizedNotes,
            assignedSquads: validSquads || [],
            status: 'confirmed' // Auto-confirm for now
        });

        await registration.save();
        
        const populated = await Registration.findById(registration._id)
            .populate('tournament', 'name date location')
            .populate('bowler', 'playerName nickname email');
        
        // Send confirmation email asynchronously (don't wait for it)
        sendRegistrationConfirmation({
            to: sanitizedEmail,
            bowler: {
                name: sanitizedName
            },
            tournament: {
                name: tournament.name,
                startDate: tournament.startDate,
                location: tournament.location,
                entryFee: tournament.entryFee,
                paymentInstructions: tournament.paymentInstructions
            },
            squads: validSquads.map(squadId => {
                const squad = tournament.squads.id(squadId);
                return {
                    name: squad ? squad.name : 'Unknown Squad',
                    time: squad ? squad.time : ''
                };
            }),
            registrationId: registration._id.toString()
        }).catch(err => {
            console.error('Failed to send confirmation email:', err);
            // Don't fail the registration if email fails
        });
        
        res.status(201).json(populated);
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ error: 'You have already registered for this tournament' });
        }
        res.status(500).json({ error: error.message });
    }
});

// PUT update registration status (admin only)
router.put('/registrations/:id', strictWriteLimiter, requireAdmin, async (req, res) => {
    try {
        const { status, notes, stageScores, currentStage, carryoverToNextStage } = req.body;
        
        // Validate registration ID
        const registrationId = validateObjectId(req.params.id);
        if (!registrationId) {
            return res.status(400).json({ error: 'Invalid registration ID' });
        }
        
        console.log('PUT /registrations/:id - Received:', { 
            id: registrationId, 
            stageScores, 
            currentStage 
        });
        
        const registration = await Registration.findById(registrationId);
        if (!registration) {
            return res.status(404).json({ error: 'Registration not found' });
        }

        console.log('Registration before update:', {
            id: registration._id,
            currentStageScores: registration.stageScores
        });

        // Update basic fields with validation
        if (status !== undefined) {
            const validStatuses = ['pending', 'confirmed', 'cancelled', 'waitlist'];
            if (!validStatuses.includes(status)) {
                return res.status(400).json({ error: 'Invalid status value' });
            }
            registration.status = status;
        }
        if (notes !== undefined) {
            registration.notes = sanitizeString(notes, 500);
        }
        if (currentStage !== undefined) {
            const validStage = validateInteger(currentStage, 0, 100);
            if (validStage === null) {
                return res.status(400).json({ error: 'Invalid stage number' });
            }
            registration.currentStage = validStage;
        }

        // Handle stage-based scoring
        if (stageScores) {
            const { stageIndex, scores, bonusPins, handicap } = stageScores;
            
            // Validate stageIndex
            const validStageIndex = validateInteger(stageIndex, 0, 100);
            if (validStageIndex === null) {
                return res.status(400).json({ error: 'Invalid stage index' });
            }
            
            // Validate scores array
            if (!Array.isArray(scores) || scores.length === 0 || scores.length > 50) {
                return res.status(400).json({ error: 'Invalid scores array' });
            }
            
            // Validate each score (0-300 for bowling)
            const validScores = scores.map(score => validateInteger(score, 0, 300)).filter(s => s !== null);
            if (validScores.length !== scores.length) {
                return res.status(400).json({ error: 'Invalid score values' });
            }
            
            // Validate bonusPins if provided
            const validBonusPins = Array.isArray(bonusPins) 
                ? bonusPins.map(bp => validateInteger(bp, -100, 100)).filter(b => b !== null)
                : [];
            
            // Validate handicap
            const validHandicap = validateInteger(handicap, 0, 200) || 0;
            
            console.log('Processing stageScores:', { stageIndex: validStageIndex, scores: validScores, bonusPins: validBonusPins, handicap: validHandicap });
            
            // Find or create stage score entry
            let stageScoreEntry = registration.stageScores.find(s => s.stageIndex === validStageIndex);
            
            if (stageScoreEntry) {
                stageScoreEntry.scores = validScores;
                stageScoreEntry.bonusPins = validBonusPins;
                stageScoreEntry.handicap = validHandicap;
                stageScoreEntry.total = validScores.reduce((sum, s) => sum + s, 0);
                console.log('Updated existing stage entry:', stageScoreEntry);
            } else {
                const newEntry = {
                    stageIndex: validStageIndex,
                    scores: validScores,
                    bonusPins: validBonusPins,
                    handicap: validHandicap,
                    total: validScores.reduce((sum, s) => sum + s, 0),
                    carryover: 0
                };
                registration.stageScores.push(newEntry);
                console.log('Created new stage entry:', newEntry);
            }
        }

        // Handle carryover to next stage
        if (carryoverToNextStage !== undefined && currentStage !== undefined) {
            // Validate carryover value
            const validCarryover = validateInteger(carryoverToNextStage, 0, 10000);
            if (validCarryover === null) {
                return res.status(400).json({ error: 'Invalid carryover value' });
            }
            
            // Validate currentStage
            const validCurrentStage = validateInteger(currentStage, 0, 100);
            if (validCurrentStage === null) {
                return res.status(400).json({ error: 'Invalid current stage' });
            }
            
            // Add carryover to the next stage entry
            let nextStageEntry = registration.stageScores.find(s => s.stageIndex === validCurrentStage);
            
            if (nextStageEntry) {
                nextStageEntry.carryover = validCarryover;
            } else {
                registration.stageScores.push({
                    stageIndex: validCurrentStage,
                    scores: [],
                    total: 0,
                    carryover: validCarryover
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

// PUT update payment status (admin only)
router.put('/registrations/:id/payment-status', strictWriteLimiter, requireAdmin, async (req, res) => {
    try {
        // Validate registration ID
        const registrationId = validateObjectId(req.params.id);
        if (!registrationId) {
            return res.status(400).json({ error: 'Invalid registration ID' });
        }
        
        const { paymentStatus } = req.body;
        
        // Validate payment status with type checking
        const validPaymentStatuses = ['unpaid', 'deposit', 'paid'];
        if (typeof paymentStatus !== 'string' || !validPaymentStatuses.includes(paymentStatus)) {
            return res.status(400).json({ error: 'Invalid payment status' });
        }
        
        const sanitizedPaymentStatus = paymentStatus.trim().toLowerCase();
        
        const registration = await Registration.findByIdAndUpdate(
            registrationId,
            { paymentStatus: sanitizedPaymentStatus },
            { new: true }
        ).populate('tournament', 'name');
        
        if (!registration) return res.status(404).json({ error: 'Registration not found' });
        res.json(registration);
    } catch (error) {
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

        // Validate registration ID
        const registrationId = validateObjectId(req.params.id);
        if (!registrationId) {
            return res.status(400).json({ error: 'Invalid registration ID' });
        }

        const registration = await Registration.findById(registrationId);
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
        
        // Validate and sanitize squad IDs
        const validSquads = validateObjectIdArray(assignedSquads);

        // Validate squad availability
        if (validSquads && validSquads.length > 0) {
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
            for (const sanitizedSquadId of validSquads) {
                const squad = tournament.squads.find(s => s._id.toString() === sanitizedSquadId);
                if (!squad) {
                    return res.status(400).json({ error: 'Invalid squad selected' });
                }
                const currentCount = squadCounts[sanitizedSquadId] || 0;
                if (currentCount >= squad.capacity) {
                    return res.status(400).json({ error: `Squad ${squad.name} is full` });
                }
            }
        }

        registration.assignedSquads = validSquads || [];
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

        // Validate registration ID
        const registrationId = validateObjectId(req.params.id);
        if (!registrationId) {
            return res.status(400).json({ error: 'Invalid registration ID' });
        }

        const registration = await Registration.findById(registrationId);
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

        await Registration.findByIdAndDelete(registrationId);

        res.json({ message: 'Registration cancelled successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE registration (admin only)
router.delete('/registrations/:id', strictWriteLimiter, requireAdmin, async (req, res) => {
    try {
        // Validate registration ID
        const registrationId = validateObjectId(req.params.id);
        if (!registrationId) {
            return res.status(400).json({ error: 'Invalid registration ID' });
        }
        
        const registration = await Registration.findByIdAndDelete(registrationId);
        
        if (!registration) {
            return res.status(404).json({ error: 'Registration not found' });
        }

        res.json({ message: 'Registration deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
