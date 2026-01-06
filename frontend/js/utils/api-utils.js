/**
 * @fileoverview API utility functions for making HTTP requests
 * @module utils/api-utils
 */

/**
 * Configuration for API requests
 * @typedef {Object} RequestConfig
 * @property {string} method - HTTP method (GET, POST, PUT, DELETE)
 * @property {Object} [body] - Request body (will be JSON stringified)
 * @property {Object} [headers] - Additional headers
 */

/**
 * Makes an HTTP request to the API
 * @param {string} url - The API endpoint URL
 * @param {RequestConfig} [config={}] - Request configuration
 * @returns {Promise<Object>} Response data
 * @throws {Error} If the request fails
 */
async function apiRequest(url, config = {}) {
    const { method = 'GET', body, headers = {} } = config;
    
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json',
            ...headers
        }
    };
    
    if (body) {
        options.body = JSON.stringify(body);
    }
    
    const response = await fetch(url, options);
    
    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
    }
    
    return response.json();
}

/**
 * GET request to the API
 * @param {string} url - The API endpoint URL
 * @returns {Promise<Object>} Response data
 */
async function apiGet(url) {
    return apiRequest(url, { method: 'GET' });
}

/**
 * POST request to the API
 * @param {string} url - The API endpoint URL
 * @param {Object} data - Data to send in request body
 * @returns {Promise<Object>} Response data
 */
async function apiPost(url, data) {
    return apiRequest(url, { method: 'POST', body: data });
}

/**
 * PUT request to the API
 * @param {string} url - The API endpoint URL
 * @param {Object} data - Data to send in request body
 * @returns {Promise<Object>} Response data
 */
async function apiPut(url, data) {
    return apiRequest(url, { method: 'PUT', body: data });
}

/**
 * DELETE request to the API
 * @param {string} url - The API endpoint URL
 * @returns {Promise<Object>} Response data
 */
async function apiDelete(url) {
    return apiRequest(url, { method: 'DELETE' });
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { apiRequest, apiGet, apiPost, apiPut, apiDelete };
}
