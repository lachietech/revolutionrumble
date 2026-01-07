/**
 * @fileoverview Admin Login with OTP Authentication
 * @module admin-login
 */

// ============================================================
// STATE MANAGEMENT
// ============================================================

/** @type {number} Selected admin email index */
let selectedEmailIndex = null;

/** @type {Array<{id: number, masked: string, label: string}>} Available admin email options */
let emailOptions = [];

// ============================================================
// DOM ELEMENTS
// ============================================================

const emailStep = document.getElementById('email-step');
const otpStep = document.getElementById('otp-step');
const loading = document.getElementById('loading');
const message = document.getElementById('message');
const emailButtons = document.getElementById('email-buttons');
const otpInput = document.getElementById('otp');
const verifyOtpBtn = document.getElementById('verify-otp-btn');
const backBtn = document.getElementById('back-btn');

// ============================================================
// MESSAGE DISPLAY
// ============================================================

/**
 * Display success message to user
 * @param {string} msg - Success message text
 */
function showSuccess(msg) {
    message.textContent = msg;
    message.className = 'success';
    message.style.display = 'block';
}

/**
 * Display error message to user
 * @param {string} msg - Error message text
 */
function showError(msg) {
    message.textContent = msg;
    message.className = 'error';
    message.style.display = 'block';
}

/**
 * Hide message display
 */
function hideMessage() {
    message.style.display = 'none';
}

// ============================================================
// INITIALIZATION
// ============================================================

/**
 * Load available admin email options from server
 * @async
 */
async function loadEmailOptions() {
    try {
        loading.style.display = 'block';
        emailStep.style.display = 'none';
        
        const response = await fetch('/admin/email-options');
        const options = await response.json();
        
        emailOptions = options;
        renderEmailButtons();
        
        loading.style.display = 'none';
        emailStep.style.display = 'block';
    } catch (error) {
        loading.style.display = 'none';
        showError('Failed to load admin options. Please refresh the page.');
    }
}

/**
 * Render email selection buttons
 */
function renderEmailButtons() {
    emailButtons.innerHTML = emailOptions.map(option => `
        <button class="email-option-btn" data-index="${option.id}">
            ${option.label}
        </button>
    `).join('');
    
    // Add click handlers
    document.querySelectorAll('.email-option-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const index = parseInt(btn.dataset.index);
            requestOTP(index);
        });
    });
}

// ============================================================
// OTP REQUEST FLOW
// ============================================================

/**
 * Request OTP code for selected admin email
 * Sends verification code to the selected admin email
 * @async
 * @param {number} emailIndex - Index of selected email
 */
async function requestOTP(emailIndex) {
    selectedEmailIndex = emailIndex;
    hideMessage();
    emailStep.style.display = 'none';
    loading.style.display = 'block';

    try {
        const response = await fetch('/admin/request-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ emailIndex })
        });

        const data = await response.json();

        if (response.ok) {
            loading.style.display = 'none';
            otpStep.style.display = 'block';
            showSuccess('Verification code sent! Check your email.');
            otpInput.focus();
        } else {
            throw new Error(data.error || 'Failed to send code');
        }
    } catch (error) {
        loading.style.display = 'none';
        emailStep.style.display = 'block';
        showError(error.message);
    }
}

/**
 * Verify OTP code and authenticate admin
 * @async
 */
async function verifyOTP() {
    const otp = otpInput.value.trim();
    
    if (!otp || otp.length !== 6) {
        showError('Please enter the 6-digit code');
        return;
    }

    hideMessage();
    otpStep.style.display = 'none';
    loading.style.display = 'block';

    try {
        const response = await fetch('/admin/verify-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ emailIndex: selectedEmailIndex, otp })
        });

        const data = await response.json();

        if (response.ok) {
            showSuccess('Login successful! Redirecting...');
            setTimeout(() => {
                window.location.href = data.redirect || '/admin/tournaments';
            }, 1000);
        } else {
            throw new Error(data.error || 'Invalid code');
        }
    } catch (error) {
        loading.style.display = 'none';
        otpStep.style.display = 'block';
        showError(error.message);
        otpInput.value = '';
        otpInput.focus();
    }
}

/**
 * Go back to email selection step
 */
function goBack() {
    otpStep.style.display = 'none';
    emailStep.style.display = 'block';
    hideMessage();
    otpInput.value = '';
    selectedEmailIndex = null;
}

// ============================================================
// EVENT LISTENERS
// ============================================================

verifyOtpBtn.addEventListener('click', verifyOTP);
backBtn.addEventListener('click', goBack);

// Allow Enter key to submit OTP
otpInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') verifyOTP();
});

// ============================================================
// INITIALIZATION
// ============================================================

// Load email options on page load
loadEmailOptions();
