/**
 * @fileoverview Squad list page - displays tournament squads and registered bowlers
 * Shows squad schedules, capacity, and registered bowlers for selected tournaments
 * @module squadlist
 */

// ============================================================================
// DOM ELEMENTS
// ============================================================================

/** @type {HTMLSelectElement} Tournament selection dropdown */
const tournamentSelect = document.getElementById('tournamentSelect');

// ============================================================================
// DATA LOADING
// ============================================================================

/**
 * Loads all tournaments and populates the tournament selection dropdown
 * Automatically loads squads if a tournament ID is present in the URL
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
        
        // Check URL parameter for tournament ID
        const urlParams = new URLSearchParams(window.location.search);
        const tournamentId = urlParams.get('id');
        if (tournamentId) {
            tournamentSelect.value = tournamentId;
            await loadSquads(tournamentId);
        }
    } catch (error) {
        console.error('Error loading tournaments:', error);
    }
}

/**
 * Loads squad details for a specific tournament
 * Fetches squad information, bowler lists, and availability from the API
 * @async
 * @param {string} tournamentId - The unique identifier of the tournament
 * @returns {Promise<void>}
 * @throws {Error} If the API request fails
 */
async function loadSquads(tournamentId) {
    try {
        if (!tournamentId) {
            document.getElementById('squads-container').innerHTML = '<div class="error">No tournament specified</div>';
            return;
        }

        document.getElementById('squads-container').innerHTML = '<div class="loading"><p>Loading squad information...</p></div>';

        const response = await fetch(`/api/tournaments/${tournamentId}/squads/list`);
        if (!response.ok) {
            throw new Error('Failed to load squad data');
        }

        const data = await response.json();
        const { tournament, squads } = data;

        // Update page title and subtitle
        document.title = `${tournament.name} - Squad Lists — Revolution Rumble`;
        document.getElementById('subtitle').textContent = tournament.name;

        // Display tournament info
        const date = new Date(tournament.startDate || tournament.date);
        const formattedDate = date.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });

        document.getElementById('tournament-info').innerHTML = `
            <div class="tournament-info">
                <h2>${tournament.name}</h2>
                <div class="tournament-meta">
                    <div class="meta-item">📅 ${formattedDate}</div>
                    <div class="meta-item">📍 ${tournament.location}</div>
                    ${tournament.squadsRequiredToQualify > 0 ? `<div class="meta-item">🎯 ${tournament.squadsRequiredToQualify} qualifying squad${tournament.squadsRequiredToQualify > 1 ? 's' : ''} required</div>` : ''}
                </div>
            </div>
        `;

        // Display squads
        if (squads.length === 0) {
            document.getElementById('squads-container').innerHTML = '<div class="empty-squad">No squads configured for this tournament</div>';
            return;
        }

        document.getElementById('squads-container').innerHTML = `
            <div class="squads-grid">
                ${squads.map(squad => {
                    const isFull = squad.spotsRemaining <= 0;
                    const squadDate = new Date(squad.date);
                    const dateStr = squadDate.toLocaleDateString('en-US', { 
                        weekday: 'short',
                        month: 'short', 
                        day: 'numeric' 
                    });

                    return `
                        <div class="squad-card">
                            <div class="squad-header">
                                <div class="squad-title">
                                    ${squad.name}
                                    ${squad.isQualifying ? '<span class="qualifying-badge">QUALIFYING</span>' : ''}
                                </div>
                                <div class="squad-details">
                                    <span>📅 ${dateStr}</span>
                                    <span>⏰ ${squad.time}</span>
                                </div>
                            </div>
                            
                            <div class="capacity-info${isFull ? ' full' : ''}">
                                <span class="capacity-label">Registered / Capacity</span>
                                <span class="capacity-count">${squad.bowlers.length} / ${squad.capacity}</span>
                            </div>
                            
                            ${squad.bowlers.length > 0 ? `
                                <ul class="bowlers-list">
                                    ${squad.bowlers.map(bowler => `
                                        <li class="bowler-item">
                                            <span class="bowler-name">
                                                ${bowler.bowlerId ? `<a href="/playerstats?id=${bowler.bowlerId}">${bowler.name}</a>` : bowler.name}
                                            </span>
                                            ${bowler.averageScore ? `<span class="bowler-avg">Avg: ${bowler.averageScore}</span>` : ''}
                                        </li>
                                    `).join('')}
                                </ul>
                            ` : '<div class="empty-squad">No bowlers registered yet</div>'}
                        </div>
                    `;
                }).join('')}
            </div>
        `;

    } catch (error) {
        console.error('Failed to load squads:', error);
        document.getElementById('squads-container').innerHTML = '<div class="error">Failed to load squad information</div>';
    }
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

/**
 * Handles tournament selection changes
 * Updates the URL and loads squad data for the selected tournament
 */
tournamentSelect.addEventListener('change', async () => {
    const tournamentId = tournamentSelect.value;
    if (tournamentId) {
        // Update URL
        const url = new URL(window.location);
        url.searchParams.set('id', tournamentId);
        window.history.replaceState({}, '', url);
        
        await loadSquads(tournamentId);
    } else {
        document.getElementById('tournament-info').innerHTML = '';
        document.getElementById('squads-container').innerHTML = '<div class="loading"><p>Please select a tournament to view squad lists</p></div>';
    }
});

// ============================================================================
// INITIALIZATION
// ============================================================================

loadTournaments();