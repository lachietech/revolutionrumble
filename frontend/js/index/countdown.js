/**
 * @fileoverview Countdown timer for the next upcoming tournament
 * Displays days, hours, and minutes until the next event
 * @module index/countdown
 */

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

/** @type {Date} Target date for countdown (defaults to fallback) */
let eventDate = new Date('2026-04-10T08:00:00');

/** @type {string} Name of the upcoming event */
let eventName = 'Logan City Cup';

// ============================================================================
// DOM ELEMENTS
// ============================================================================

/** @type {HTMLElement} Months display element */
const m = document.getElementById('m');

/** @type {HTMLElement} Days display element */
const d = document.getElementById('d');

/** @type {HTMLElement} Hours display element */
const h = document.getElementById('h');

/** @type {HTMLElement} Event name display element */
const eventNameEl = document.querySelector('.eyebrow');

// ============================================================================
// DATA LOADING
// ============================================================================

/**
 * Loads the nearest upcoming tournament from the database
 * Updates eventDate and eventName with the next tournament data
 * Falls back to default values if no tournaments are found
 * @async
 * @returns {Promise<void>}
 */
async function loadNextTournament() {
    try {
        const response = await fetch('/api/tournaments');
        const tournaments = await response.json();
        
        // Filter upcoming tournaments and find the nearest one
        const now = new Date();
        const upcoming = tournaments
            .filter(t => new Date(t.startDate || t.date) > now && t.status === 'upcoming')
            .sort((a, b) => new Date(a.startDate || a.date) - new Date(b.startDate || b.date));
        
        if (upcoming.length > 0) {
            const nextTournament = upcoming[0];
            eventDate = new Date(nextTournament.startDate || nextTournament.date);
            eventName = nextTournament.name;
            
            // Update tournament name in UI
            if (eventNameEl) {
                eventNameEl.textContent = eventName;
            }
        }
    } catch (error) {
        console.error('Failed to load tournament:', error);
        // Keep using fallback date and name
    }
}

// ============================================================================
// COUNTDOWN LOGIC
// ============================================================================

/**
 * Updates the countdown display with current time remaining
 * Calculates and displays months, days, and hours until eventDate
 * Shows '00' for all values when countdown reaches zero
 * @returns {void}
 */
const tick = () => {
    const now = new Date();
    const diff = eventDate - now;
    
    if (diff <= 0) {
        m.textContent = '00';
        d.textContent = '00';
        h.textContent = '00';
        return;
    }

    const mm = Math.floor(diff / (1000 * 60 * 60 * 24 * 30));
    const dd = Math.floor((diff % (1000 * 60 * 60 * 24 * 30)) / (1000 * 60 * 60 * 24));
    const hh = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    d.textContent = String(dd).padStart(2, '0');
    h.textContent = String(hh).padStart(2, '0');
    m.textContent = String(mm).padStart(2, '0');
};

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize countdown timer
 * Loads next tournament, starts countdown, and updates every second
 */
loadNextTournament().then(() => {
    tick();
    setInterval(tick, 1000);
});

// Update footer year (if element exists)
const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();
