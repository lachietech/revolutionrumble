/**
 * @fileoverview Bowler stats page - displays and filters bowler statistics
 * Shows all registered bowlers with their statistics, averages, and tournament history.
 */

let allBowlers = [];
let filteredBowlers = [];

async function loadBowlers() {
    try {
        const response = await fetch('/api/bowlers');
        allBowlers = await response.json();
        applyFiltersAndSort();
    } catch (error) {
        console.error('Failed to load bowlers:', error);
        document.getElementById('empty-state').style.display = 'block';
    }
}

function applyFiltersAndSort() {
    const searchTerm = document.getElementById('search-input').value.toLowerCase();
    const sortValue = document.getElementById('sort-select').value;

    filteredBowlers = allBowlers.filter((bowler) => {
        const name = bowler.playerName?.toLowerCase() || '';
        const nickname = bowler.nickname?.toLowerCase() || '';
        return name.includes(searchTerm) || nickname.includes(searchTerm);
    });

    const [field, direction] = sortValue.split('-');
    filteredBowlers.sort((a, b) => {
        let aVal;
        let bVal;

        switch (field) {
            case 'tournamentAvg':
                aVal = a.tournamentAverage || 0;
                bVal = b.tournamentAverage || 0;
                break;
            case 'currentAvg':
                aVal = a.currentAverage || 0;
                bVal = b.currentAverage || 0;
                break;
            case 'name':
                aVal = a.playerName || '';
                bVal = b.playerName || '';
                break;
            case 'tournaments':
                aVal = a.tournamentsEntered?.length || 0;
                bVal = b.tournamentsEntered?.length || 0;
                break;
            default:
                aVal = 0;
                bVal = 0;
        }

        if (direction === 'asc') {
            return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
        }

        return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
    });

    renderBowlers();
}

function renderBowlers() {
    const grid = document.getElementById('bowlers-grid');
    const emptyState = document.getElementById('empty-state');

    if (filteredBowlers.length === 0) {
        grid.style.display = 'none';
        emptyState.style.display = 'block';
        return;
    }

    grid.style.display = 'grid';
    emptyState.style.display = 'none';

    grid.innerHTML = filteredBowlers.map((bowler, index) => {
        const tournamentAvg = bowler.tournamentAverage || '--';
        const currentAvg = bowler.currentAverage || '--';
        const highGame = bowler.highGame || '--';
        const tournaments = bowler.tournamentsEntered?.length || 0;
        const displayName = bowler.playerName || bowler.email?.split('@')[0] || 'Unknown';
        const nickname = bowler.nickname ? `"${bowler.nickname}"` : '';
        const handLabel = bowler.hand ? `${bowler.hand.charAt(0).toUpperCase() + bowler.hand.slice(1)}-handed` : 'Bowler';

        let rankBadge = '';
        const sortValue = document.getElementById('sort-select').value;
        if (sortValue.startsWith('tournamentAvg') && tournamentAvg !== '--') {
            if (index < 3) {
                const medals = ['#1', '#2', '#3'];
                rankBadge = `<div class="bowler-rank top-3">${medals[index]} Rank ${index + 1}</div>`;
            } else {
                rankBadge = `<div class="bowler-rank">Rank ${index + 1}</div>`;
            }
        }

        return `
            <a href="/bowler-hub" class="bowler-card">
                ${rankBadge}
                <div class="bowler-name">${displayName}</div>
                ${nickname ? `<div class="bowler-nickname">${nickname}</div>` : ''}
                <div class="bowler-stats">
                    <div class="stat-item">
                        <div class="stat-value">${tournamentAvg}</div>
                        <div class="stat-label">Tour Avg</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${currentAvg}</div>
                        <div class="stat-label">Book Avg</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${highGame}</div>
                        <div class="stat-label">High Game</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${tournaments}</div>
                        <div class="stat-label">Events</div>
                    </div>
                </div>
                <div class="bowler-meta">
                    <span>${handLabel}</span>
                    <span>View Profile -></span>
                </div>
            </a>
        `;
    }).join('');
}

document.getElementById('search-input').addEventListener('input', applyFiltersAndSort);
document.getElementById('sort-select').addEventListener('change', applyFiltersAndSort);

loadBowlers();
