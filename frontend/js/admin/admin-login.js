let selectedEmailIndex = null;
let csrfToken = null;

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

function stateMessage(type, msg) {
    message.textContent = msg;
    message.className = type;
    message.style.display = 'block';
}

function hideMessage() {
    message.style.display = 'none';
}

// ============================================================
// INITIALIZATION
// ============================================================


// Load available admin email options from server
async function loadEmailOptions() {
    try {
        loading.style.display = 'block';
        emailStep.style.display = 'none';
        
        const response = await fetch('/admin/email-options', {
            credentials: 'same-origin'
        });
        const data = await response.json();
        
        // Extract CSRF token and options from response
        csrfToken = data.csrfToken;
        emailOptions = data.options;
        
        console.log('CSRF token fetched:', csrfToken ? 'YES' : 'NO', csrfToken?.substring(0, 10));
        
        renderEmailButtons();
        
        loading.style.display = 'none';
        emailStep.style.display = 'block';
    } catch (error) {
        loading.style.display = 'none';
        stateMessage('error', 'Failed to load admin options. Please refresh the page.');
    }
}

// Render email selection buttons

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
            headers: { 
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken
            },
            credentials: 'same-origin',
            body: JSON.stringify({ emailIndex })
        });

        if (!response.ok) {
            const text = await response.text();
            console.error('Request failed:', response.status, text);
            throw new Error(`Server error: ${response.status}`);
        }

        const data = await response.json();

        if (response.ok) {
            loading.style.display = 'none';
            otpStep.style.display = 'block';
            stateMessage('success', 'Verification code sent! Check your email.');
            otpInput.focus();
        } else {
            throw new Error(data.error || 'Failed to send code');
        }
    } catch (error) {
        loading.style.display = 'none';
        emailStep.style.display = 'block';
        stateMessage('error', error.message);
    }
}

// Verify OTP code and authenticate admin
async function verifyOTP() {
    const otp = otpInput.value.trim();
    
    if (!otp || otp.length !== 6) {
        stateMessage('error', 'Please enter the 6-digit code');
        return;
    }

    hideMessage();
    otpStep.style.display = 'none';
    loading.style.display = 'block';

    try {
        const response = await fetch('/admin/verify-otp', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken
            },
            credentials: 'same-origin',
            body: JSON.stringify({ emailIndex: selectedEmailIndex, otp })
        });

        if (!response.ok) {
            const text = await response.text();
            console.error('Request failed:', response.status, text);
            throw new Error(`Server error: ${response.status}`);
        }

        const data = await response.json();

        if (response.ok) {
            stateMessage('success', 'Login successful! Redirecting...');
            setTimeout(() => {
                window.location.href = data.redirect || '/admin/tournaments';
            }, 1000);
        } else {
            throw new Error(data.error || 'Invalid code');
        }
    } catch (error) {
        loading.style.display = 'none';
        otpStep.style.display = 'block';
        stateMessage('error', error.message);
        otpInput.value = '';
        otpInput.focus();
    }
}
// Go back to email selection step
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
