/**
 * @fileoverview Admin Results Management
 * Handles score entry, matchplay tracking, and handicap calculations for tournament results
 * @module admin/admin-results
 */

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

/** @type {HTMLSelectElement} Tournament selection dropdown */
const resultsTournamentFilter = document.getElementById('resultsTournamentFilter');

/** @type {Object|null} Currently selected tournament data */
let currentTournamentForResults = null;

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Loads available tournaments into the dropdown filter
 * @async
 * @returns {Promise<void>}
 */
async function loadTournamentsForDropdown() {
    try {
        const response = await fetch('/api/tournaments');
        const tournaments = await response.json();

        resultsTournamentFilter.innerHTML = '<option value="">Choose a tournament...</option>' + 
            tournaments.map(t => {
                const date = new Date(t.startDate || t.date).toLocaleDateString();
                return `<option value="${t._id}">${t.name} (${date})</option>`;
            }).join('');
    } catch (error) {
        console.error('Error loading tournaments:', error);
    }
}

// Load tournaments on page load
loadTournamentsForDropdown();

// ============================================================================
// DATA LOADING
// ============================================================================

/**
 * Loads and displays results for the selected tournament
 * @async
 * @returns {Promise<void>}
 */
async function loadTournamentResults() {
    const tournamentId = resultsTournamentFilter.value;
    const container = document.getElementById('resultsContainer');

    if (!tournamentId) {
        container.innerHTML = '<p style="color:#b9c6d8;text-align:center">Select a tournament to manage results</p>';
        return;
    }

    try {
        // Load tournament details
        const tournamentsRes = await fetch('/api/tournaments');
        const tournaments = await tournamentsRes.json();
        currentTournamentForResults = tournaments.find(t => t._id === tournamentId);

        // Load registrations
        const regRes = await fetch(`/api/registrations?tournamentId=${tournamentId}`);
        const registrations = await regRes.json();
        
        console.log('Loaded registrations:', registrations);
        console.log('First registration stageScores:', registrations[0]?.stageScores);

        if (registrations.length === 0) {
            container.innerHTML = '<p style="color:#b9c6d8;text-align:center">No registrations for this tournament</p>';
            return;
        }

        // Render stage-based scoring
        if (currentTournamentForResults.format?.hasStages && currentTournamentForResults.format.stages?.length > 0) {
            renderStagedResults(registrations);
        } else {
            // Single stage tournament
            renderSingleStageResults(registrations);
        }

    } catch (error) {
        console.error('Error loading results:', error);
        container.innerHTML = '<p style="color:#c92a2a;text-align:center">Failed to load tournament data</p>';
    }
}

// Event listener for filter changes
resultsTournamentFilter.addEventListener('change', loadTournamentResults);

// ============================================================================
// UI RENDERING
// ============================================================================

/**
 * Renders results interface for tournaments with multiple stages
 * Creates collapsible sections for each stage with score entry tables
 * Handles squad grouping for qualifying stages
 * @param {Array<Object>} registrations - Array of registration objects with player data
 * @returns {void}
 */
function renderStagedResults(registrations) {
    const container = document.getElementById('resultsContainer');
    const stages = currentTournamentForResults.format.stages;
    let html = '';

    stages.forEach((stage, stageIndex) => {
        const stageName = stage.name;
        const gamesCount = stage.games;
        const advancingCount = stage.advancingBowlers;

        // Find ALL players who have scores for this stage OR are currently in this stage
        let stagePlayers = registrations.filter(reg => {
            const hasScoresInStage = reg.stageScores?.some(s => s.stageIndex === stageIndex);
            const isCurrentlyInStage = (reg.currentStage || 0) === stageIndex;
            return hasScoresInStage || isCurrentlyInStage;
        });

        if (stagePlayers.length === 0) {
            // No data for this stage yet
            if (stageIndex > 0) {
                html += `<div style="margin-bottom:32px">
                    <h2 style="margin:0 0 16px;color:#6c757d;display:flex;align-items:center;gap:8px">
                        ${stageIndex === stages.length - 1 ? '👑' : '🏆'} ${stageName}
                        <span style="font-size:.8rem;color:#6c757d;font-weight:400">(${gamesCount} games${advancingCount ? `, Top ${advancingCount} advance` : ''})</span>
                    </h2>
                    <p style="color:#6c757d;text-align:center;padding:20px;background:rgba(255,255,255,.02);border-radius:8px">
                        Waiting for ${stages[stageIndex - 1].name} to complete
                    </p>
                </div>`;
            }
            return;
        }

        // Determine if this stage should be collapsed by default (only if it's not the current active stage)
        const hasCurrentPlayers = stagePlayers.some(reg => (reg.currentStage || 0) === stageIndex);
        const isExpanded = hasCurrentPlayers;
        const stageId = `stage-${stageIndex}`;

        // Create collapsible stage section
        html += `<div style="margin-bottom:24px;border:1px solid rgba(255,255,255,.1);border-radius:8px;overflow:hidden">
            <div style="background:rgba(255,255,255,.03);padding:16px;cursor:pointer;display:flex;align-items:center;gap:12px"
                 onclick="toggleStageSection('${stageId}')">
                <span id="${stageId}-icon" style="transition:transform 0.3s;transform:rotate(${isExpanded ? '90deg' : '0deg'})">▶</span>
                <h2 style="margin:0;color:#5eb6f5;display:flex;align-items:center;gap:8px;flex:1">
                    ${stageIndex === 0 ? '🎯' : stageIndex === stages.length - 1 ? '👑' : '🏆'} ${stageName}
                    <span style="font-size:.8rem;color:#b9c6d8;font-weight:400">
                        (${gamesCount} games${advancingCount ? `, Top ${advancingCount} advance` : ''})
                    </span>
                </h2>
                <span style="font-size:.85rem;color:#b9c6d8">${stagePlayers.length} ${stagePlayers.length === 1 ? 'bowler' : 'bowlers'}</span>
            </div>
            <div id="${stageId}-content" style="display:${isExpanded ? 'block' : 'none'};padding:16px">`;

        // For qualifying stage (index 0), group by squad
        if (stageIndex === 0 && currentTournamentForResults.squads?.length > 0) {
            const squads = currentTournamentForResults.squads;
            squads.forEach(squad => {
                const squadPlayers = stagePlayers.filter(reg => 
                    reg.assignedSquads?.some(sid => sid.toString() === squad._id.toString())
                );

                if (squadPlayers.length > 0) {
                    html += renderStageTable(squadPlayers, stageIndex, gamesCount, squad.name);
                }
            });
        } else {
            // Non-qualifying stages - show all together
            html += renderStageTable(stagePlayers, stageIndex, gamesCount);
        }

        html += `</div></div>`;
    });

    // Add advance button for completed stages
    html += `<div style="margin-top:24px;text-align:center">
        <button class="button" onclick="advancePlayersToNextStage()" style="padding:10px 20px;font-size:1rem">
            ⚡ Auto-Advance Qualified Players
        </button>
        <p style="margin:8px 0 0;font-size:.85rem;color:#b9c6d8">Automatically moves top players to next stages based on format rules</p>
    </div>`;

    container.innerHTML = html;
    loadExistingStageScores(registrations);
}

/**
 * Toggles the visibility of a stage section in the results interface
 * Rotates the arrow icon and shows/hides the content area
 * @param {string} stageId - The ID of the stage section to toggle
 * @returns {void}
 */
function toggleStageSection(stageId) {
    const content = document.getElementById(`${stageId}-content`);
    const icon = document.getElementById(`${stageId}-icon`);
    
    if (content.style.display === 'none') {
        content.style.display = 'block';
        icon.style.transform = 'rotate(90deg)';
    } else {
        content.style.display = 'none';
        icon.style.transform = 'rotate(0deg)';
    }
}

/**
 * Renders results interface for tournaments with a single stage
 * Groups players by squad if tournament has squads configured
 * @param {Array<Object>} registrations - Array of registration objects with player data
 * @returns {void}
 */
function renderSingleStageResults(registrations) {
    const container = document.getElementById('resultsContainer');
    const gamesCount = currentTournamentForResults?.format?.gamesPerBowler || 3;
    let html = `<h2 style="margin:0 0 16px;color:#5eb6f5">🎯 Tournament Scores (${gamesCount} games)</h2>`;

    // Group by squad if exists
    if (currentTournamentForResults.squads?.length > 0) {
        const squads = currentTournamentForResults.squads;
        squads.forEach(squad => {
            const squadPlayers = registrations.filter(reg => 
                reg.assignedSquads?.some(sid => sid.toString() === squad._id.toString())
            );

            if (squadPlayers.length > 0) {
                html += renderStageTable(squadPlayers, 0, gamesCount, squad.name);
            }
        });
    } else {
        html += renderStageTable(registrations, 0, gamesCount);
    }

    container.innerHTML = html;
    loadExistingStageScores(registrations);
}

/**
 * Renders a score entry table for a specific stage and group of players
 * Creates table with game inputs, matchplay checkboxes, and calculated totals
 * Includes carryover column for non-qualifying stages if applicable
 * @param {Array<Object>} players - Array of player registration objects
 * @param {number} stageIndex - Zero-based index of the current stage
 * @param {number} gamesCount - Number of games in this stage
 * @param {string|null} squadName - Optional squad name for table header
 * @returns {string} HTML string for the score table
 */
function renderStageTable(players, stageIndex, gamesCount, squadName = null) {
    const gameHeaders = Array.from({length: gamesCount}, (_, i) => 
        `<th style="padding:8px;text-align:center;font-size:.85rem;color:#b9c6d8;width:100px">G${i+1}</th>`
    ).join('');

    const hasCarryover = stageIndex > 0 && currentTournamentForResults.format?.stages?.[stageIndex]?.carryoverPinfall;

    return `
        <div style="border:1px solid rgba(255,255,255,.1);border-radius:8px;padding:16px;background:rgba(255,255,255,.02);margin-bottom:16px">
            ${squadName ? `<h3 style="margin:0 0 12px;color:#b9c6d8">${squadName}</h3>` : ''}
            <div style="overflow-x:auto">
                <table style="width:100%;border-collapse:collapse;min-width:800px">
                    <thead>
                        <tr style="border-bottom:1px solid rgba(255,255,255,.08)">
                            <th style="padding:8px;text-align:left;font-size:.85rem;color:#b9c6d8;min-width:150px">Bowler</th>
                            ${hasCarryover ? '<th style="padding:8px;text-align:center;font-size:.85rem;color:#b9c6d8;width:70px">Carry</th>' : ''}
                            ${gameHeaders}
                            <th style="padding:8px;text-align:center;font-size:.85rem;color:#b9c6d8;width:80px">Scratch</th>
                            <th style="padding:8px;text-align:center;font-size:.85rem;color:#b9c6d8;width:80px">+ Bonus</th>
                            <th style="padding:8px;text-align:center;font-size:.85rem;color:#b9c6d8;width:60px">Avg</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${players.map(reg => renderPlayerStageRow(reg, stageIndex, gamesCount, hasCarryover)).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

/**
 * Renders a single player row in a stage score table
 * Includes score inputs, matchplay checkboxes (Win/Tie), and calculated totals
 * Displays handicap information if applicable based on tournament format
 * @param {Object} reg - Registration object containing player data
 * @param {number} stageIndex - Zero-based index of the current stage
 * @param {number} gamesCount - Number of games in this stage
 * @param {boolean} hasCarryover - Whether this stage includes carryover from previous stage
 * @returns {string} HTML string for the player row
 */
function renderPlayerStageRow(reg, stageIndex, gamesCount, hasCarryover) {
    const gameInputs = Array.from({length: gamesCount}, (_, i) => 
        `<td style="padding:4px;text-align:center">
            <input type="number" 
                id="score-${reg._id}-${stageIndex}-${i}"
                min="0" max="300" 
                placeholder="-"
                style="width:60px;padding:6px 4px;text-align:center;background:#141a22;border:1px solid rgba(255,255,255,.08);color:#e9eef7;border-radius:4px;font-size:.9rem;margin-bottom:4px"
                onblur="saveStageScores('${reg._id}', ${stageIndex}, ${gamesCount})"
                oninput="updateStageRowTotal('${reg._id}', ${stageIndex}, ${gamesCount})">
            <div style="display:flex;gap:4px;justify-content:center;font-size:.7rem">
                <label style="display:flex;align-items:center;gap:2px;color:#51cf66;cursor:pointer">
                    <input type="checkbox" 
                        id="win-${reg._id}-${stageIndex}-${i}"
                        style="width:12px;height:12px"
                        onchange="handleMatchplayChange('${reg._id}', ${stageIndex}, ${i}, 'win'); saveStageScores('${reg._id}', ${stageIndex}, ${gamesCount})">W
                </label>
                <label style="display:flex;align-items:center;gap:2px;color:#fab005;cursor:pointer">
                    <input type="checkbox" 
                        id="tie-${reg._id}-${stageIndex}-${i}"
                        style="width:12px;height:12px"
                        onchange="handleMatchplayChange('${reg._id}', ${stageIndex}, ${i}, 'tie'); saveStageScores('${reg._id}', ${stageIndex}, ${gamesCount})">T
                </label>
            </div>
        </td>`
    ).join('');

    // Calculate handicap based on tournament settings
    let totalHandicap = 0;
    
    if (currentTournamentForResults.format?.useHandicap) {
        const baseScore = currentTournamentForResults.format.handicapBase || 220;
        const handicapPct = currentTournamentForResults.format.handicapPercentage || 90;
        const avgScore = reg.averageScore || 180;
        const handicapPerGame = avgScore < baseScore ? Math.round((baseScore - avgScore) * (handicapPct / 100)) : 0;
        
        // Female bonus only if NOT separate divisions
        const femaleBonus = (reg.gender === 'female' && !currentTournamentForResults.format.separateDivisions) 
            ? (currentTournamentForResults.format.femaleHandicapPins || 8) 
            : 0;
        
        totalHandicap = handicapPerGame + femaleBonus;
    }

    return `
        <tr style="border-bottom:1px solid rgba(255,255,255,.05)" id="row-${reg._id}-${stageIndex}">
            <td style="padding:8px;font-weight:500">
                ${reg.playerName}
                ${totalHandicap > 0 ? `<span style="font-size:.75rem;color:#fab005;margin-left:4px">(+${totalHandicap}/game)</span>` : ''}
            </td>
            ${hasCarryover ? `<td style="padding:8px;text-align:center;color:#51cf66;font-weight:600" id="carryover-${reg._id}-${stageIndex}">-</td>` : ''}
            ${gameInputs}
            <td style="padding:8px;text-align:center;font-weight:600;color:#b9c6d8" id="scratch-${reg._id}-${stageIndex}">-</td>
            <td style="padding:8px;text-align:center;font-weight:600;color:#51cf66" id="total-${reg._id}-${stageIndex}">-</td>
            <td style="padding:8px;text-align:center;color:#b9c6d8" id="avg-${reg._id}-${stageIndex}">-</td>
        </tr>
    `;
}

// ============================================================================
// SCORE CALCULATIONS
// ============================================================================

/**
 * Handles mutually exclusive selection of Win/Tie matchplay checkboxes
 * When one checkbox is selected, automatically unchecks the other
 * @param {string} regId - Registration ID for the player
 * @param {number} stageIndex - Zero-based index of the current stage
 * @param {number} gameIndex - Zero-based index of the game within the stage
 * @param {string} type - Type of checkbox clicked ('win' or 'tie')
 * @returns {void}
 */
function handleMatchplayChange(regId, stageIndex, gameIndex, type) {
    const winCheckbox = document.getElementById(`win-${regId}-${stageIndex}-${gameIndex}`);
    const tieCheckbox = document.getElementById(`tie-${regId}-${stageIndex}-${gameIndex}`);
    
    // Uncheck the other checkbox
    if (type === 'win' && winCheckbox.checked) {
        tieCheckbox.checked = false;
    } else if (type === 'tie' && tieCheckbox.checked) {
        winCheckbox.checked = false;
    }
}

/**
 * Calculates and updates the total scores for a player's stage row
 * Computes scratch total, handicap, matchplay bonuses, carryover, and averages
 * Updates the DOM with calculated values in real-time
 * @param {string} regId - Registration ID for the player
 * @param {number} stageIndex - Zero-based index of the current stage
 * @param {number} gamesCount - Number of games in this stage
 * @returns {void}
 */
function updateStageRowTotal(regId, stageIndex, gamesCount) {
    let scratchTotal = 0;
    let bonusTotal = 0;
    let gameCount = 0;

    // Find the registration to get handicap info
    const row = document.getElementById(`row-${regId}-${stageIndex}`);
    if (!row) return;
    
    // Extract handicap from the row (stored in the name display)
    const handicapMatch = row.textContent.match(/\(\+(\d+)\/game\)/);
    const handicapPerGame = handicapMatch ? parseInt(handicapMatch[1]) : 0;

    for (let i = 0; i < gamesCount; i++) {
        const input = document.getElementById(`score-${regId}-${stageIndex}-${i}`);
        const value = parseInt(input?.value);
        if (!isNaN(value) && value > 0) {
            scratchTotal += value;
            gameCount++;
            
            // Add matchplay bonus
            const winCheckbox = document.getElementById(`win-${regId}-${stageIndex}-${i}`);
            const tieCheckbox = document.getElementById(`tie-${regId}-${stageIndex}-${i}`);
            if (winCheckbox?.checked) {
                bonusTotal += 30; // Win bonus
            } else if (tieCheckbox?.checked) {
                bonusTotal += 15; // Tie bonus
            }
        }
    }

    // Add handicap for each game played
    const handicapTotal = handicapPerGame * gameCount;

    // Add carryover if exists
    const carryoverEl = document.getElementById(`carryover-${regId}-${stageIndex}`);
    const carryover = carryoverEl ? parseInt(carryoverEl.textContent) || 0 : 0;

    const scratchEl = document.getElementById(`scratch-${regId}-${stageIndex}`);
    const totalEl = document.getElementById(`total-${regId}-${stageIndex}`);
    const avgEl = document.getElementById(`avg-${regId}-${stageIndex}`);

    // Check if elements exist (player might have moved to a different stage)
    if (!scratchEl || !totalEl || !avgEl) {
        console.warn(`Elements not found for row: ${regId}-${stageIndex}`);
        return;
    }

    const scratchWithCarry = scratchTotal + carryover;
    const grandTotal = scratchTotal + handicapTotal + bonusTotal + carryover;
    
    scratchEl.textContent = gameCount > 0 ? scratchWithCarry : '-';
    totalEl.textContent = gameCount > 0 ? grandTotal : '-';
    avgEl.textContent = gameCount > 0 ? Math.round(scratchTotal / gameCount) : '-';
}

// ============================================================================
// SCORE SAVING
// ============================================================================

/**
 * Saves stage scores for a player to the server
 * Collects all game scores, matchplay bonuses, and handicap information
 * Sends PUT request to update registration with new stage score data
 * @async
 * @param {string} regId - Registration ID for the player
 * @param {number} stageIndex - Zero-based index of the current stage
 * @param {number} gamesCount - Number of games in this stage
 * @returns {Promise<void>}
 */
async function saveStageScores(regId, stageIndex, gamesCount) {
    const scores = [];
    const bonusPins = [];
    
    // Find registration to get handicap
    const row = document.getElementById(`row-${regId}-${stageIndex}`);
    const handicapMatch = row?.textContent.match(/\(\+(\d+)\/game\)/);
    const handicap = handicapMatch ? parseInt(handicapMatch[1]) : 0;
    
    for (let i = 0; i < gamesCount; i++) {
        const input = document.getElementById(`score-${regId}-${stageIndex}-${i}`);
        const value = parseInt(input?.value);
        if (!isNaN(value) && value > 0) {
            scores.push(value);
            
            // Calculate bonus for this game
            const winCheckbox = document.getElementById(`win-${regId}-${stageIndex}-${i}`);
            const tieCheckbox = document.getElementById(`tie-${regId}-${stageIndex}-${i}`);
            let bonus = 0;
            if (winCheckbox?.checked) {
                bonus = 30;
            } else if (tieCheckbox?.checked) {
                bonus = 15;
            }
            bonusPins.push(bonus);
        } else {
            bonusPins.push(0);
        }
    }

    console.log('Saving scores:', { regId, stageIndex, scores, bonusPins, handicap });

    try {
        const response = await fetch(`/api/registrations/${regId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                stageScores: { stageIndex, scores, bonusPins, handicap }
            })
        });

        if (response.ok) {
            const savedReg = await response.json();
            console.log('Scores saved successfully:', savedReg.stageScores);
            // Visual feedback
            const row = document.getElementById(`row-${regId}-${stageIndex}`);
            if (row) {
                row.style.background = 'rgba(46,143,220,.1)';
                setTimeout(() => row.style.background = '', 500);
            }
        } else {
            const error = await response.json();
            alert('Failed to save scores: ' + error.error);
        }
    } catch (error) {
        console.error('Error saving scores:', error);
    }
}

// ============================================================================
// DATA LOADING
// ============================================================================

/**
 * Loads existing stage scores from registration data into the UI
 * Populates score inputs, matchplay checkboxes, carryover values, and recalculates totals
 * Iterates through all registrations and their saved stage scores
 * @async
 * @param {Array<Object>} registrations - Array of registration objects with stageScores data
 * @returns {Promise<void>}
 */
async function loadExistingStageScores(registrations) {
    console.log('Loading existing scores for registrations:', registrations.length);
    
    for (const reg of registrations) {
        console.log(`Registration ${reg.playerName}:`, reg.stageScores);
        
        if (reg.stageScores && reg.stageScores.length > 0) {
            reg.stageScores.forEach(stageData => {
                const stageIndex = stageData.stageIndex;
                
                console.log(`  Loading stage ${stageIndex} for ${reg.playerName}:`, stageData.scores);
                
                // Load carryover if exists
                if (stageData.carryover) {
                    const carryoverEl = document.getElementById(`carryover-${reg._id}-${stageIndex}`);
                    if (carryoverEl) {
                        carryoverEl.textContent = stageData.carryover;
                    }
                }

                // Load scores
                if (stageData.scores && stageData.scores.length > 0) {
                    let loadedScores = 0;
                    stageData.scores.forEach((score, i) => {
                        const input = document.getElementById(`score-${reg._id}-${stageIndex}-${i}`);
                        if (input) {
                            input.value = score;
                            loadedScores++;
                            console.log(`    Loaded score ${score} into game ${i+1}`);
                            
                            // Load matchplay bonus checkboxes
                            if (stageData.bonusPins && stageData.bonusPins[i]) {
                                const bonus = stageData.bonusPins[i];
                                if (bonus === 30) {
                                    const winCheckbox = document.getElementById(`win-${reg._id}-${stageIndex}-${i}`);
                                    if (winCheckbox) winCheckbox.checked = true;
                                } else if (bonus === 15) {
                                    const tieCheckbox = document.getElementById(`tie-${reg._id}-${stageIndex}-${i}`);
                                    if (tieCheckbox) tieCheckbox.checked = true;
                                }
                            }
                        } else {
                            console.warn(`    Input not found for: score-${reg._id}-${stageIndex}-${i}`);
                        }
                    });
                    
                    // Use the tournament's configured games count
                    const stage = currentTournamentForResults.format?.stages?.[stageIndex];
                    const expectedGames = stage?.games || currentTournamentForResults.format?.gamesPerBowler || 6;
                    
                    console.log(`  Updating totals with ${expectedGames} games...`);
                    updateStageRowTotal(reg._id, stageIndex, expectedGames);
                }
            });
        }
    }
}

// ============================================================================
// ADVANCEMENT LOGIC
// ============================================================================

/**
 * Automatically advances qualifying players to the next stage based on format rules
 * Processes all stages sequentially, sorting players by total score
 * Advances top N players per stage and calculates carryover pins if applicable
 * Updates player currentStage and carryoverToNextStage fields in the database
 * @async
 * @returns {Promise<void>}
 */
async function advancePlayersToNextStage() {
    if (!currentTournamentForResults) return;

    const stages = currentTournamentForResults.format?.stages;
    if (!stages || stages.length <= 1) {
        alert('This tournament does not have multiple stages');
        return;
    }

    try {
        // Get all registrations
        const regRes = await fetch(`/api/registrations?tournamentId=${currentTournamentForResults._id}`);
        const registrations = await regRes.json();

        let advancedCount = 0;

        for (let stageIndex = 0; stageIndex < stages.length - 1; stageIndex++) {
            const stage = stages[stageIndex];
            const nextStage = stages[stageIndex + 1];
            
            if (!stage.advancingBowlers) continue;

            // Find players in current stage who completed all games
            const stagePlayers = registrations.filter(reg => {
                const currentStage = reg.currentStage || 0;
                if (currentStage !== stageIndex) return false;

                // Check if they have completed all games
                const stageScore = reg.stageScores?.find(s => s.stageIndex === stageIndex);
                return stageScore && stageScore.scores?.length === stage.games;
            });

            if (stagePlayers.length === 0) continue;

            // Calculate totals and sort
            const playersWithTotals = stagePlayers.map(reg => {
                const stageScore = reg.stageScores.find(s => s.stageIndex === stageIndex);
                const total = stageScore.scores.reduce((sum, s) => sum + s, 0) + (stageScore.carryover || 0);
                return { reg, total, stageScore };
            }).sort((a, b) => b.total - a.total);

            // Advance top N players
            const toAdvance = playersWithTotals.slice(0, stage.advancingBowlers);

            for (const {reg, total, stageScore} of toAdvance) {
                // Calculate carryover
                let carryover = 0;
                if (nextStage.carryoverPinfall) {
                    const carryoverPct = nextStage.carryoverPercentage || 100;
                    carryover = Math.round(total * (carryoverPct / 100));
                }

                // Update registration
                await fetch(`/api/registrations/${reg._id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        currentStage: stageIndex + 1,
                        carryoverToNextStage: carryover
                    })
                });

                advancedCount++;
            }
        }

        if (advancedCount > 0) {
            alert(`✅ Advanced ${advancedCount} player(s) to next stage(s)`);
            loadTournamentResults(); // Reload to show updated stages
        } else {
            alert('No players ready to advance. Make sure all games are completed for each stage.');
        }

    } catch (error) {
        console.error('Error advancing players:', error);
        alert('Failed to advance players: ' + error.message);
    }
}