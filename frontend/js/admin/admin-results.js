const resultsTournamentFilter = document.getElementById('resultsTournamentFilter');
let currentTournamentForResults = null;

// Load tournaments for dropdown
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

// Tournament results management functions
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

function renderStagedResults(registrations) {
    const container = document.getElementById('resultsContainer');
    const stages = currentTournamentForResults.format.stages;
    let html = '';

    stages.forEach((stage, stageIndex) => {
        const stageName = stage.name;
        const gamesCount = stage.games;
        const advancingCount = stage.advancingBowlers;

        // Filter players in this stage
        let stagePlayers = registrations.filter(reg => 
            (reg.currentStage || 0) === stageIndex
        );

        // For qualifying stage (index 0), group by squad
        if (stageIndex === 0 && currentTournamentForResults.squads?.length > 0) {
            html += `<div style="margin-bottom:32px">
                <h2 style="margin:0 0 16px;color:#5eb6f5;display:flex;align-items:center;gap:8px">
                    🎯 ${stageName} 
                    <span style="font-size:.8rem;color:#b9c6d8;font-weight:400">(${gamesCount} games)</span>
                </h2>`;

            const squads = currentTournamentForResults.squads;
            squads.forEach(squad => {
                const squadPlayers = stagePlayers.filter(reg => 
                    reg.assignedSquads?.some(sid => sid.toString() === squad._id.toString())
                );

                if (squadPlayers.length > 0) {
                    html += renderStageTable(squadPlayers, stageIndex, gamesCount, squad.name);
                }
            });

            html += '</div>';
        } else {
            // Non-qualifying stages - show all together
            if (stagePlayers.length > 0) {
                html += `<div style="margin-bottom:32px">
                    <h2 style="margin:0 0 16px;color:#5eb6f5;display:flex;align-items:center;gap:8px">
                        ${stageIndex === stages.length - 1 ? '👑' : '🏆'} ${stageName}
                        <span style="font-size:.8rem;color:#b9c6d8;font-weight:400">(${gamesCount} games${advancingCount ? `, Top ${advancingCount} advance` : ''})</span>
                    </h2>`;
                html += renderStageTable(stagePlayers, stageIndex, gamesCount);
                html += '</div>';
            } else if (stageIndex > 0) {
                // Show placeholder for future stages
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
        }
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

function renderStageTable(players, stageIndex, gamesCount, squadName = null) {
    const gameHeaders = Array.from({length: gamesCount}, (_, i) => 
        `<th style="padding:8px;text-align:center;font-size:.85rem;color:#b9c6d8;width:70px">G${i+1}</th>`
    ).join('');

    const hasCarryover = stageIndex > 0 && currentTournamentForResults.format?.stages?.[stageIndex]?.carryoverPinfall;

    return `
        <div style="border:1px solid rgba(255,255,255,.1);border-radius:8px;padding:16px;background:rgba(255,255,255,.02);margin-bottom:16px">
            ${squadName ? `<h3 style="margin:0 0 12px;color:#b9c6d8">${squadName}</h3>` : ''}
            <div style="overflow-x:auto">
                <table style="width:100%;border-collapse:collapse;min-width:600px">
                    <thead>
                        <tr style="border-bottom:1px solid rgba(255,255,255,.08)">
                            <th style="padding:8px;text-align:left;font-size:.85rem;color:#b9c6d8;min-width:150px">Bowler</th>
                            ${hasCarryover ? '<th style="padding:8px;text-align:center;font-size:.85rem;color:#b9c6d8;width:70px">Carry</th>' : ''}
                            ${gameHeaders}
                            <th style="padding:8px;text-align:center;font-size:.85rem;color:#b9c6d8;width:80px">Total</th>
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

function renderPlayerStageRow(reg, stageIndex, gamesCount, hasCarryover) {
    const gameInputs = Array.from({length: gamesCount}, (_, i) => 
        `<td style="padding:4px;text-align:center">
            <input type="number" 
                id="score-${reg._id}-${stageIndex}-${i}"
                min="0" max="300" 
                placeholder="-"
                style="width:60px;padding:6px 4px;text-align:center;background:#141a22;border:1px solid rgba(255,255,255,.08);color:#e9eef7;border-radius:4px;font-size:.9rem"
                onblur="saveStageScores('${reg._id}', ${stageIndex}, ${gamesCount})"
                oninput="updateStageRowTotal('${reg._id}', ${stageIndex}, ${gamesCount})">
        </td>`
    ).join('');

    return `
        <tr style="border-bottom:1px solid rgba(255,255,255,.05)" id="row-${reg._id}-${stageIndex}">
            <td style="padding:8px;font-weight:500">${reg.playerName}</td>
            ${hasCarryover ? `<td style="padding:8px;text-align:center;color:#51cf66;font-weight:600" id="carryover-${reg._id}-${stageIndex}">-</td>` : ''}
            ${gameInputs}
            <td style="padding:8px;text-align:center;font-weight:600;color:#51cf66" id="total-${reg._id}-${stageIndex}">-</td>
            <td style="padding:8px;text-align:center;color:#b9c6d8" id="avg-${reg._id}-${stageIndex}">-</td>
        </tr>
    `;
}

function updateStageRowTotal(regId, stageIndex, gamesCount) {
    let total = 0;
    let gameCount = 0;

    for (let i = 0; i < gamesCount; i++) {
        const input = document.getElementById(`score-${regId}-${stageIndex}-${i}`);
        const value = parseInt(input?.value);
        if (!isNaN(value) && value > 0) {
            total += value;
            gameCount++;
        }
    }

    // Add carryover if exists
    const carryoverEl = document.getElementById(`carryover-${regId}-${stageIndex}`);
    const carryover = carryoverEl ? parseInt(carryoverEl.textContent) || 0 : 0;

    const totalEl = document.getElementById(`total-${regId}-${stageIndex}`);
    const avgEl = document.getElementById(`avg-${regId}-${stageIndex}`);

    const grandTotal = total + carryover;
    totalEl.textContent = gameCount > 0 ? grandTotal : '-';
    avgEl.textContent = gameCount > 0 ? Math.round(total / gameCount) : '-';
}

async function saveStageScores(regId, stageIndex, gamesCount) {
    const scores = [];
    
    for (let i = 0; i < gamesCount; i++) {
        const input = document.getElementById(`score-${regId}-${stageIndex}-${i}`);
        const value = parseInt(input?.value);
        if (!isNaN(value) && value > 0) {
            scores.push(value);
        }
    }

    try {
        const response = await fetch(`/api/registrations/${regId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                stageScores: { stageIndex, scores }
            })
        });

        if (response.ok) {
            console.log('Scores saved for stage', stageIndex, 'registration:', regId);
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

async function loadExistingStageScores(registrations) {
    for (const reg of registrations) {
        if (reg.stageScores && reg.stageScores.length > 0) {
            reg.stageScores.forEach(stageData => {
                const stageIndex = stageData.stageIndex;
                
                // Load carryover if exists
                if (stageData.carryover) {
                    const carryoverEl = document.getElementById(`carryover-${reg._id}-${stageIndex}`);
                    if (carryoverEl) {
                        carryoverEl.textContent = stageData.carryover;
                    }
                }

                // Load scores
                if (stageData.scores) {
                    stageData.scores.forEach((score, i) => {
                        const input = document.getElementById(`score-${reg._id}-${stageIndex}-${i}`);
                        if (input) {
                            input.value = score;
                        }
                    });
                    
                    const gamesCount = stageData.scores.length;
                    const stage = currentTournamentForResults.format?.stages?.[stageIndex];
                    const expectedGames = stage?.games || currentTournamentForResults.format?.gamesPerBowler || 3;
                    updateStageRowTotal(reg._id, stageIndex, expectedGames);
                }
            });
        }
    }
}

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