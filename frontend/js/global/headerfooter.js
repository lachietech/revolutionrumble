class SpecialHeader extends HTMLElement {
        connectedCallback() {
        this.innerHTML = `
        <header>
            <div class="container nav">
                <div class="brand">
                    <h1>Revolution Rumble - Tenpin Tour</h1>
                </div>

                <!-- Keep this for progressive enhancement (hidden via CSS) -->
                <nav class="nav-links desktop-nav">
                    <a href="/">Home</a>
                    <a href="/results">Results</a>
                    <a href="/playerstats">Player Stats</a>
                    <a class="btn" href="/register">Register</a>
                </nav>

                <!-- Hamburger (always visible) -->
                <button class="hamburger" aria-label="Open menu" aria-expanded="false" aria-controls="mobileMenu">
                    <span></span>
                    <span></span>
                    <span></span>
                </button>

                <!-- Dropdown (moved inside .nav so it anchors to the hamburger) -->
                <nav id="mobileMenu" class="mobile-menu" hidden>
                    <a href="/">Home</a>
                    <a href="/results">Results</a>
                    <a href="/playerstats">Player Stats</a>
                    <a class="btn" href="/register">Register</a>
                </nav>
            </div>
        </header>
        `;
    }
}

customElements.define('special-header', SpecialHeader);

class SpecialFooter extends HTMLElement {
    connectedCallback() {
        this.innerHTML = `
        <footer>
            <div style="bottom: 0; text-align:center; padding:8px 0; color:var(--muted); font-size:.9rem">
                <span>©2025 Revolution Bowling Supplies & Nielsen Innovations</span>
            </div>
        </footer>
        `;
    }
}
customElements.define('special-footer', SpecialFooter);