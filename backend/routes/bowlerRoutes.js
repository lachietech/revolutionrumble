import express from 'express';
import Bowler from '../models/Bowler.js';
import Registration from '../models/Registration.js';
import TournamentResult from '../models/TournamentResult.js';
import Tournament from '../models/Tournament.js';
import { Resend } from 'resend';

const router = express.Router();

// Initialize Resend client (lazy initialization to ensure env vars are loaded)
let resend;
function getResendClient() {
    if (!resend) {
        if (!process.env.RESEND_API_KEY) {
            throw new Error('RESEND_API_KEY not configured');
        }
        resend = new Resend(process.env.RESEND_API_KEY);
    }
    return resend;
}

// Middleware to check admin
function requireAdmin(req, res, next) {
    if (req.session && req.session.isAdmin) return next();
    return res.status(403).json({ error: 'Admin access required' });
}

// Middleware to check bowler authentication
function requireBowlerAuth(req, res, next) {
    if (req.session && req.session.bowlerId) return next();
    return res.status(403).json({ error: 'Authentication required' });
}

// TEST ENDPOINT - Verify Resend is working
router.get('/test-email', async (req, res) => {
    try {
        const resendClient = getResendClient();
        const result = await resendClient.emails.send({
            from: 'Revolution Rumble <noreply@nielseninnovations.com>',
            to: req.query.email || 'test@example.com',
            subject: 'Test Email from Revolution Rumble',
            html: '<h1>Test Email</h1><p>If you receive this, Resend is working!</p>'
        });
        res.json({ success: true, result });
    } catch (error) {
        console.error('Test email failed:', error);
        res.status(500).json({ error: error.message, details: error });
    }
});

// POST request OTP code via email
router.post('/bowlers/request-otp', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ error: 'Email required' });
        }

        // Find or create bowler
        let bowler = await Bowler.findOne({ email: email.toLowerCase() });
        
        // Generate 6-digit OTP
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        if (!bowler) {
            // Create new bowler record with OTP
            bowler = new Bowler({
                email: email.toLowerCase(),
                playerName: '', // Will be filled in later
                otpCode,
                otpExpires,
                otpAttempts: 0
            });
        } else {
            // Update existing bowler with new OTP
            bowler.otpCode = otpCode;
            bowler.otpExpires = otpExpires;
            bowler.otpAttempts = 0;
        }

        await bowler.save();

        // Send OTP via Resend
        try {
            const resendClient = getResendClient();
            const result = await resendClient.emails.send({
                from: 'Revolution Rumble Verification <rrotpverification@nielseninnovations.com>',
                to: email,
                subject: 'Your Revolution Rumble Login Code',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #1e40af;">Revolution Rumble</h2>
                        <p>Your login code is:</p>
                        <div style="background: #f3f4f6; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 8px; margin: 20px 0;">
                            ${otpCode}
                        </div>
                        <p style="color: #6b7280;">This code will expire in 10 minutes.</p>
                        <p style="color: #6b7280; font-size: 14px;">If you didn't request this code, you can safely ignore this email.</p>
                    </div>
                `
            });

            console.log('✅ OTP email sent successfully:', result);
            res.json({ success: true, message: 'OTP sent to your email' });
        } catch (emailError) {
            console.error('❌ Failed to send OTP email:', emailError);
            console.error('Error details:', JSON.stringify(emailError, null, 2));
            res.status(500).json({ error: 'Failed to send OTP email', details: emailError.message });
        }
    } catch (error) {
        console.error('OTP request error:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST verify OTP and log in
router.post('/bowlers/verify-otp', async (req, res) => {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) {
            return res.status(400).json({ error: 'Email and OTP required' });
        }

        const bowler = await Bowler.findOne({ email: email.toLowerCase() });
        if (!bowler) {
            return res.status(404).json({ error: 'Email not found' });
        }

        // Check if OTP is expired
        if (!bowler.otpExpires || bowler.otpExpires < new Date()) {
            return res.status(400).json({ error: 'OTP expired. Please request a new code.' });
        }

        // Check attempts (max 5)
        if (bowler.otpAttempts >= 5) {
            return res.status(429).json({ error: 'Too many failed attempts. Please request a new code.' });
        }

        // Verify OTP
        if (bowler.otpCode !== otp) {
            bowler.otpAttempts += 1;
            await bowler.save();
            return res.status(400).json({ error: 'Invalid OTP code' });
        }

        // Success! Clear OTP and set session
        bowler.otpCode = undefined;
        bowler.otpExpires = undefined;
        bowler.otpAttempts = 0;
        bowler.lastLogin = new Date();
        if (!bowler.claimedAt) {
            bowler.claimedAt = new Date();
        }
        await bowler.save();

        // Set session
        req.session.bowlerId = bowler._id.toString();
        req.session.bowlerEmail = bowler.email;

        res.json({ 
            success: true, 
            bowler: {
                _id: bowler._id,
                email: bowler.email,
                playerName: bowler.playerName,
                nickname: bowler.nickname
            }
        });
    } catch (error) {
        console.error('OTP verification error:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET current bowler session
router.get('/bowlers/session', (req, res) => {
    if (req.session.bowlerId) {
        res.json({ 
            authenticated: true, 
            bowlerId: req.session.bowlerId,
            email: req.session.bowlerEmail 
        });
    } else {
        res.json({ authenticated: false });
    }
});

// POST logout
router.post('/bowlers/logout', (req, res) => {
    req.session.bowlerId = undefined;
    req.session.bowlerEmail = undefined;
    res.json({ success: true });
});

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

// PUT update bowler profile (requires authentication)
router.put('/bowlers/:id', requireBowlerAuth, async (req, res) => {
    try {
        const { playerName, nickname, hand, bio, homeCenter, yearsExperience, currentAverage, highGame, highSeries } = req.body;

        // Ensure bowler can only update their own profile
        if (req.params.id !== req.session.bowlerId) {
            return res.status(403).json({ error: 'You can only update your own profile' });
        }

        const bowler = await Bowler.findById(req.params.id);
        if (!bowler) {
            return res.status(404).json({ error: 'Bowler not found' });
        }

        // Track if playerName changed for syncing
        const nameChanged = playerName !== undefined && playerName !== bowler.playerName;
        const oldEmail = bowler.email;

        // Update allowed fields
        if (playerName !== undefined) bowler.playerName = playerName;
        if (nickname !== undefined) bowler.nickname = nickname;
        if (hand !== undefined) bowler.hand = hand;
        if (bio !== undefined) bowler.bio = bio;
        if (homeCenter !== undefined) bowler.homeCenter = homeCenter;
        if (yearsExperience !== undefined) bowler.yearsExperience = yearsExperience;
        if (currentAverage !== undefined) bowler.currentAverage = currentAverage;
        if (highGame !== undefined) bowler.highGame = highGame;
        if (highSeries !== undefined) bowler.highSeries = highSeries;

        await bowler.save();

        // Sync playerName to all registrations if it changed
        if (nameChanged) {
            await Registration.updateMany(
                { email: oldEmail },
                { $set: { playerName: bowler.playerName } }
            );
        }

        res.json(bowler);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET current authenticated bowler's registrations
router.get('/bowlers/my/registrations', requireBowlerAuth, async (req, res) => {
    try {
        // Get bowler to find their email
        const bowler = await Bowler.findById(req.session.bowlerId);
        if (!bowler) {
            return res.status(404).json({ error: 'Bowler not found' });
        }

        // Find registrations by email (since they may not have bowler ID linked)
        const registrations = await Registration.find({ email: bowler.email })
            .populate('tournament')
            .sort({ registeredAt: -1 });

        // Manually populate assignedSquads from tournament.squads
        const populatedRegistrations = registrations.map(reg => {
            const regObj = reg.toObject();
            if (reg.tournament && reg.tournament.squads && regObj.assignedSquads) {
                regObj.assignedSquads = regObj.assignedSquads.map(squadId => {
                    return reg.tournament.squads.find(s => s._id.toString() === squadId.toString());
                }).filter(Boolean);
            }
            return regObj;
        });

        res.json(populatedRegistrations);
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
        const { bowlerId, tournamentId, registrationId, squadResults, finalPosition, totalParticipants } = req.body;

        // Verify bowler exists
        const bowler = await Bowler.findById(bowlerId);
        if (!bowler) {
            return res.status(404).json({ error: 'Bowler not found' });
        }

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
            if (registrationId) result.registration = registrationId;
            result.enteredBy = 'admin';
            result.verified = true;
        } else {
            // Create new
            result = new TournamentResult({
                bowler: bowlerId,
                tournament: tournamentId,
                registration: registrationId,
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

        // Populate before sending response
        await result.populate('bowler', 'playerName email');
        await result.populate('tournament', 'name date');

        res.status(201).json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Helper function to recalculate bowler stats from all results
async function updateBowlerStats(bowlerId) {
    // Get bowler to find their email
    const bowler = await Bowler.findById(bowlerId);
    if (!bowler) return;
    
    // Find all registrations by this bowler's email
    const registrations = await Registration.find({ email: bowler.email });
    
    let totalPins = 0;
    let totalGames = 0;
    let highGame = 0;
    let highSeries = 0;
    
    // Calculate stats from registration stageScores
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
                    
                    // Calculate 3-game series for high series
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
    
    // Also check TournamentResult collection if it exists
    const results = await TournamentResult.find({ bowler: bowlerId });
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

// POST admin utility to sync all bowler stats from results
router.post('/bowlers/sync-stats', requireAdmin, async (req, res) => {
    try {
        const bowlers = await Bowler.find();
        let syncedCount = 0;
        
        for (const bowler of bowlers) {
            await updateBowlerStats(bowler._id);
            syncedCount++;
        }
        
        res.json({ 
            message: `Successfully synced stats for ${syncedCount} bowlers`,
            syncedCount 
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST admin utility to sync bowler names to all registrations
router.post('/bowlers/sync-names', requireAdmin, async (req, res) => {
    try {
        const bowlers = await Bowler.find();
        let updatedCount = 0;
        
        for (const bowler of bowlers) {
            const result = await Registration.updateMany(
                { email: bowler.email },
                { $set: { playerName: bowler.playerName } }
            );
            updatedCount += result.modifiedCount;
        }
        
        res.json({ 
            message: `Successfully updated ${updatedCount} registrations`,
            updatedCount 
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET diagnostic route to check bowler sync status
router.get('/bowlers/check-sync/:email', requireAdmin, async (req, res) => {
    try {
        const email = req.params.email.toLowerCase();
        
        // Find bowler
        const bowler = await Bowler.findOne({ email });
        if (!bowler) {
            return res.status(404).json({ error: 'Bowler not found' });
        }
        
        // Find all registrations
        const registrations = await Registration.find({ email })
            .populate('tournament', 'name');
        
        // Find all results linked to this bowler ID
        const resultsByBowlerId = await TournamentResult.find({ bowler: bowler._id })
            .populate('tournament', 'name');
        
        // Find results that might be orphaned (look for results with similar name but no bowler link)
        const resultsWithoutBowler = await TournamentResult.find({ 
            bowler: { $exists: false }
        }).populate('tournament', 'name');
        
        // Calculate what stats SHOULD be
        let totalPins = 0;
        let totalGames = 0;
        let highGame = 0;
        let highSeries = 0;

        resultsByBowlerId.forEach(result => {
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

        const calculatedAverage = totalGames > 0 ? Math.round(totalPins / totalGames) : null;
        
        res.json({
            bowler: {
                _id: bowler._id,
                email: bowler.email,
                playerName: bowler.playerName,
                currentStats: {
                    tournamentAverage: bowler.tournamentAverage,
                    highGame: bowler.highGame,
                    highSeries: bowler.highSeries
                },
                calculatedStats: {
                    tournamentAverage: calculatedAverage,
                    highGame: highGame || null,
                    highSeries: highSeries || null
                },
                statsMatch: bowler.tournamentAverage === calculatedAverage
            },
            registrations: registrations.map(r => ({
                _id: r._id,
                tournament: r.tournament?.name,
                playerName: r.playerName,
                nameMatches: r.playerName === bowler.playerName
            })),
            results: resultsByBowlerId.map(r => ({
                _id: r._id,
                tournament: r.tournament?.name,
                hasBowlerLink: !!r.bowler,
                totalPins: r.totalPins,
                totalGames: r.totalGames,
                tournamentAverage: r.tournamentAverage
            })),
            potentialOrphans: resultsWithoutBowler.filter(r => 
                r.tournament?.name?.toLowerCase().includes('lachlan')
            )
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST fix/link results to bowler by email match
router.post('/bowlers/link-results/:bowlerId', requireAdmin, async (req, res) => {
    try {
        const bowler = await Bowler.findById(req.params.bowlerId);
        if (!bowler) {
            return res.status(404).json({ error: 'Bowler not found' });
        }
        
        // Find registrations by this bowler's email
        const registrations = await Registration.find({ email: bowler.email });
        const registrationIds = registrations.map(r => r._id);
        
        // Link results that have these registration IDs but no bowler link
        const linkResult = await TournamentResult.updateMany(
            { 
                registration: { $in: registrationIds },
                bowler: { $exists: false }
            },
            { $set: { bowler: bowler._id } }
        );
        
        // Also check for results with wrong bowler link but matching registration
        const fixWrongLink = await TournamentResult.updateMany(
            {
                registration: { $in: registrationIds },
                bowler: { $ne: bowler._id }
            },
            { $set: { bowler: bowler._id } }
        );
        
        // Now update stats
        await updateBowlerStats(bowler._id);
        
        // Get updated bowler
        const updatedBowler = await Bowler.findById(bowler._id);
        
        res.json({
            message: 'Results linked and stats updated',
            linkedNew: linkResult.modifiedCount,
            fixedWrong: fixWrongLink.modifiedCount,
            updatedStats: {
                tournamentAverage: updatedBowler.tournamentAverage,
                highGame: updatedBowler.highGame,
                highSeries: updatedBowler.highSeries
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST find and fix bowler by name (for cases where results have wrong name)
router.post('/bowlers/fix-by-name', requireAdmin, async (req, res) => {
    try {
        const { searchName, correctEmail } = req.body;
        
        if (!searchName || !correctEmail) {
            return res.status(400).json({ error: 'searchName and correctEmail required' });
        }
        
        // Find the bowler by email
        const bowler = await Bowler.findOne({ email: correctEmail.toLowerCase() });
        if (!bowler) {
            return res.status(404).json({ error: 'Bowler not found with that email' });
        }
        
        // Find registrations by email and update names
        const regUpdate = await Registration.updateMany(
            { email: correctEmail.toLowerCase() },
            { $set: { playerName: bowler.playerName } }
        );
        
        // Get all registrations for this bowler
        const registrations = await Registration.find({ email: correctEmail.toLowerCase() });
        const registrationIds = registrations.map(r => r._id);
        
        // Link all results with these registration IDs to this bowler
        const resultUpdate = await TournamentResult.updateMany(
            { registration: { $in: registrationIds } },
            { $set: { bowler: bowler._id } }
        );
        
        // Update stats
        await updateBowlerStats(bowler._id);
        
        // Get updated bowler
        const updatedBowler = await Bowler.findById(bowler._id);
        
        res.json({
            message: 'Bowler data synced successfully',
            bowler: {
                _id: bowler._id,
                email: bowler.email,
                playerName: bowler.playerName
            },
            registrationsUpdated: regUpdate.modifiedCount,
            resultsLinked: resultUpdate.modifiedCount,
            stats: {
                tournamentAverage: updatedBowler.tournamentAverage,
                highGame: updatedBowler.highGame,
                highSeries: updatedBowler.highSeries
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST force sync specific email (temporary debug route - remove in production)
router.post('/bowlers/force-sync', async (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({ error: 'email required' });
        }
        
        // Find the bowler by email
        const bowler = await Bowler.findOne({ email: email.toLowerCase() });
        if (!bowler) {
            return res.status(404).json({ error: 'Bowler not found with that email' });
        }
        
        // Find registrations by email and update names
        const regUpdate = await Registration.updateMany(
            { email: email.toLowerCase() },
            { $set: { playerName: bowler.playerName } }
        );
        
        // Get all registrations for this bowler
        const registrations = await Registration.find({ email: email.toLowerCase() });
        const registrationIds = registrations.map(r => r._id);
        const tournamentIds = registrations.map(r => r.tournament);
        
        // Method 1: Link results via registration IDs
        const resultUpdate1 = await TournamentResult.updateMany(
            { registration: { $in: registrationIds } },
            { $set: { bowler: bowler._id } }
        );
        
        // Method 2: Link results by matching tournament IDs (for results without registration link)
        const resultUpdate2 = await TournamentResult.updateMany(
            { 
                tournament: { $in: tournamentIds },
                $or: [
                    { bowler: { $exists: false } },
                    { bowler: null }
                ]
            },
            { $set: { bowler: bowler._id } }
        );
        
        // Method 3: Also update any results that already have wrong bowler but match registrations
        const resultUpdate3 = await TournamentResult.updateMany(
            { 
                tournament: { $in: tournamentIds },
                bowler: { $ne: bowler._id }
            },
            { $set: { bowler: bowler._id } }
        );
        
        // Update stats
        await updateBowlerStats(bowler._id);
        
        // Get updated bowler
        const updatedBowler = await Bowler.findById(bowler._id);
        
        // Get diagnostic info
        const allResults = await TournamentResult.find({}).populate('tournament', 'name');
        const bowlerResults = await TournamentResult.find({ bowler: bowler._id });
        
        res.json({
            success: true,
            message: 'Bowler data synced successfully',
            bowler: {
                _id: bowler._id,
                email: bowler.email,
                playerName: bowler.playerName
            },
            registrations: registrations.length,
            registrationsUpdated: regUpdate.modifiedCount,
            tournamentIds: tournamentIds.map(t => t.toString()),
            resultsLinked: {
                viaRegistrationId: resultUpdate1.modifiedCount,
                viaTournamentMatch: resultUpdate2.modifiedCount,
                fixedWrongLink: resultUpdate3.modifiedCount,
                total: resultUpdate1.modifiedCount + resultUpdate2.modifiedCount + resultUpdate3.modifiedCount
            },
            resultsFound: bowlerResults.length,
            totalResultsInDB: allResults.length,
            stats: {
                tournamentAverage: updatedBowler.tournamentAverage,
                highGame: updatedBowler.highGame,
                highSeries: updatedBowler.highSeries
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
