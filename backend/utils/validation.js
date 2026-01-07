/**
 * @fileoverview Input Validation and Sanitization Utilities
 * @module utils/validation
 */

import mongoose from 'mongoose';

/**
 * Validate and sanitize MongoDB ObjectId
 * Prevents NoSQL injection through invalid ObjectIds
 * @param {string} id - ID to validate
 * @returns {string|null} - Valid ObjectId or null
 */
export function validateObjectId(id) {
    if (!id || typeof id !== 'string') {
        return null;
    }
    
    // Remove any non-alphanumeric characters except for valid ObjectId chars
    const sanitized = id.trim();
    
    // Check if valid ObjectId format
    if (!mongoose.Types.ObjectId.isValid(sanitized)) {
        return null;
    }
    
    return sanitized;
}

/**
 * Sanitize string input to prevent injection
 * @param {string} input - String to sanitize
 * @param {number} maxLength - Maximum allowed length (default 1000)
 * @returns {string} - Sanitized string
 */
export function sanitizeString(input, maxLength = 1000) {
    if (!input || typeof input !== 'string') {
        return '';
    }
    
    // Trim and limit length
    let sanitized = input.trim().substring(0, maxLength);
    
    // Remove any MongoDB operators
    sanitized = sanitized.replace(/\$/g, '');
    
    return sanitized;
}

/**
 * Sanitize email input
 * @param {string} email - Email to sanitize
 * @returns {string|null} - Sanitized email or null if invalid
 */
export function sanitizeEmail(email) {
    if (!email || typeof email !== 'string') {
        return null;
    }
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const sanitized = email.toLowerCase().trim();
    
    if (!emailRegex.test(sanitized) || sanitized.length > 254) {
        return null;
    }
    
    // Remove any MongoDB operators
    return sanitized.replace(/\$/g, '');
}

/**
 * Sanitize query object to prevent NoSQL injection
 * Removes any MongoDB operators from keys
 * @param {Object} query - Query object to sanitize
 * @returns {Object} - Sanitized query object
 */
export function sanitizeQueryObject(query) {
    if (!query || typeof query !== 'object') {
        return {};
    }
    
    const sanitized = {};
    
    for (const [key, value] of Object.entries(query)) {
        // Skip keys that start with $ (MongoDB operators)
        if (key.startsWith('$')) {
            continue;
        }
        
        // Sanitize the key
        const cleanKey = key.replace(/\$/g, '');
        
        // Recursively sanitize nested objects
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            sanitized[cleanKey] = sanitizeQueryObject(value);
        } else if (typeof value === 'string') {
            sanitized[cleanKey] = sanitizeString(value);
        } else {
            sanitized[cleanKey] = value;
        }
    }
    
    return sanitized;
}

/**
 * Validate gender field
 * @param {string} gender - Gender value to validate
 * @returns {string|null} - Valid gender or null
 */
export function validateGender(gender) {
    const validGenders = ['Male', 'Female', 'Non-binary', 'Other'];
    
    if (!gender || typeof gender !== 'string') {
        return null;
    }
    
    const sanitized = gender.trim();
    
    if (!validGenders.includes(sanitized)) {
        return null;
    }
    
    return sanitized;
}

/**
 * Validate and sanitize integer
 * @param {*} value - Value to validate
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number|null} - Valid integer or null
 */
export function validateInteger(value, min = 0, max = 999999) {
    const num = parseInt(value, 10);
    
    if (isNaN(num) || num < min || num > max) {
        return null;
    }
    
    return num;
}

/**
 * Validate and sanitize phone number
 * @param {string} phone - Phone number to validate
 * @returns {string|null} - Sanitized phone or null
 */
export function sanitizePhone(phone) {
    if (!phone || typeof phone !== 'string') {
        return null;
    }
    
    // Remove all non-numeric characters except + at start
    let sanitized = phone.trim();
    const hasPlus = sanitized.startsWith('+');
    sanitized = sanitized.replace(/[^\d]/g, '');
    
    if (hasPlus) {
        sanitized = '+' + sanitized;
    }
    
    // Validate length (between 7 and 15 digits is reasonable)
    if (sanitized.replace(/\D/g, '').length < 7 || sanitized.replace(/\D/g, '').length > 15) {
        return null;
    }
    
    return sanitized;
}

/**
 * Validate array of ObjectIds
 * @param {Array} ids - Array of IDs to validate
 * @returns {Array} - Array of valid ObjectIds
 */
export function validateObjectIdArray(ids) {
    if (!Array.isArray(ids)) {
        return [];
    }
    
    return ids
        .map(id => validateObjectId(id))
        .filter(id => id !== null);
}
