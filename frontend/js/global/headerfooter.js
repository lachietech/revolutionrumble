/**
 * @fileoverview Custom HTML elements for site header and footer.
 * Defines reusable Web Components for consistent navigation and footer across all pages.
 * @module global/headerfooter
 */

// ============================================================================
// HEADER COMPONENT
// ============================================================================

/**
 * Custom HTML element for the site header with responsive navigation.
 * Includes branding, desktop navigation menu, mobile hamburger menu, and mobile dropdown.
 * 
 * @class SpecialHeader
 * @extends {HTMLElement}
 * 
 * @example
 * <special-header></special-header>
 */
class SpecialHeader extends HTMLElement {
    /**
     * Called when the element is inserted into the DOM.
     * Renders the header HTML structure with navigation menus.
     */
    connectedCallback() {
        this.innerHTML = `
        <header>
            <div class="container nav">
                <div class="brand">
                    <h1>Revolution Rumble Tenpin Tour</h1>
                </div>

                <!-- Keep this for progressive enhancement (hidden via CSS) -->
                <nav id="desktopMenu" class="nav-links desktop-nav" hidden>
                    <a href="/">Home</a>
                    <a href="/events">Events</a>
                    <a href="/results">Results</a>
                    <a href="/bowlerstats">Player Stats</a>
                    <a href="/register">Register</a>
                    <a href="/bowler-hub">My Hub</a>
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
                    <a href="/events">Events</a>
                    <a href="/results">Results</a>
                    <a href="/bowlerstats">Player Stats</a>
                    <a href="/register">Register</a>
                    <a href="/bowler-hub">My Hub</a>
                </nav>
            </div>
        </header>
        `;
    }
}

// ============================================================================
// FOOTER COMPONENT
// ============================================================================

/**
 * Custom HTML element for the site footer.
 * Displays copyright information and credits.
 * 
 * @class SpecialFooter
 * @extends {HTMLElement}
 * 
 * @example
 * <special-footer></special-footer>
 */
class SpecialFooter extends HTMLElement {
    /**
     * Called when the element is inserted into the DOM.
     * Renders the footer HTML structure with copyright notice.
     */
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

// ============================================================================
// CUSTOM ELEMENT REGISTRATION
// ============================================================================

/**
 * Register the SpecialHeader custom element.
 * Makes <special-header> available throughout the application.
 */
customElements.define('special-header', SpecialHeader);

/**
 * Register the SpecialFooter custom element.
 * Makes <special-footer> available throughout the application.
 */
customElements.define('special-footer', SpecialFooter);