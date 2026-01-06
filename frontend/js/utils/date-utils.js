/**
 * @fileoverview Date formatting and manipulation utilities
 * @module utils/date-utils
 */

/**
 * Formats a date object or string into a localized date string
 * @param {Date|string} date - The date to format
 * @param {Object} [options] - Intl.DateTimeFormat options
 * @returns {string} Formatted date string
 */
function formatDate(date, options = {}) {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const defaultOptions = {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        ...options
    };
    return dateObj.toLocaleDateString('en-US', defaultOptions);
}

/**
 * Formats a date into a short format (MM/DD/YYYY)
 * @param {Date|string} date - The date to format
 * @returns {string} Formatted date string
 */
function formatDateShort(date) {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString('en-US');
}

/**
 * Formats a date for input fields (YYYY-MM-DD)
 * @param {Date|string} date - The date to format
 * @returns {string} Formatted date string
 */
function formatDateForInput(date) {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toISOString().split('T')[0];
}

/**
 * Calculates the time remaining until a target date
 * @param {Date|string} targetDate - The target date
 * @returns {Object} Time remaining object with days, hours, minutes, seconds
 */
function getTimeRemaining(targetDate) {
    const target = typeof targetDate === 'string' ? new Date(targetDate) : targetDate;
    const now = new Date();
    const difference = target - now;
    
    if (difference <= 0) {
        return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
    }
    
    return {
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((difference / 1000 / 60) % 60),
        seconds: Math.floor((difference / 1000) % 60),
        expired: false
    };
}

/**
 * Checks if a date is in the past
 * @param {Date|string} date - The date to check
 * @returns {boolean} True if the date is in the past
 */
function isPastDate(date) {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj < new Date();
}

/**
 * Checks if a date is today
 * @param {Date|string} date - The date to check
 * @returns {boolean} True if the date is today
 */
function isToday(date) {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const today = new Date();
    return dateObj.toDateString() === today.toDateString();
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        formatDate,
        formatDateShort,
        formatDateForInput,
        getTimeRemaining,
        isPastDate,
        isToday
    };
}
