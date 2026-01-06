/**
 * @fileoverview Tournament Results Display System
 * Handles displaying tournament results with stage-based leaderboards, player rankings,
 * and detailed scoring information including handicaps and bonuses.
 * 
 * @module results
 * @requires DOM elements: tournamentSelect, tournamentTitle, tournamentSubtitle, resultsContainer
 */

// ========================================
// STATE MANAGEMENT
// ========================================

/**
 * @typedef {Object} Tournament
 * @property {string} _id - Tournament unique identifier
 * @property {string} name - Tournament name
 * @property {Date|string} startDate - Tournament start date
 * @property {Date|string} date - Alternative date field
 * @property {string} location - Tournament location
 * @property {string} status - Tournament status (upcoming/active/completed)
 */

/**
 * @typedef {Object} Stage
 * @property {string} stageName - Name of the stage (e.g., "Qualifying", "Finals")
 * @property {number} games - Number of games in this stage
 * @property {number} [advancingBowlers] - Number of bowlers advancing to next stage
 * @property {Player[]} players - Array of players in this stage
 */

/**
 * @typedef {Object} Player
 * @property {string} playerName - Player's display name
 * @property {number} position - Player's current position/rank
 * @property {number[]} scores - Array of game scores
 * @property {number} total - Total score including handicap and bonuses
 * @property {number} scratchTotal - Total score without handicap or bonuses
 * @property {number} average - Player's average score
 * @property {number} high - Highest individual game score
 * @property {number} [carryover] - Carryover score from previous stage
 * @property {number} [handicapPerGame] - Handicap applied per game
 * @property {number[]} [bonusPins] - Bonus pins for each game
 */

/**
 * @typedef {Object} TournamentData
 * @property {Tournament} tournament - Tournament information
 * @property {boolean} hasStages - Whether tournament has multiple stages
 * @property {Stage[]} [stages] - Array of tournament stages
 * @property {Player[]} [players] - Array of players (for single-stage tournaments)
 */

/**
 * Current tournament data being displayed
 * @type {TournamentData|null}
 */
let currentTournamentData = null;

// ========================================
// DOM ELEMENT REFERENCES
// ========================================

/**
 * @type {HTMLSelectElement}
 */
const tournamentSelect = document.getElementById('tournamentSelect');

/**
 * @type {HTMLElement}
 */
const tournamentTitle = document.getElementById('tournamentTitle');

/**
 * @type {HTMLElement}
 */
const tournamentSubtitle = document.getElementById('tournamentSubtitle');

/**
 * @type {HTMLElement}
 */
const resultsContainer = document.getElementById('resultsContainer');

// ========================================
// INITIALIZATION
// ========================================

/**
 * Initialize the results page
 * Loads available tournaments and checks for tournament ID in URL parameters
 * 
 * @async
 * @returns {Promise<void>}
 */
async function init() {
    await loadTournaments();
    
    // Check URL parameter for tournament ID
    const urlParams = new URLSearchParams(window.location.search);
    const tournamentId = urlParams.get('id');
    if (tournamentId) {
        tournamentSelect.value = tournamentId;
        await loadTournamentResults();
    }
    
    // Event listeners
    tournamentSelect.addEventListener('change', loadTournamentResults);
}

// ========================================
// DATA LOADING
// ========================================

/**
 * Load all available tournaments from the API
 * Populates the tournament selection dropdown with tournaments sorted by date (newest first)
 * 
 * @async
 * @returns {Promise<void>}
 * @throws {Error} If the API request fails
 */
async function loadTournaments() {
    try {
        const response = await fetch('/api/tournaments');
        const tournaments = await response.json();
        
        // Sort by date descending
        tournaments.sort((a, b) => new Date(b.startDate || b.date) - new Date(a.startDate || a.date));
        
        tournamentSelect.innerHTML = '<option value="">Choose a tournament...</option>';
        tournaments.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t._id;
            const date = new Date(t.startDate || t.date).toLocaleDateString();
            opt.textContent = `${t.name} - ${date}`;
            tournamentSelect.appendChild(opt);
        });
    } catch (error) {
        console.error('Error loading tournaments:', error);
    }
}

/**
 * Load results for the selected tournament
 * Fetches tournament data and renders the appropriate leaderboard(s)
 * Updates the URL with the selected tournament ID
 * 
 * @async
 * @returns {Promise<void>}
 * @throws {Error} If the API request fails
 */
async function loadTournamentResults() {
    const tournamentId = tournamentSelect.value;
    
    if (!tournamentId) {
        tournamentTitle.textContent = 'Select a Tournament';
        tournamentSubtitle.textContent = 'Choose a tournament to view complete results and leaderboards.';
        resultsContainer.innerHTML = '<div style="text-align:center;padding:48px;color:#888"><p>Please select a tournament to view results</p></div>';
        return;
    }
    
    resultsContainer.innerHTML = '<div style="text-align:center;padding:48px;color:#888"><p>Loading results...</p></div>';
    
    try {
        const response = await fetch(`/api/tournaments/${tournamentId}/results`);
        if (!response.ok) throw new Error('Failed to load results');
        
        currentTournamentData = await response.json();
        
        // Update tournament title
        tournamentTitle.textContent = currentTournamentData.tournament.name;
        const date = new Date(currentTournamentData.tournament.date).toLocaleDateString('en-US', { 
            year: 'numeric', month: 'long', day: 'numeric' 
        });
        tournamentSubtitle.textContent = `${date} • ${currentTournamentData.tournament.location}`;
        
        // Render results
        renderResults();
        
        // Update URL
        const url = new URL(window.location);
        url.searchParams.set('id', tournamentId);
        window.history.replaceState({}, '', url);
        
    } catch (error) {
        console.error('Error loading results:', error);
        resultsContainer.innerHTML = '<div style="text-align:center;padding:48px;color:#c92a2a"><p>Failed to load results. Please try again.</p></div>';
    }
}

// ========================================
// RENDERING
// ========================================

/**
 * Render the results for the current tournament
 * Determines whether to render single-stage or multi-stage leaderboards
 * 
 * @returns {void}
 */
function renderResults() {
    if (!currentTournamentData) return;
    
    let html = '';
    
    if (currentTournamentData.hasStages) {
        // Multi-stage tournament
        currentTournamentData.stages.forEach((stage, index) => {
            if (stage.players.length === 0) {
                // Stage not started yet
                html += renderEmptyStage(stage, index);
            } else {
                html += renderStageLeaderboard(stage, stage.players, index);
            }
        });
    } else {
        // Single stage tournament
        if (currentTournamentData.players?.length === 0) {
            html = '<div style="text-align:center;padding:48px;color:#888"><p>No results available yet</p></div>';
        } else {
            html = renderSingleStageLeaderboard(currentTournamentData.players || []);
        }
    }
    
    resultsContainer.innerHTML = html || '<div style="text-align:center;padding:48px;color:#888"><p>No results available yet</p></div>';
}

/**
 * Filter players (currently returns all players unfiltered)
 * Placeholder for future filtering functionality
 * 
 * @param {Player[]} players - Array of players to filter
 * @returns {Player[]} Filtered array of players
 */
function filterPlayers(players) {
    return players;
}

/**
 * Render a leaderboard for a specific tournament stage
 * Displays player rankings with game-by-game scores, averages, and totals
 * 
 * @param {Stage} stage - Stage information
 * @param {Player[]} players - Array of players in this stage
 * @param {number} stageIndex - Index of the stage (0 = qualifying, last = finals)
 * @returns {string} HTML string for the stage leaderboard
 */
function renderStageLeaderboard(stage, players, stageIndex) {
    const isQualifying = stageIndex === 0;
    const isFinal = stageIndex === currentTournamentData.stages.length - 1;
    const icon = isFinal ? '👑' : isQualifying ? '🎯' : '🏆';
    
    // Determine max games in this stage
    const maxGames = Math.max(...players.map(p => p.scores?.length || 0), stage.games);
    const gameHeaders = Array.from({length: maxGames}, (_, i) => 
        `<th style="padding:12px;text-align:center;font-weight:600;width:70px">G${i+1}</th>`
    ).join('');
    
    return `
        <div style="margin-bottom:32px">
            <h2 style="margin:0 0 8px;font-size:1.5rem;display:flex;align-items:center;gap:8px">
                ${icon} ${stage.stageName}
                <span style="font-size:0.9rem;color:#888;font-weight:400">(${stage.games} games)</span>
            </h2>
            ${stage.advancingBowlers ? `<p class="sub" style="margin:0 0 16px">Top ${stage.advancingBowlers} advance to next stage</p>` : '<div style="margin-bottom:16px"></div>'}
            
            <div style="overflow-x:auto;border-radius:12px;border:1px solid rgba(255,255,255,0.1)">
                <table style="width:100%;border-collapse:collapse;background:#0a0f16">
                    <thead>
                        <tr style="background:rgba(255,255,255,0.03);border-bottom:1px solid rgba(255,255,255,0.1)">
                            <th style="padding:12px;text-align:left;font-weight:600;width:60px">#</th>
                            <th style="padding:12px;text-align:left;font-weight:600;min-width:150px">Player</th>
                            ${stage.players[0]?.carryover > 0 ? '<th style="padding:12px;text-align:center;font-weight:600;width:70px">Carry</th>' : ''}
                            ${gameHeaders}
                            <th style="padding:12px;text-align:center;font-weight:600;width:80px">Avg</th>
                            <th style="padding:12px;text-align:center;font-weight:600;width:100px">Scratch</th>
                            <th style="padding:12px;text-align:center;font-weight:600;width:100px">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${players.map((player, idx) => renderPlayerRow(player, idx, stage, maxGames)).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

/**
 * Render a single-stage leaderboard (for tournaments without multiple stages)
 * 
 * @param {Player[]} players - Array of players to display
 * @returns {string} HTML string for the leaderboard
 */
function renderSingleStageLeaderboard(players) {
    // Determine max games
    const maxGames = Math.max(...players.map(p => p.scores?.length || 0), 3);
    const gameHeaders = Array.from({length: maxGames}, (_, i) => 
        `<th style="padding:12px;text-align:center;font-weight:600;width:70px">G${i+1}</th>`
    ).join('');
    
    return `
        <div style="margin-bottom:32px">
            <h2 style="margin:0 0 16px;font-size:1.5rem">🏆 Final Standings</h2>
            
            <div style="overflow-x:auto;border-radius:12px;border:1px solid rgba(255,255,255,0.1)">
                <table style="width:100%;border-collapse:collapse;background:#0a0f16">
                    <thead>
                        <tr style="background:rgba(255,255,255,0.03);border-bottom:1px solid rgba(255,255,255,0.1)">
                            <th style="padding:12px;text-align:left;font-weight:600;width:60px">#</th>
                            <th style="padding:12px;text-align:left;font-weight:600;min-width:150px">Player</th>
                            ${gameHeaders}
                            <th style="padding:12px;text-align:center;font-weight:600;width:80px">Avg</th>
                            <th style="padding:12px;text-align:center;font-weight:600;width:100px">Scratch</th>
                            <th style="padding:12px;text-align:center;font-weight:600;width:100px">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${players.map((player, idx) => renderPlayerRow(player, idx, null, maxGames)).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

/**
 * Render a single player row in the leaderboard
 * Includes position badge, name, game scores with handicap/bonus indicators,
 * average, scratch total, and total score
 * 
 * @param {Player} player - Player data
 * @param {number} index - Row index (unused, position comes from player.position)
 * @param {Stage|null} stage - Stage information (null for single-stage tournaments)
 * @param {number} maxGames - Maximum number of games to display
 * @returns {string} HTML string for the player row
 */
function renderPlayerRow(player, index, stage = null, maxGames = 0) {
    const position = player.position;
    const isTopThree = position <= 3;
    const isAdvancing = stage?.advancingBowlers && position <= stage.advancingBowlers;
    
    let positionBadge = position;
    if (position === 1) positionBadge = '🥇';
    else if (position === 2) positionBadge = '🥈';
    else if (position === 3) positionBadge = '🥉';
    
    const rowStyle = isTopThree 
        ? 'background:rgba(255,215,0,0.08);border-bottom:1px solid rgba(255,215,0,0.2)' 
        : isAdvancing
        ? 'background:rgba(46,143,220,0.05);border-bottom:1px solid rgba(255,255,255,0.05)'
        : 'border-bottom:1px solid rgba(255,255,255,0.05)';
    
    // Generate game score cells with handicap (superscript) and bonus (subscript)
    const gameCells = Array.from({length: maxGames}, (_, i) => {
        const score = player.scores?.[i];
        if (score !== undefined) {
            const isHigh = score === player.high;
            const bonus = player.bonusPins?.[i] || 0;
            const handicap = player.handicapPerGame || 0;
            
            let displayScore = score;
            if (handicap > 0) {
                displayScore += `<sup style="color:#fab005;font-size:0.7em">+${handicap}</sup>`;
            }
            if (bonus > 0) {
                displayScore += `<sub style="color:#51cf66;font-size:0.7em">+${bonus}</sub>`;
            }
            
            return `<td style="padding:12px;text-align:center;${isHigh ? 'color:#5eb6f5;font-weight:600' : 'color:#b9c6d8'}">${displayScore}</td>`;
        }
        return `<td style="padding:12px;text-align:center;color:#444">-</td>`;
    }).join('');
    
    return `
        <tr style="${rowStyle}">
            <td style="padding:12px;font-weight:600;font-size:1.1rem">${positionBadge}</td>
            <td style="padding:12px;font-weight:500">${player.playerName}</td>
            ${player.carryover > 0 ? `<td style="padding:12px;text-align:center;color:#51cf66;font-weight:600">${player.carryover}</td>` : ''}
            ${gameCells}
            <td style="padding:12px;text-align:center;font-weight:500">${player.average}</td>
            <td style="padding:12px;text-align:center;font-weight:600;color:#b9c6d8">${player.scratchTotal || player.total}</td>
            <td style="padding:12px;text-align:center;font-weight:700;font-size:1.1rem;color:#51cf66">${player.total}</td>
        </tr>
    `;
}

/**
 * Render a placeholder for a stage that hasn't started yet
 * 
 * @param {Stage} stage - Stage information
 * @param {number} stageIndex - Index of the stage (0 = qualifying)
 * @returns {string} HTML string for the empty stage placeholder
 */
function renderEmptyStage(stage, stageIndex) {
    const isQualifying = stageIndex === 0;
    const icon = isQualifying ? '🎯' : '🏆';
    
    return `
        <div style="margin-bottom:32px">
            <h2 style="margin:0 0 8px;font-size:1.5rem;color:#888;display:flex;align-items:center;gap:8px">
                ${icon} ${stage.stageName}
                <span style="font-size:0.9rem;font-weight:400">(${stage.games} games)</span>
            </h2>
            <div style="text-align:center;padding:32px;background:rgba(255,255,255,0.02);border-radius:12px;border:1px solid rgba(255,255,255,0.05)">
                <p style="color:#888;margin:0">Waiting for ${stageIndex === 0 ? 'scores' : 'previous stage to complete'}</p>
            </div>
        </div>
    `;
}

// ========================================
// APPLICATION START
// ========================================

// Initialize on page load
init();
