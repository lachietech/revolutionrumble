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
    
    const sanitized = email.toLowerCase().trim();
    
    // Length check first (RFC 5321)
    if (sanitized.length > 254 || sanitized.length < 3) {
        return null;
    }
    
    // Simple validation: must contain @ with content on both sides and at least one dot after @
    // Using indexOf to avoid ReDoS vulnerability from complex regex
    const atIndex = sanitized.indexOf('@');
    if (atIndex <= 0 || atIndex === sanitized.length - 1) {
        return null; // @ must exist and not be at start or end
    }
    
    const localPart = sanitized.substring(0, atIndex);
    const domainPart = sanitized.substring(atIndex + 1);
    
    // Local part: must not be empty, no spaces
    if (!localPart || localPart.includes(' ') || localPart.includes('\t') || localPart.includes('\n')) {
        return null;
    }
    
    // Domain part: must have at least one dot and not start/end with dot, no spaces
    const lastDotIndex = domainPart.lastIndexOf('.');
    if (lastDotIndex <= 0 || lastDotIndex === domainPart.length - 1 || 
        domainPart.includes(' ') || domainPart.includes('\t') || domainPart.includes('\n')) {
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
