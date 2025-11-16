// ===== Countdown =====
const eventDate = new Date('2026-04-10T08:00:00'); // local time kickoff
const m = document.getElementById('m');
const d = document.getElementById('d');
const h = document.getElementById('h');

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

tick();
setInterval(tick, 1000);

// Year in footer (optional - ensure element exists)
const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();