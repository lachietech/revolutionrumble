// ===== Tournament Results with Stage-Based Leaderboards =====
let currentTournamentData = null;

const tournamentSelect = document.getElementById('tournamentSelect');
const tournamentTitle = document.getElementById('tournamentTitle');
const tournamentSubtitle = document.getElementById('tournamentSubtitle');
const resultsContainer = document.getElementById('resultsContainer');

// Initialize
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

function filterPlayers(players) {
    return players;
}

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
    
    // Generate game score cells
    const gameCells = Array.from({length: maxGames}, (_, i) => {
        const score = player.scores?.[i];
        if (score !== undefined) {
            const isHigh = score === player.high;
            return `<td style="padding:12px;text-align:center;${isHigh ? 'color:#5eb6f5;font-weight:600' : 'color:#b9c6d8'}">${score}</td>`;
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
            <td style="padding:12px;text-align:center;font-weight:700;font-size:1.1rem;color:#51cf66">${player.total}</td>
        </tr>
    `;
}

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

// Initialize on page load
init();