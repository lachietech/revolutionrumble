/**
 * @fileoverview Admin Results Management
 */

let csrfToken = null;
const resultsTournamentFilter = document.getElementById('resultsTournamentFilter');
let currentTournamentForResults = null;
const MATCH_STAGE_TYPES = new Set(['round_robin', 'tri_matchplay', 'elimination', 'stepladder']);

loadTournamentsForDropdown();
resultsTournamentFilter.addEventListener('change', loadTournamentResults);

async function ensureCsrfToken() {
    if (csrfToken) return;
    const csrfResponse = await fetch('/api/csrf-token');
    const csrfData = await csrfResponse.json();
    csrfToken = csrfData.csrfToken;
}

async function loadTournamentsForDropdown() {
    try {
        await ensureCsrfToken();
        const response = await fetch('/api/tournaments');
        const tournaments = await response.json();

        resultsTournamentFilter.innerHTML = '<option value="">Choose a tournament...</option>' +
            tournaments.map((tournament) => {
                const date = new Date(tournament.startDate || tournament.date).toLocaleDateString();
                return `<option value="${tournament._id}">${tournament.name} (${date})</option>`;
            }).join('');
    } catch (error) {
        console.error('Error loading tournaments:', error);
    }
}

async function loadTournamentResults() {
    const tournamentId = resultsTournamentFilter.value;
    const container = document.getElementById('resultsContainer');

    if (!tournamentId) {
        container.innerHTML = '<p class="admin-empty-state">Select a tournament to manage results.</p>';
        return;
    }

    try {
        const tournamentsRes = await fetch('/api/tournaments');
        const tournaments = await tournamentsRes.json();
        currentTournamentForResults = tournaments.find((tournament) => tournament._id === tournamentId);

        const regRes = await fetch(`/api/registrations?tournamentId=${tournamentId}`);
        const registrations = await regRes.json();

        if (registrations.length === 0) {
            container.innerHTML = '<p class="admin-empty-state">No registrations for this tournament.</p>';
            return;
        }

        if (currentTournamentForResults.format?.hasStages && currentTournamentForResults.format.stages?.length > 0) {
            renderStagedResults(registrations);
        } else {
            renderSingleStageResults(registrations);
        }
    } catch (error) {
        console.error('Error loading results:', error);
        container.innerHTML = '<p class="admin-empty-state">Failed to load tournament data.</p>';
    }
}

function renderStagedResults(registrations) {
    const container = document.getElementById('resultsContainer');
    const stages = currentTournamentForResults.format.stages;
    let html = '';

    stages.forEach((stage, stageIndex) => {
        const stagePlayers = registrations.filter((registration) => {
            const hasScoresInStage = registration.stageScores?.some((score) => score.stageIndex === stageIndex);
            const isCurrentlyInStage = (registration.currentStage || 0) === stageIndex;
            return hasScoresInStage || isCurrentlyInStage;
        });

        if (stagePlayers.length === 0) {
            if (stageIndex > 0) {
                html += renderWaitingStage(stage, stages[stageIndex - 1].name);
            }
            return;
        }

        const hasCurrentPlayers = stagePlayers.some((registration) => (registration.currentStage || 0) === stageIndex);
        const stageId = `stage-${stageIndex}`;
        let stageContent = '';

        if (stageIndex === 0 && currentTournamentForResults.squads?.length > 0) {
            currentTournamentForResults.squads.forEach((squad) => {
                const squadPlayers = stagePlayers.filter((registration) =>
                    registration.assignedSquads?.some((squadId) => squadId.toString() === squad._id.toString())
                );

                if (squadPlayers.length > 0) {
                    stageContent += renderStageTable(squadPlayers, stageIndex, stage.games, squad.name);
                }
            });
        } else {
            stageContent += renderStageTable(stagePlayers, stageIndex, stage.games);
        }

        html += `
            <section class="results-stage">
                <button class="results-stage-toggle" type="button" onclick="toggleStageSection('${stageId}')">
                    <span id="${stageId}-icon" class="results-stage-arrow" style="transform:rotate(${hasCurrentPlayers ? '90deg' : '0deg'})">▶</span>
                    <span class="results-stage-title">
                        <strong>${stage.name}</strong>
                        <span>${buildStageMeta(stage)}</span>
                    </span>
                    <span class="results-stage-meta">${stagePlayers.length} ${stagePlayers.length === 1 ? 'bowler' : 'bowlers'}</span>
                </button>
                <div id="${stageId}-content" class="results-stage-content" style="display:${hasCurrentPlayers ? 'block' : 'none'}">
                    ${stageContent}
                </div>
            </section>
        `;
    });

    html += `
        <div class="results-advance">
            <button class="button" type="button" onclick="advancePlayersToNextStage()">Auto-Advance Qualified Players</button>
            <p>Automatically moves top players to the next stages based on your format rules.</p>
        </div>
    `;

    container.innerHTML = html;
    loadExistingStageScores(registrations);
}

function renderWaitingStage(stage, previousStageName) {
    return `
        <section class="results-stage">
            <button class="results-stage-toggle" type="button">
                <span class="results-stage-arrow">▶</span>
                <span class="results-stage-title">
                    <strong>${stage.name}</strong>
                    <span>${buildStageMeta(stage)}</span>
                </span>
            </button>
            <p class="results-waiting">Waiting for ${previousStageName} to complete.</p>
        </section>
    `;
}

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

function renderSingleStageResults(registrations) {
    const container = document.getElementById('resultsContainer');
    const gamesCount = currentTournamentForResults?.format?.gamesPerBowler || 3;
    let innerContent = '';

    if (currentTournamentForResults.squads?.length > 0) {
        currentTournamentForResults.squads.forEach((squad) => {
            const squadPlayers = registrations.filter((registration) =>
                registration.assignedSquads?.some((squadId) => squadId.toString() === squad._id.toString())
            );

            if (squadPlayers.length > 0) {
                innerContent += renderStageTable(squadPlayers, 0, gamesCount, squad.name);
            }
        });
    } else {
        innerContent += renderStageTable(registrations, 0, gamesCount);
    }

    container.innerHTML = `
        <section class="results-stage">
            <button class="results-stage-toggle" type="button">
                <span class="results-stage-arrow" style="transform:rotate(90deg)">▶</span>
                <span class="results-stage-title">
                    <strong>Tournament Scores</strong>
                    <span>${gamesCount} games</span>
                </span>
            </button>
            <div class="results-stage-content">
                ${innerContent}
            </div>
        </section>
    `;

    loadExistingStageScores(registrations);
}

function renderStageTable(players, stageIndex, gamesCount, squadName = null) {
    const gameHeaders = Array.from({ length: gamesCount }, (_, gameIndex) => `<th>G${gameIndex + 1}</th>`).join('');
    const hasCarryover = stageIndex > 0 && currentTournamentForResults.format?.stages?.[stageIndex]?.carryoverPinfall;

    return `
        <div class="results-group">
            ${squadName ? `<h3>${squadName}</h3>` : ''}
            <div class="results-table-wrap">
                <table class="results-table">
                    <thead>
                        <tr>
                            <th>Bowler</th>
                            ${hasCarryover ? '<th>Carry</th>' : ''}
                            ${gameHeaders}
                            <th>Scratch</th>
                            <th>Total</th>
                            <th>Avg</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${players.map((registration) => renderPlayerStageRow(registration, stageIndex, gamesCount, hasCarryover)).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function buildStageMeta(stage) {
    const meta = [`${stage.games} games`];
    if (stage.type) meta.push(stage.type.replaceAll('_', ' '));
    if (stage.advancingBowlers) meta.push(`Top ${stage.advancingBowlers} advance`);
    return meta.join(', ');
}

function getStageMatchPlaySettings(stageIndex) {
    const stage = currentTournamentForResults?.format?.stages?.[stageIndex];
    return {
        pointsForWin: Number(stage?.matchPlaySettings?.pointsForWin ?? currentTournamentForResults?.format?.matchPlay?.pointsForWin ?? 30),
        pointsForTie: Number(stage?.matchPlaySettings?.pointsForTie ?? currentTournamentForResults?.format?.matchPlay?.pointsForTie ?? 15),
        pointsForLoss: Number(stage?.matchPlaySettings?.pointsForLoss ?? currentTournamentForResults?.format?.matchPlay?.pointsForLoss ?? 0),
        includePinfall: stage?.matchPlaySettings?.includePinfall ?? currentTournamentForResults?.format?.matchPlay?.includePinfall ?? true
    };
}

function stageUsesMatchBonus(stageIndex) {
    const stage = currentTournamentForResults?.format?.stages?.[stageIndex];
    return MATCH_STAGE_TYPES.has(stage?.type) || Boolean(stage?.matchPlaySettings);
}

function renderPlayerStageRow(registration, stageIndex, gamesCount, hasCarryover) {
    const allowBonusFlags = stageUsesMatchBonus(stageIndex);
    const gameInputs = Array.from({ length: gamesCount }, (_, gameIndex) => `
        <td>
            <input type="number"
                class="results-score-input"
                id="score-${registration._id}-${stageIndex}-${gameIndex}"
                min="0"
                max="300"
                placeholder="-"
                onblur="saveStageScores('${registration._id}', ${stageIndex}, ${gamesCount})"
                oninput="updateStageRowTotal('${registration._id}', ${stageIndex}, ${gamesCount})">
            <div class="results-bonus-flags">
                <label class="is-win">
                    <input type="checkbox"
                        id="win-${registration._id}-${stageIndex}-${gameIndex}"
                        ${allowBonusFlags ? '' : 'disabled'}
                        onchange="handleMatchplayChange('${registration._id}', ${stageIndex}, ${gameIndex}, 'win'); saveStageScores('${registration._id}', ${stageIndex}, ${gamesCount})">W
                </label>
                <label class="is-tie">
                    <input type="checkbox"
                        id="tie-${registration._id}-${stageIndex}-${gameIndex}"
                        ${allowBonusFlags ? '' : 'disabled'}
                        onchange="handleMatchplayChange('${registration._id}', ${stageIndex}, ${gameIndex}, 'tie'); saveStageScores('${registration._id}', ${stageIndex}, ${gamesCount})">T
                </label>
            </div>
        </td>
    `).join('');

    let totalHandicap = 0;
    if (currentTournamentForResults.format?.useHandicap) {
        const baseScore = currentTournamentForResults.format.handicapBase || 220;
        const handicapPct = currentTournamentForResults.format.handicapPercentage || 90;
        const averageScore = registration.averageScore || 180;
        const handicapPerGame = averageScore < baseScore ? Math.round((baseScore - averageScore) * (handicapPct / 100)) : 0;
        const femaleBonus = (registration.gender === 'female' && !currentTournamentForResults.format.separateDivisions)
            ? (currentTournamentForResults.format.femaleHandicapPins || 8)
            : 0;
        totalHandicap = handicapPerGame + femaleBonus;
    }

    return `
        <tr class="results-row" id="row-${registration._id}-${stageIndex}">
            <td class="results-player">
                ${registration.playerName}
                ${totalHandicap > 0 ? `<small>+${totalHandicap}/game handicap</small>` : ''}
            </td>
            ${hasCarryover ? `<td class="results-calc is-accent" id="carryover-${registration._id}-${stageIndex}">-</td>` : ''}
            ${gameInputs}
            <td class="results-calc" id="scratch-${registration._id}-${stageIndex}">-</td>
            <td class="results-calc is-accent" id="total-${registration._id}-${stageIndex}">-</td>
            <td class="results-calc" id="avg-${registration._id}-${stageIndex}">-</td>
        </tr>
    `;
}

function handleMatchplayChange(regId, stageIndex, gameIndex, type) {
    const winCheckbox = document.getElementById(`win-${regId}-${stageIndex}-${gameIndex}`);
    const tieCheckbox = document.getElementById(`tie-${regId}-${stageIndex}-${gameIndex}`);

    if (type === 'win' && winCheckbox.checked) {
        tieCheckbox.checked = false;
    } else if (type === 'tie' && tieCheckbox.checked) {
        winCheckbox.checked = false;
    }
}

function updateStageRowTotal(regId, stageIndex, gamesCount) {
    let scratchTotal = 0;
    let bonusTotal = 0;
    let gameCount = 0;
    const matchSettings = getStageMatchPlaySettings(stageIndex);

    const row = document.getElementById(`row-${regId}-${stageIndex}`);
    if (!row) return;

    const handicapMatch = row.textContent.match(/\+(\d+)\/game handicap/);
    const handicapPerGame = handicapMatch ? parseInt(handicapMatch[1], 10) : 0;

    for (let gameIndex = 0; gameIndex < gamesCount; gameIndex++) {
        const input = document.getElementById(`score-${regId}-${stageIndex}-${gameIndex}`);
        const value = parseInt(input?.value, 10);

        if (!Number.isNaN(value) && value > 0) {
            scratchTotal += value;
            gameCount += 1;

            const winCheckbox = document.getElementById(`win-${regId}-${stageIndex}-${gameIndex}`);
            const tieCheckbox = document.getElementById(`tie-${regId}-${stageIndex}-${gameIndex}`);

            if (winCheckbox?.checked) {
                bonusTotal += matchSettings.pointsForWin;
            } else if (tieCheckbox?.checked) {
                bonusTotal += matchSettings.pointsForTie;
            }
        }
    }

    const handicapTotal = handicapPerGame * gameCount;
    const carryoverEl = document.getElementById(`carryover-${regId}-${stageIndex}`);
    const carryover = carryoverEl ? parseInt(carryoverEl.textContent, 10) || 0 : 0;

    const scratchEl = document.getElementById(`scratch-${regId}-${stageIndex}`);
    const totalEl = document.getElementById(`total-${regId}-${stageIndex}`);
    const avgEl = document.getElementById(`avg-${regId}-${stageIndex}`);

    if (!scratchEl || !totalEl || !avgEl) return;

    const scratchWithCarry = scratchTotal + carryover;
    const grandTotal = scratchTotal + handicapTotal + bonusTotal + carryover;

    scratchEl.textContent = gameCount > 0 ? scratchWithCarry : '-';
    totalEl.textContent = gameCount > 0 ? grandTotal : '-';
    avgEl.textContent = gameCount > 0 ? Math.round(scratchTotal / gameCount) : '-';
}

async function saveStageScores(regId, stageIndex, gamesCount) {
    await ensureCsrfToken();

    const scores = [];
    const bonusPins = [];
    const matchSettings = getStageMatchPlaySettings(stageIndex);
    const row = document.getElementById(`row-${regId}-${stageIndex}`);
    const handicapMatch = row?.textContent.match(/\+(\d+)\/game handicap/);
    const handicap = handicapMatch ? parseInt(handicapMatch[1], 10) : 0;

    for (let gameIndex = 0; gameIndex < gamesCount; gameIndex++) {
        const input = document.getElementById(`score-${regId}-${stageIndex}-${gameIndex}`);
        const value = parseInt(input?.value, 10);

        if (!Number.isNaN(value) && value > 0) {
            scores.push(value);

            const winCheckbox = document.getElementById(`win-${regId}-${stageIndex}-${gameIndex}`);
            const tieCheckbox = document.getElementById(`tie-${regId}-${stageIndex}-${gameIndex}`);
            let bonus = 0;
            if (winCheckbox?.checked) bonus = matchSettings.pointsForWin;
            if (tieCheckbox?.checked) bonus = matchSettings.pointsForTie;
            bonusPins.push(bonus);
        } else {
            bonusPins.push(0);
        }
    }

    try {
        const response = await fetch(`/api/registrations/${regId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken
            },
            credentials: 'same-origin',
            body: JSON.stringify({
                stageScores: { stageIndex, scores, bonusPins, handicap }
            })
        });

        if (response.ok) {
            const activeRow = document.getElementById(`row-${regId}-${stageIndex}`);
            if (activeRow) {
                activeRow.classList.add('is-saved');
                setTimeout(() => activeRow.classList.remove('is-saved'), 700);
            }
        } else {
            const error = await response.json();
            alert(`Failed to save scores: ${error.error}`);
        }
    } catch (error) {
        console.error('Error saving scores:', error);
    }
}

async function loadExistingStageScores(registrations) {
    for (const registration of registrations) {
        if (!registration.stageScores || registration.stageScores.length === 0) continue;

        registration.stageScores.forEach((stageData) => {
            const stageIndex = stageData.stageIndex;

            if (stageData.carryover) {
                const carryoverEl = document.getElementById(`carryover-${registration._id}-${stageIndex}`);
                if (carryoverEl) {
                    carryoverEl.textContent = stageData.carryover;
                }
            }

            if (stageData.scores && stageData.scores.length > 0) {
                stageData.scores.forEach((score, gameIndex) => {
                    const input = document.getElementById(`score-${registration._id}-${stageIndex}-${gameIndex}`);
                    if (input) {
                        input.value = score;

                        if (stageData.bonusPins && stageData.bonusPins[gameIndex]) {
                            if (stageData.bonusPins[gameIndex] === 30) {
                                const winCheckbox = document.getElementById(`win-${registration._id}-${stageIndex}-${gameIndex}`);
                                if (winCheckbox) winCheckbox.checked = true;
                            } else if (stageData.bonusPins[gameIndex] === 15) {
                                const tieCheckbox = document.getElementById(`tie-${registration._id}-${stageIndex}-${gameIndex}`);
                                if (tieCheckbox) tieCheckbox.checked = true;
                            }
                        }
                    }
                });

                const stage = currentTournamentForResults.format?.stages?.[stageIndex];
                const expectedGames = stage?.games || currentTournamentForResults.format?.gamesPerBowler || 6;
                updateStageRowTotal(registration._id, stageIndex, expectedGames);
            }
        });
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
        await ensureCsrfToken();
        const regRes = await fetch(`/api/registrations?tournamentId=${currentTournamentForResults._id}`);
        const registrations = await regRes.json();
        let advancedCount = 0;

        for (let stageIndex = 0; stageIndex < stages.length - 1; stageIndex++) {
            const stage = stages[stageIndex];
            const nextStage = stages[stageIndex + 1];

            if (!stage.advancingBowlers) continue;

            const stagePlayers = registrations.filter((registration) => {
                const currentStage = registration.currentStage || 0;
                if (currentStage !== stageIndex) return false;
                const stageScore = registration.stageScores?.find((score) => score.stageIndex === stageIndex);
                return stageScore && stageScore.scores?.length === stage.games;
            });

            if (stagePlayers.length === 0) continue;

            const playersWithTotals = stagePlayers.map((registration) => {
                const stageScore = registration.stageScores.find((score) => score.stageIndex === stageIndex);
                const total = stageScore.scores.reduce((sum, score) => sum + score, 0) + (stageScore.carryover || 0);
                return { registration, total };
            }).sort((a, b) => b.total - a.total);

            const toAdvance = playersWithTotals.slice(0, stage.advancingBowlers);

            for (const { registration, total } of toAdvance) {
                let carryover = 0;
                if (nextStage.carryoverPinfall) {
                    const carryoverPct = nextStage.carryoverPercentage || 100;
                    carryover = Math.round(total * (carryoverPct / 100));
                }

                await fetch(`/api/registrations/${registration._id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-Token': csrfToken
                    },
                    credentials: 'same-origin',
                    body: JSON.stringify({
                        currentStage: stageIndex + 1,
                        carryoverToNextStage: carryover
                    })
                });

                advancedCount += 1;
            }
        }

        if (advancedCount > 0) {
            alert(`Advanced ${advancedCount} player(s) to the next stage(s).`);
            loadTournamentResults();
        } else {
            alert('No players ready to advance. Make sure all games are complete for each stage.');
        }
    } catch (error) {
        console.error('Error advancing players:', error);
        alert(`Failed to advance players: ${error.message}`);
    }
}
