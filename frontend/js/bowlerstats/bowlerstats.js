/**
 * @fileoverview Bowler stats page - displays and filters bowler statistics
 * Shows all registered bowlers with their statistics, averages, and tournament history
 * Provides search and sorting functionality
 * @module bowlerstats
 */

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

/** @type {Array<Object>} All bowlers loaded from the API */
let allBowlers = [];

/** @type {Array<Object>} Filtered bowlers based on current search/sort criteria */
let filteredBowlers = [];

// ============================================================================
// DATA LOADING
// ============================================================================

/**
 * Loads all bowlers from the API
 * Fetches bowler data and applies default filtering and sorting
 * @async
 * @returns {Promise<void>}
 * @throws {Error} If the API request fails
 */
async function loadBowlers() {
    try {
        const response = await fetch('/api/bowlers');
        allBowlers = await response.json();
        
        // Apply sorting and filtering
        applyFiltersAndSort();
    } catch (error) {
        console.error('Failed to load bowlers:', error);
        document.getElementById('empty-state').style.display = 'block';
    }
}

// ============================================================================
// UI RENDERING
// ============================================================================

/**
 * Applies search filters and sorting to the bowler list
 * Filters bowlers by search term (name/nickname) and sorts by selected criteria
 * @returns {void}
 */
function applyFiltersAndSort() {
    const searchTerm = document.getElementById('search-input').value.toLowerCase();
    const sortValue = document.getElementById('sort-select').value;
    
    // Filter
    filteredBowlers = allBowlers.filter(bowler => {
        const name = bowler.playerName?.toLowerCase() || '';
        const nickname = bowler.nickname?.toLowerCase() || '';
        return name.includes(searchTerm) || nickname.includes(searchTerm);
    });
    
    // Sort
    const [field, direction] = sortValue.split('-');
    filteredBowlers.sort((a, b) => {
        let aVal, bVal;
        
        switch(field) {
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
        } else {
            return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
        }
    });
    
    renderBowlers();
}

/**
 * Renders the bowler grid with filtered and sorted bowlers
 * Displays bowler cards with statistics, rankings, and profile links
 * @returns {void}
 */
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
        
        // Determine rank badge
        let rankBadge = '';
        const sortValue = document.getElementById('sort-select').value;
        if (sortValue.startsWith('tournamentAvg') && tournamentAvg !== '--') {
            if (index < 3) {
                const medals = ['🥇', '🥈', '🥉'];
                rankBadge = `<div class="bowler-rank top-3">${medals[index]} Rank #${index + 1}</div>`;
            } else {
                rankBadge = `<div class="bowler-rank">Rank #${index + 1}</div>`;
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
                    <span>${bowler.hand ? `${bowler.hand.charAt(0).toUpperCase() + bowler.hand.slice(1)}-handed` : ''}</span>
                    <span>View Profile →</span>
                </div>
            </a>
        `;
    }).join('');
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

// Listen for search input changes
document.getElementById('search-input').addEventListener('input', applyFiltersAndSort);

// Listen for sort selection changes
document.getElementById('sort-select').addEventListener('change', applyFiltersAndSort);

// ============================================================================
// INITIALIZATION
// ============================================================================

// Initialize by loading all bowlers
loadBowlers();
