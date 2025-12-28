// ===== Countdown =====
let eventDate = new Date('2026-04-10T08:00:00'); // fallback date
let eventName = 'Logan City Cup'; // fallback name

const m = document.getElementById('m');
const d = document.getElementById('d');
const h = document.getElementById('h');
const eventNameEl = document.querySelector('.eyebrow');

// Fetch nearest upcoming tournament from database
async function loadNextTournament() {
    try {
        const response = await fetch('/api/tournaments');
        const tournaments = await response.json();
        
        // Filter upcoming tournaments and find the nearest one
        const now = new Date();
        const upcoming = tournaments
            .filter(t => new Date(t.date) > now && t.status === 'upcoming')
            .sort((a, b) => new Date(a.date) - new Date(b.date));
        
        if (upcoming.length > 0) {
            const nextTournament = upcoming[0];
            eventDate = new Date(nextTournament.date);
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

// Initialize
loadNextTournament().then(() => {
    tick();
    setInterval(tick, 1000);
});

// Year in footer (optional - ensure element exists)
const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();