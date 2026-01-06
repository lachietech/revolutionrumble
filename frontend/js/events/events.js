/**
 * @fileoverview Events page - displays and manages tournament event listings
 * Loads tournaments from the API and displays them grouped by status (ongoing, upcoming, completed)
 * @module events
 */

// ============================================================================
// DATA LOADING
// ============================================================================

/**
 * Loads all tournaments from the API and displays them grouped by status
 * Fetches tournament data, groups by status, sorts chronologically, and renders event cards
 * @async
 * @returns {Promise<void>}
 * @throws {Error} If the API request fails
 */
async function loadEvents() {
    try {
        const response = await fetch('/api/tournaments');
        const tournaments = await response.json();

        if (tournaments.length === 0) {
            document.getElementById('empty-state').style.display = 'block';
            return;
        }

        // Group by status
        const ongoing = tournaments.filter(t => t.status === 'ongoing');
        const upcoming = tournaments.filter(t => t.status === 'upcoming');
        const completed = tournaments.filter(t => t.status === 'completed');

        // Sort by date
        upcoming.sort((a, b) => new Date(a.date) - new Date(b.date));
        completed.sort((a, b) => new Date(b.date) - new Date(a.date));

        // Render each section
        if (ongoing.length > 0) {
            document.getElementById('ongoing-section').style.display = 'block';
            document.getElementById('ongoing-events').innerHTML = ongoing.map(renderEventCard).join('');
        }

        if (upcoming.length > 0) {
            document.getElementById('upcoming-section').style.display = 'block';
            document.getElementById('upcoming-events').innerHTML = upcoming.map(renderEventCard).join('');
        }

        if (completed.length > 0) {
            document.getElementById('completed-section').style.display = 'block';
            document.getElementById('completed-events').innerHTML = completed.map(renderEventCard).join('');
        }

    } catch (error) {
        console.error('Failed to load events:', error);
        document.getElementById('empty-state').style.display = 'block';
        document.getElementById('empty-state').innerHTML = `
            <div class="empty-state-icon">⚠️</div>
            <h3>Unable to Load Events</h3>
            <p>Please try again later.</p>
        `;
    }
}

// ============================================================================
// UI RENDERING
// ============================================================================

/**
 * Renders an individual event card with tournament information
 * Creates HTML for displaying tournament details, status, and action buttons
 * @param {Object} tournament - The tournament object to render
 * @param {string} tournament._id - Tournament unique identifier
 * @param {string} tournament.name - Tournament name
 * @param {string} tournament.location - Tournament location
 * @param {string} tournament.status - Tournament status (upcoming/ongoing/completed)
 * @param {string} tournament.startDate - Tournament start date (ISO format)
 * @param {string} [tournament.endDate] - Tournament end date (ISO format)
 * @param {string} [tournament.description] - Tournament description
 * @param {string} [tournament.registrationDeadline] - Registration deadline (ISO format)
 * @param {number} [tournament.maxParticipants] - Maximum number of participants
 * @param {Array} [tournament.squads] - Array of squad objects
 * @returns {string} HTML string for the event card
 */
function renderEventCard(tournament) {
    const startDate = new Date(tournament.startDate || tournament.date);
    const endDate = new Date(tournament.endDate || tournament.date);
    
    const day = startDate.getDate();
    const month = startDate.toLocaleDateString('en-US', { month: 'short' });
    const year = startDate.getFullYear();
    
    // Format date range
    const fullDate = startDate.toDateString() === endDate.toDateString()
        ? startDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
        : `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`;

    const statusClass = `status-${tournament.status}`;
    const statusText = tournament.status.charAt(0).toUpperCase() + tournament.status.slice(1);

    const now = new Date();
    const isPast = tournament.status === 'completed';
    const isOngoing = tournament.status === 'ongoing';
    const canRegister = tournament.status === 'upcoming' && 
        (!tournament.registrationDeadline || new Date(tournament.registrationDeadline) > now);
    
    const hasSquads = tournament.squads && tournament.squads.length > 0;

    let metaItems = [];
    if (tournament.maxParticipants) {
        metaItems.push(`<div class="event-meta-item">👥 Max ${tournament.maxParticipants} players</div>`);
    }
    if (tournament.registrationDeadline && !isPast) {
        const regDate = new Date(tournament.registrationDeadline).toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric' 
        });
        metaItems.push(`<div class="event-meta-item">⏰ Register by ${regDate}</div>`);
    }
    if (hasSquads) {
        metaItems.push(`<div class="event-meta-item">🎯 ${tournament.squads.length} squad${tournament.squads.length > 1 ? 's' : ''}</div>`);
    }

    return `
        <div class="event-card">
            <div class="event-header">
                <div>
                    <div class="event-date">${day}</div>
                    <div class="event-date-details">${month} ${year}</div>
                </div>
                <span class="status-badge ${statusClass}">${statusText}</span>
            </div>
            
            <h3 class="event-name">${tournament.name}</h3>
            <div class="event-location">📍 ${tournament.location}</div>
            
            ${tournament.description ? `<p class="event-description">${tournament.description}</p>` : ''}
            
            ${metaItems.length > 0 ? `<div class="event-meta">${metaItems.join('')}</div>` : ''}
            
            <div class="event-actions">
                ${isPast 
                    ? `<a href="/results?id=${tournament._id}" class="btn-action btn-primary">View Results</a>`
                    : isOngoing
                        ? `<a href="/results?id=${tournament._id}" class="btn-action btn-primary">Live Results</a>`
                        : canRegister
                            ? `<a href="/register" class="btn-action btn-primary">Register Now</a>`
                            : `<button class="btn-action btn-disabled" disabled>Registration Closed</button>`
                }
                ${hasSquads ? `<a href="/squads?id=${tournament._id}" class="btn-action btn-secondary">View Squads</a>` : `<a href="/playerstats" class="btn-action btn-secondary">Player Stats</a>`}
            </div>
        </div>
    `;
}

// ============================================================================
// INITIALIZATION
// ============================================================================

// Load events on page load
loadEvents();