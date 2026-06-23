/**
 * @fileoverview Tournament Results Display System
 * Handles tournament results with stage-based leaderboards and score breakdowns.
 */

let currentTournamentData = null;

const tournamentSelect = document.getElementById('tournamentSelect');
const tournamentTitle = document.getElementById('tournamentTitle');
const tournamentSubtitle = document.getElementById('tournamentSubtitle');
const resultsContainer = document.getElementById('resultsContainer');

function renderResultsState(message, variant = 'default') {
    const toneClass = variant === 'error' ? ' is-error' : '';
    return `<div class="results-empty-state${toneClass}"><p>${message}</p></div>`;
}

async function init() {
    await loadTournaments();

    const urlParams = new URLSearchParams(window.location.search);
    const tournamentId = urlParams.get('id');
    if (tournamentId) {
        tournamentSelect.value = tournamentId;
        await loadTournamentResults();
    }

    tournamentSelect.addEventListener('change', loadTournamentResults);
}

async function loadTournaments() {
    try {
        const response = await fetch('/api/tournaments');
        const tournaments = await response.json();

        tournaments.sort((a, b) => new Date(b.startDate || b.date) - new Date(a.startDate || a.date));

        tournamentSelect.innerHTML = '<option value="">Choose a tournament...</option>';
        tournaments.forEach((tournament) => {
            const option = document.createElement('option');
            option.value = tournament._id;
            const date = new Date(tournament.startDate || tournament.date).toLocaleDateString();
            option.textContent = `${tournament.name} - ${date}`;
            tournamentSelect.appendChild(option);
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
        resultsContainer.innerHTML = renderResultsState('Please select a tournament to view results');
        return;
    }

    resultsContainer.innerHTML = renderResultsState('Loading results...');

    try {
        const response = await fetch(`/api/tournaments/${tournamentId}/results`);
        if (!response.ok) throw new Error('Failed to load results');

        currentTournamentData = await response.json();

        tournamentTitle.textContent = currentTournamentData.tournament.name;
        const date = new Date(currentTournamentData.tournament.date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        tournamentSubtitle.textContent = `${date} | ${currentTournamentData.tournament.location}`;

        renderResults();

        const url = new URL(window.location);
        url.searchParams.set('id', tournamentId);
        window.history.replaceState({}, '', url);
    } catch (error) {
        console.error('Error loading results:', error);
        resultsContainer.innerHTML = renderResultsState('Failed to load results. Please try again.', 'error');
    }
}

function renderResults() {
    if (!currentTournamentData) return;

    let html = '';

    if (currentTournamentData.hasStages) {
        currentTournamentData.stages.forEach((stage, index) => {
            if (stage.players.length === 0) {
                html += renderEmptyStage(stage, index);
            } else {
                html += renderStageLeaderboard(stage, stage.players, index);
            }
        });
    } else if (!currentTournamentData.players?.length) {
        html = renderResultsState('No results available yet');
    } else {
        html = renderSingleStageLeaderboard(currentTournamentData.players || []);
    }

    resultsContainer.innerHTML = html || renderResultsState('No results available yet');
}

function renderStageLeaderboard(stage, players, stageIndex) {
    const isQualifying = stageIndex === 0;
    const isFinal = stageIndex === currentTournamentData.stages.length - 1;
    const icon = isFinal ? 'Final' : isQualifying ? 'Qualifying' : 'Stage';
    const maxGames = Math.max(...players.map((player) => player.scores?.length || 0), stage.games);
    const gameHeaders = Array.from(
        { length: maxGames },
        (_, index) => `<th class="is-center">G${index + 1}</th>`
    ).join('');

    return `
        <section class="results-stage-card">
            <div class="results-stage-header">
                <h2 class="results-stage-title">
                    <span class="results-stage-icon">${icon}</span>
                    <span>${stage.stageName}</span>
                </h2>
                <div class="results-stage-meta">${stage.games} games</div>
            </div>
            ${stage.advancingBowlers ? `<p class="results-stage-note">Top ${stage.advancingBowlers} advance to the next stage</p>` : ''}
            <div class="results-table-wrap">
                <table class="results-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Player</th>
                            ${stage.players[0]?.carryover > 0 ? '<th class="is-center">Carry</th>' : ''}
                            ${gameHeaders}
                            <th class="is-center">Avg</th>
                            <th class="is-center">Scratch</th>
                            <th class="is-center">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${players.map((player, index) => renderPlayerRow(player, index, stage, maxGames)).join('')}
                    </tbody>
                </table>
            </div>
        </section>
    `;
}

function renderSingleStageLeaderboard(players) {
    const maxGames = Math.max(...players.map((player) => player.scores?.length || 0), 3);
    const gameHeaders = Array.from(
        { length: maxGames },
        (_, index) => `<th class="is-center">G${index + 1}</th>`
    ).join('');

    return `
        <section class="results-stage-card">
            <div class="results-stage-header">
                <h2 class="results-stage-title">
                    <span class="results-stage-icon">Final</span>
                    <span>Final Standings</span>
                </h2>
            </div>
            <div class="results-table-wrap">
                <table class="results-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Player</th>
                            ${gameHeaders}
                            <th class="is-center">Avg</th>
                            <th class="is-center">Scratch</th>
                            <th class="is-center">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${players.map((player, index) => renderPlayerRow(player, index, null, maxGames)).join('')}
                    </tbody>
                </table>
            </div>
        </section>
    `;
}

function renderPlayerRow(player, index, stage = null, maxGames = 0) {
    const position = player.position;
    const isTopThree = position <= 3;
    const isAdvancing = stage?.advancingBowlers && position <= stage.advancingBowlers;

    let positionBadge = position;
    if (position === 1) positionBadge = '#1';
    else if (position === 2) positionBadge = '#2';
    else if (position === 3) positionBadge = '#3';

    const rowClass = isTopThree ? 'is-top-three' : isAdvancing ? 'is-advancing' : '';

    const gameCells = Array.from({ length: maxGames }, (_, gameIndex) => {
        const score = player.scores?.[gameIndex];
        if (score !== undefined) {
            const isHigh = score === player.high;
            const bonus = player.bonusPins?.[gameIndex] || 0;
            const handicap = player.handicapPerGame || 0;

            let displayScore = score;
            if (handicap > 0) displayScore += `<sup>+${handicap}</sup>`;
            if (bonus > 0) displayScore += `<sub>+${bonus}</sub>`;

            return `<td class="is-center results-score-cell${isHigh ? ' is-high' : ''}">${displayScore}</td>`;
        }

        return '<td class="is-center results-score-empty">-</td>';
    }).join('');

    return `
        <tr class="${rowClass}">
            <td class="results-position">${positionBadge}</td>
            <td class="results-player-name">${player.playerName}</td>
            ${player.carryover > 0 ? `<td class="is-center results-carry">${player.carryover}</td>` : ''}
            ${gameCells}
            <td class="is-center">${player.average}</td>
            <td class="is-center results-scratch">${player.scratchTotal || player.total}</td>
            <td class="is-center results-total">${player.total}</td>
        </tr>
    `;
}

function renderEmptyStage(stage, stageIndex) {
    const icon = stageIndex === 0 ? 'Qualifying' : 'Stage';

    return `
        <section class="results-stage-card">
            <div class="results-stage-header">
                <h2 class="results-stage-title is-muted">
                    <span class="results-stage-icon">${icon}</span>
                    <span>${stage.stageName}</span>
                </h2>
                <div class="results-stage-meta">${stage.games} games</div>
            </div>
            <div class="results-empty-stage">
                <p>Waiting for ${stageIndex === 0 ? 'scores' : 'the previous stage to complete'}</p>
            </div>
        </section>
    `;
}

init();
