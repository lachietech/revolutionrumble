/**
 * @fileoverview Responsive navigation menu controller with mobile hamburger menu and desktop navigation.
 * Handles menu toggling, keyboard navigation, and viewport-based menu switching.
 * @module global/navbar
 */

// ============================================================================
// CONSTANTS & DOM REFERENCES
// ============================================================================

/** @type {HTMLButtonElement} Hamburger menu toggle button */
const btn = document.querySelector('.hamburger');

/** @type {HTMLElement} Mobile menu navigation element */
const menu = document.getElementById('mobileMenu');

/** @type {HTMLElement|null} Desktop menu navigation element */
const desktop = document.getElementById('desktopMenu');

/** @constant {number} Breakpoint width for switching between mobile and desktop views */
const DESKTOP_BREAKPOINT = 900;

// ============================================================================
// VIEWPORT & STATE UTILITIES
// ============================================================================

/**
 * Checks if the current viewport is desktop size.
 * @returns {boolean} True if viewport width is at or above the desktop breakpoint
 */
const isDesktopView = () => window.innerWidth >= DESKTOP_BREAKPOINT;

/**
 * Determines the current open/closed state of the active menu.
 * @returns {boolean} True if the appropriate menu (desktop or mobile) is currently open
 */
const currentOpenState = () => {
    return isDesktopView() ? (desktop && !desktop.hidden) : !menu.hidden;
};

// ============================================================================
// UI STATE MANAGEMENT
// ============================================================================

/**
 * Updates the hamburger button's visual and ARIA state.
 * @param {boolean} open - Whether the menu is open
 */
const setButtonState = (open) => {
    btn.classList.toggle('is-open', open);
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
};

/**
 * Toggles menu visibility based on viewport size and desired state.
 * Handles switching between mobile and desktop menus appropriately.
 * @param {boolean} [open] - Desired open state. If undefined, toggles current state
 */
const toggle = (open) => {
    const wantOpen = open !== undefined ? Boolean(open) : !currentOpenState();
    if (isDesktopView()) {
        if (desktop) desktop.hidden = !wantOpen;
        menu.hidden = true;
    } else {
        menu.hidden = !wantOpen;
        if (desktop) desktop.hidden = true;
    }
    setButtonState(wantOpen);
};

// ============================================================================
// EVENT HANDLERS
// ============================================================================

/**
 * Handles hamburger button click event.
 * Stops event propagation to prevent document click handler from immediately closing menu.
 * @param {MouseEvent} e - Click event
 * @listens HTMLButtonElement#click
 */
const handleHamburgerClick = (e) => {
    e.stopPropagation();
    toggle();
};

/**
 * Handles keyboard events for menu control.
 * Closes menu when Escape key is pressed.
 * @param {KeyboardEvent} e - Keyboard event
 * @listens Document#keydown
 */
const handleKeydown = (e) => {
    if (e.key === 'Escape') toggle(false);
};

/**
 * Handles document click events for closing menu when clicking outside.
 * Checks if click is outside both the menu and hamburger button.
 * @param {MouseEvent} e - Click event
 * @listens Document#click
 */
const handleDocumentClick = (e) => {
    if (isDesktopView()) {
        if (desktop && !desktop.hidden && !desktop.contains(e.target) && !btn.contains(e.target)) {
            toggle(false);
        }
    } else {
        if (!menu.hidden && !menu.contains(e.target) && !btn.contains(e.target)) {
            toggle(false);
        }
    }
};

/**
 * Handles window resize events.
 * Ensures correct menu is shown for current viewport and syncs button state.
 * @listens Window#resize
 */
const handleResize = () => {
    if (isDesktopView()) {
        // moving to desktop view
        if (!menu.hidden) menu.hidden = true;
    } else {
        if (desktop && !desktop.hidden) desktop.hidden = true;
    }
    // sync button state
    setButtonState(currentOpenState());
};

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize the navigation menu system.
 * Sets up initial state, event listeners, and menu link handlers.
 */
(function initNavigation() {
    // Early exit if required elements not found
    if (!btn || !menu) return;

    // Ensure menu starts hidden and aria state is correct
    menu.hidden = true;
    if (desktop) desktop.hidden = true;
    btn.classList.remove('is-open');
    btn.setAttribute('aria-expanded', 'false');

    // Hamburger button click
    btn.addEventListener('click', handleHamburgerClick);

    // Close on link click (both menus)
    menu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => toggle(false)));
    if (desktop) {
        desktop.querySelectorAll('a').forEach(a => a.addEventListener('click', () => toggle(false)));
    }

    // Close on ESC
    document.addEventListener('keydown', handleKeydown);

    // Click outside closes the open menu and syncs the button
    document.addEventListener('click', handleDocumentClick);

    // Ensure menus adapt on resize (hide whichever is not appropriate)
    window.addEventListener('resize', handleResize);
})();