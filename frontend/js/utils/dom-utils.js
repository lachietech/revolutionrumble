/**
 * @fileoverview DOM manipulation and UI utility functions
 * @module utils/dom-utils
 */

/**
 * Shows a success notification to the user
 * @param {string} message - The message to display
 * @param {number} [duration=3000] - How long to show the message (ms)
 */
function showSuccess(message, duration = 3000) {
    const notification = createNotification(message, 'success');
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), duration);
}

/**
 * Shows an error notification to the user
 * @param {string} message - The error message to display
 * @param {number} [duration=5000] - How long to show the message (ms)
 */
function showError(message, duration = 5000) {
    const notification = createNotification(message, 'error');
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), duration);
}

/**
 * Creates a notification element
 * @param {string} message - The message to display
 * @param {string} type - The notification type ('success' or 'error')
 * @returns {HTMLElement} The notification element
 */
function createNotification(message, type) {
    const notification = document.createElement('div');
    const bgColor = type === 'success' ? 'var(--success)' : 'var(--error)';
    
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${bgColor};
        color: white;
        padding: 16px 24px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 10000;
        animation: slideIn 0.3s ease;
        max-width: 400px;
    `;
    
    notification.textContent = message;
    return notification;
}

/**
 * Creates a loading spinner element
 * @param {string} [message='Loading...'] - Loading message
 * @returns {HTMLElement} The spinner element
 */
function createSpinner(message = 'Loading...') {
    const spinner = document.createElement('div');
    spinner.style.cssText = 'text-align:center;padding:48px;color:#888';
    spinner.innerHTML = `<p>${message}</p>`;
    return spinner;
}

/**
 * Creates an empty state message element
 * @param {string} message - The message to display
 * @returns {HTMLElement} The empty state element
 */
function createEmptyState(message) {
    const emptyState = document.createElement('div');
    emptyState.style.cssText = 'text-align:center;padding:48px;color:#888';
    emptyState.innerHTML = `<p>${message}</p>`;
    return emptyState;
}

/**
 * Safely sets innerHTML while preventing XSS
 * @param {HTMLElement} element - The element to update
 * @param {string} html - The HTML content
 */
function setSafeHTML(element, html) {
    // Basic XSS prevention - escape script tags
    const safeHtml = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    element.innerHTML = safeHtml;
}

/**
 * Escapes HTML special characters
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHTML(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Confirms an action with the user
 * @param {string} message - The confirmation message
 * @returns {boolean} True if confirmed
 */
function confirmAction(message) {
    return window.confirm(message);
}

/**
 * Gets a form's data as an object
 * @param {HTMLFormElement} form - The form element
 * @returns {Object} Form data as key-value pairs
 */
function getFormData(form) {
    const formData = new FormData(form);
    const data = {};
    for (const [key, value] of formData.entries()) {
        data[key] = value;
    }
    return data;
}

/**
 * Clears all form inputs
 * @param {HTMLFormElement} form - The form to clear
 */
function clearForm(form) {
    form.reset();
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        showSuccess,
        showError,
        createNotification,
        createSpinner,
        createEmptyState,
        setSafeHTML,
        escapeHTML,
        confirmAction,
        getFormData,
        clearForm
    };
}
