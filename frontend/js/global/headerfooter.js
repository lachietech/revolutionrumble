const RUMBLE_ICON_PATHS = {
    calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    location: '<path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
    players: '<path d="M16 20v-1.5a4.5 4.5 0 0 0-4.5-4.5h-3A4.5 4.5 0 0 0 4 18.5V20M10 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM17 7a3 3 0 0 1 0 6M19 14.5c1.2.7 2 2 2 3.5v2"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    ticket: '<path d="M4 5h16v4a3 3 0 0 0 0 6v4H4v-4a3 3 0 0 0 0-6V5Z"/><path d="M12 7v2M12 11v2M12 15v2"/>',
    bowling: '<circle cx="12" cy="13" r="8"/><circle cx="10" cy="8.5" r=".7" fill="currentColor" stroke="none"/><circle cx="13" cy="7.5" r=".7" fill="currentColor" stroke="none"/><circle cx="14" cy="10" r=".7" fill="currentColor" stroke="none"/>',
    arrow: '<path d="M5 12h14M14 7l5 5-5 5"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    alert: '<path d="M12 3 2.8 20h18.4L12 3Z"/><path d="M12 9v4M12 17h.01"/>'
};

window.rrIcon = (name, className = '') => {
    const paths = RUMBLE_ICON_PATHS[name] || RUMBLE_ICON_PATHS.target;
    return `<svg class="ui-icon ${className}" viewBox="0 0 24 24" aria-hidden="true">${paths}</svg>`;
};

class SpecialFooter extends HTMLElement {
    connectedCallback() {
        this.innerHTML = `
            <footer class="site-footer">
                <div class="container footer-inner">
                    <div><span class="footer-brand">Revolution Rumble</span><br />Built for bowlers who chase the next frame.</div>
                    <nav class="footer-links" aria-label="Footer navigation">
                        <a href="/events">Events</a><a href="/results">Results</a><a href="/register">Register</a><a href="/bowler-hub">Bowler Hub</a>
                    </nav>
                    <span>&copy; 2026 Revolution Bowling Supplies</span>
                </div>
            </footer>`;
    }
}

customElements.define('special-footer', SpecialFooter);
