/**
 * @fileoverview Hero section video/image swap functionality for the landing page.
 * Manages the introductory video playback and transitions to static image on completion or error.
 * @module index/hero
 */

// ============================================================================
// CONSTANTS & DOM REFERENCES
// ============================================================================

/** @type {HTMLElement} Container element for the hero swap functionality */
const container = document.getElementById('heroSwap');

/** @type {HTMLVideoElement} Video element for the intro video */
const video = document.getElementById('introVideo');

/** @type {HTMLButtonElement} Button element to skip the video */
const skipBtn = container.querySelector('.skip-btn');

// ============================================================================
// VIDEO LIFECYCLE HANDLERS
// ============================================================================

/**
 * Handles video ended event.
 * Transitions from video to static image and cleans up video resources.
 * @listens HTMLVideoElement#ended
 */
const handleVideoEnded = () => {
    container.classList.add('show-image');
    // Ensure video is fully stopped (saves battery/CPU)
    try {
        video.pause();
        video.currentTime = video.duration || 0;
        video.removeAttribute('src'); // frees up memory (optional)
        video.load();
    } catch (_e) {
        /* swallow */
    }
};

/**
 * Handles video play event.
 * No-op function to ensure autoplay is working as expected.
 * @listens HTMLVideoElement#play
 */
const handleVideoPlay = () => {
    // no-op, but ensures we know autoplay worked
};

/**
 * Handles video error event.
 * Falls back to showing the static image if video fails to load or play.
 * @listens HTMLVideoElement#error
 */
const handleVideoError = () => {
    // If video fails, just show image
    container.classList.add('show-image');
};

// ============================================================================
// USER INTERACTION HANDLERS
// ============================================================================

/**
 * Handles skip button click event.
 * Immediately triggers the video ended event to skip to the static image.
 * @listens HTMLButtonElement#click
 */
const handleSkipClick = () => {
    video.dispatchEvent(new Event('ended'));
};

// ============================================================================
// EVENT LISTENER SETUP
// ============================================================================

/**
 * Initialize hero video functionality.
 * Sets up all event listeners for video lifecycle and user interactions.
 */
(function initHeroVideo() {
    video.addEventListener('ended', handleVideoEnded, { passive: true });
    video.addEventListener('play', handleVideoPlay);
    video.addEventListener('error', handleVideoError);
    skipBtn.addEventListener('click', handleSkipClick);
})();