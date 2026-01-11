/**
 * @fileoverview Bowler Hub - Personal Dashboard and Profile Management
 * Provides authentication, profile management, and tournament registration management
 * for bowlers. Includes email-based OTP authentication, profile editing, and squad management.
 * 
 * @module bowler-hub
 * @requires DOM elements defined in bowler-hub.html
 */

// ========================================
// TYPE DEFINITIONS
// ========================================

/**
 * @typedef {Object} Bowler
 * @property {string} _id - Unique bowler identifier
 * @property {string} email - Bowler's email address
 * @property {string} [playerName] - Full name
 * @property {string} [nickname] - Display nickname
 * @property {string} [hand] - Bowling hand (left/right)
 * @property {string} [homeCenter] - Home bowling center
 * @property {number} [currentAverage] - Current bowling average
 * @property {number} [highGame] - Highest game score
 * @property {number} [highSeries] - Highest series score
 * @property {number} [tournamentAverage] - Average in tournaments
 * @property {string} [bio] - Bowler biography
 * @property {string[]} [tournamentsEntered] - Array of tournament IDs
 */

/**
 * @typedef {Object} Registration
 * @property {string} _id - Registration unique identifier
 * @property {Tournament} tournament - Associated tournament
 * @property {Squad[]|string[]} assignedSquads - Assigned squads (populated or IDs)
 */

/**
 * @typedef {Object} Tournament
 * @property {string} _id - Tournament unique identifier
 * @property {string} name - Tournament name
 * @property {Date|string} startDate - Tournament start date
 * @property {Date|string} date - Alternative date field
 * @property {string} location - Tournament location
 * @property {string} status - Status (upcoming/active/completed)
 */

/**
 * @typedef {Object} Squad
 * @property {string} _id - Squad unique identifier
 * @property {string} name - Squad name
 * @property {Date|string} date - Squad date
 * @property {string} [time] - Squad time
 * @property {boolean} [isQualifying] - Whether this is a qualifying squad
 * @property {number} available - Available spots
 * @property {number} capacity - Total capacity
 */

// ========================================
// STATE MANAGEMENT
// ========================================

/**
 * CSRF token for secure requests
 * @type {string|null}
 */
let csrfToken = null;

/**
 * Current user's email address
 * @type {string}
 */
let currentEmail = '';

/**
 * Current bowler data
 * @type {Bowler|null}
 */
let currentBowler = null;

/**
 * Current bowler's ID
 * @type {string|null}
 */
let currentBowlerId = null;

// ========================================
// AUTHENTICATION
// ========================================

/**
 * Check if user has an active session on page load
 * Redirects to appropriate view based on authentication status
 * 
 * @async
 * @returns {Promise<void>}
 */
async function checkSession() {
    try {
        const response = await fetch('/api/bowlers/session');
        const data = await response.json();
        
        if (data.authenticated) {
            currentBowlerId = data.bowlerId;
            await loadBowlerHub();
        } else {
            document.getElementById('login-section').style.display = 'flex';
            document.getElementById('hub-section').style.display = 'none';
        }
    } catch (error) {
        console.error('Session check failed:', error);
        document.getElementById('login-section').style.display = 'flex';
        document.getElementById('hub-section').style.display = 'none';
    }
}

/**
 * Navigate back to email entry step from OTP verification
 * Clears OTP input and resets UI state
 * 
 * @returns {void}
 */
function backToEmail() {
    document.getElementById('otp-step').style.display = 'none';
    document.getElementById('email-step').style.display = 'block';
    document.getElementById('otp-input').value = '';
    document.getElementById('otp-message').innerHTML = '';
    currentEmail = '';
}

/**
 * Resend the OTP code to the current email address
 * 
 * @async
 * @param {Event} e - Click event
 * @returns {Promise<void>}
 */
async function resendCode(e) {
    e.preventDefault();
    const messageDiv = document.getElementById('otp-message');
    
    try {
        const response = await fetch('/api/bowlers/request-otp', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken
            },
            credentials: 'same-origin',
            body: JSON.stringify({ email: currentEmail })
        });
        
        if (response.ok) {
            messageDiv.innerHTML = `<div class="success-message">✓ New code sent!</div>`;
            setTimeout(() => messageDiv.innerHTML = '', 3000);
        } else {
            messageDiv.innerHTML = `<div class="error-message">❌ Failed to resend code</div>`;
        }
    } catch (error) {
        messageDiv.innerHTML = `<div class="error-message">❌ Network error</div>`;
    }
}

/**
 * Log out the current user
 * Clears session, resets state, and returns to login screen
 * 
 * @async
 * @returns {Promise<void>}
 */
async function logout() {
    try {
        await fetch('/api/bowlers/logout', { 
            method: 'POST',
            headers: { 'X-CSRF-Token': csrfToken },
            credentials: 'same-origin'
        });
    } catch (error) {
        console.error('Logout error:', error);
    }
    
    currentBowler = null;
    currentBowlerId = null;
    currentEmail = '';
    
    document.getElementById('hub-section').style.display = 'none';
    document.getElementById('login-section').style.display = 'flex';
    document.getElementById('email-step').style.display = 'block';
    document.getElementById('otp-step').style.display = 'none';
    document.getElementById('email-input').value = '';
    document.getElementById('otp-input').value = '';
    document.getElementById('email-message').innerHTML = '';
    document.getElementById('otp-message').innerHTML = '';
}

// ========================================
// BOWLER HUB - MAIN DASHBOARD
// ========================================

/**
 * Load and display the bowler hub dashboard
 * Fetches bowler data, displays profile and stats, and loads registrations
 * 
 * @async
 * @returns {Promise<void>}
 * @throws {Error} If bowler data cannot be loaded
 */
async function loadBowlerHub() {
    try {
        // Fetch bowler data
        const bowlerRes = await fetch(`/api/bowlers/${currentBowlerId}`);
        const bowler = await bowlerRes.json();
        currentBowler = bowler;
        
        // Hide login, show hub
        document.getElementById('login-section').style.display = 'none';
        document.getElementById('hub-section').style.display = 'block';
        
        // Update header
        document.getElementById('bowler-name').textContent = bowler.playerName || bowler.email.split('@')[0];
        
        // Display profile
        displayProfile(bowler);
        
        // Display stats
        displayStats(bowler);
        
        // Load registrations
        await loadRegistrations();
        
    } catch (error) {
        console.error('Failed to load bowler hub:', error);
        alert('Failed to load your data. Please try logging in again.');
        logout();
    }
}

// ========================================
// PROFILE MANAGEMENT
// ========================================

/**
 * Display bowler profile information in read-only mode
 * 
 * @param {Bowler} bowler - Bowler data to display
 * @returns {void}
 */
function displayProfile(bowler) {
    document.getElementById('display-email').textContent = bowler.email;
    document.getElementById('display-playerName').textContent = bowler.playerName || 'Not set';
    document.getElementById('display-nickname').textContent = bowler.nickname || 'Not set';
    document.getElementById('display-hand').textContent = bowler.hand ? bowler.hand.charAt(0).toUpperCase() + bowler.hand.slice(1) : 'Not set';
    document.getElementById('display-currentAverage').textContent = bowler.currentAverage || 'Not set';
    document.getElementById('display-highGame').textContent = bowler.highGame || 'Not set';
}

/**
 * Display bowler statistics summary
 * 
 * @param {Bowler} bowler - Bowler data to display
 * @returns {void}
 */
function displayStats(bowler) {
    document.getElementById('stat-tournamentAvg').textContent = bowler.tournamentAverage || '--';
    document.getElementById('stat-currentAvg').textContent = bowler.currentAverage || '--';
    document.getElementById('stat-highGame').textContent = bowler.highGame || '--';
    document.getElementById('stat-tournaments').textContent = bowler.tournamentsEntered?.length || 0;
}

/**
 * Toggle between profile display and edit modes
 * Populates edit form with current values when entering edit mode
 * 
 * @returns {void}
 */
function toggleEditProfile() {
    const displayDiv = document.getElementById('profile-display');
    const editDiv = document.getElementById('profile-edit');
    
    if (editDiv.style.display === 'none') {
        // Show edit form, populate with current values
        document.getElementById('edit-playerName').value = currentBowler.playerName || '';
        document.getElementById('edit-nickname').value = currentBowler.nickname || '';
        document.getElementById('edit-hand').value = currentBowler.hand || '';
        document.getElementById('edit-homeCenter').value = currentBowler.homeCenter || '';
        document.getElementById('edit-currentAverage').value = currentBowler.currentAverage || '';
        document.getElementById('edit-highGame').value = currentBowler.highGame || '';
        document.getElementById('edit-highSeries').value = currentBowler.highSeries || '';
        document.getElementById('edit-bio').value = currentBowler.bio || '';
        
        displayDiv.style.display = 'none';
        editDiv.style.display = 'block';
    } else {
        // Hide edit form
        displayDiv.style.display = 'block';
        editDiv.style.display = 'none';
        document.getElementById('profile-message').innerHTML = '';
    }
}

/**
 * Save profile changes to the server
 * Updates bowler information and refreshes the display
 * 
 * @async
 * @param {Event} e - Form submit event
 * @returns {Promise<void>}
 */
async function saveProfile(e) {
    e.preventDefault();
    
    const messageDiv = document.getElementById('profile-message');
    const submitBtn = e.target.querySelector('button[type="submit"]');
    
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';
    messageDiv.innerHTML = '';
    
    const profileData = {
        playerName: document.getElementById('edit-playerName').value,
        nickname: document.getElementById('edit-nickname').value,
        hand: document.getElementById('edit-hand').value,
        homeCenter: document.getElementById('edit-homeCenter').value,
        currentAverage: document.getElementById('edit-currentAverage').value || null,
        highGame: document.getElementById('edit-highGame').value || null,
        highSeries: document.getElementById('edit-highSeries').value || null,
        bio: document.getElementById('edit-bio').value
    };
    
    try {
        const response = await fetch(`/api/bowlers/${currentBowlerId}`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken
            },
            credentials: 'same-origin',
            body: JSON.stringify(profileData)
        });
        
        const data = await response.json();
        
        if (response.ok) {
            currentBowler = data;
            displayProfile(data);
            displayStats(data);
            messageDiv.innerHTML = `<div class="success-message">✓ Profile updated successfully!</div>`;
            setTimeout(() => toggleEditProfile(), 1500);
        } else {
            messageDiv.innerHTML = `<div class="error-message">❌ ${data.error || 'Failed to update profile'}</div>`;
        }
    } catch (error) {
        messageDiv.innerHTML = `<div class="error-message">❌ Network error. Please try again.</div>`;
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Save Changes';
    }
}

// ========================================
// REGISTRATION MANAGEMENT
// ========================================

/**
 * Load and display all tournament registrations for the current bowler
 * Shows registration cards with tournament info, squads, and action buttons
 * 
 * @async
 * @returns {Promise<void>}
 */
async function loadRegistrations() {
    try {
        const response = await fetch('/api/bowlers/my/registrations');
        const registrations = await response.json();
        
        const container = document.getElementById('registrations-list');
        
        if (registrations.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🎳</div>
                    <h3>No Registrations Yet</h3>
                    <p>You haven't registered for any tournaments yet.</p>
                    <a href="/register" class="btn btn-primary" style="display:inline-block;margin-top:20px;width:auto">
                        Register for a Tournament
                    </a>
                </div>
            `;
            return;
        }
        
        container.innerHTML = registrations.map(reg => {
            const tournament = reg.tournament;
            const date = new Date(tournament.startDate || tournament.date);
            const formattedDate = date.toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            });
            
            let statusClass = 'status-upcoming';
            let statusText = 'Upcoming';
            let canEdit = true;
            if (tournament.status === 'active') {
                statusClass = 'status-active';
                statusText = 'In Progress';
                canEdit = false;
            } else if (tournament.status === 'completed') {
                statusClass = 'status-completed';
                statusText = 'Completed';
                canEdit = false;
            }
            
            const squadsHTML = reg.assignedSquads && reg.assignedSquads.length > 0 
                ? `
                    <div class="registration-squads">
                        <h4>Squads:</h4>
                        ${reg.assignedSquads.map(squad => {
                            const squadDate = new Date(squad.date);
                            const dateStr = squadDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                            return `<span class="squad-badge">${squad.name} - ${dateStr} ${squad.time || ''}</span>`;
                        }).join('')}
                    </div>
                `
                : '';

            const actionsHTML = canEdit ? `
                <div class="registration-actions">
                    <button onclick="editRegistration('${reg._id}', '${tournament._id}')" class="btn btn-secondary">
                        Edit Squads
                    </button>
                    <button onclick="cancelRegistration('${reg._id}', '${tournament.name}')" class="btn btn-danger">
                        Cancel Registration
                    </button>
                </div>
            ` : '';
            
            return `
                <div class="registration-card" id="reg-card-${reg._id}">
                    <div class="registration-header">
                        <div>
                            <div class="registration-title">${tournament.name}</div>
                            <div class="registration-meta">
                                <span>📅 ${formattedDate}</span>
                                <span>📍 ${tournament.location}</span>
                            </div>
                        </div>
                        <span class="registration-status ${statusClass}">${statusText}</span>
                    </div>
                    ${squadsHTML}
                    <div id="edit-area-${reg._id}" style="display:none;margin-top:16px"></div>
                    ${actionsHTML}
                </div>
            `;
        }).join('');
        
    } catch (error) {
        console.error('Failed to load registrations:', error);
        document.getElementById('registrations-list').innerHTML = `
            <div class="error-message">Failed to load registrations</div>
        `;
    }
}

/**
 * Open the squad editor for a specific registration
 * Fetches tournament and squad availability data, displays checkboxes for squad selection
 * 
 * @async
 * @param {string} regId - Registration ID
 * @param {string} tournamentId - Tournament ID
 * @returns {Promise<void>}
 */
async function editRegistration(regId, tournamentId) {
    const editArea = document.getElementById(`edit-area-${regId}`);
    
    // If already showing, hide it
    if (editArea.style.display === 'block') {
        editArea.style.display = 'none';
        return;
    }
    
    editArea.innerHTML = '<div style="padding:12px;color:var(--muted)">Loading squad editor...</div>';
    editArea.style.display = 'block';
    
    try {
        // Fetch tournament and squad availability
        const tournamentRes = await fetch(`/api/tournaments/${tournamentId}`);
        if (!tournamentRes.ok) {
            throw new Error('Failed to fetch tournament');
        }
        const tournament = await tournamentRes.json();
        
        const availRes = await fetch(`/api/tournaments/${tournamentId}/squads/availability`);
        if (!availRes.ok) {
            throw new Error('Failed to fetch squad availability');
        }
        const availData = await availRes.json();
        
        // Get current registration
        const regRes = await fetch('/api/bowlers/my/registrations');
        if (!regRes.ok) {
            throw new Error('Failed to fetch registrations');
        }
        const registrations = await regRes.json();
        const currentReg = registrations.find(r => r._id === regId);
        
        if (!currentReg) {
            throw new Error('Registration not found');
        }
        
        // Handle case where assignedSquads might not be populated
        const currentSquadIds = currentReg.assignedSquads 
            ? (Array.isArray(currentReg.assignedSquads) 
                ? currentReg.assignedSquads.map(s => typeof s === 'string' ? s : s._id.toString())
                : [])
            : [];
        
        // Build squad selection UI
        const squadOptions = availData.squads.map(squad => {
            const isSelected = currentSquadIds.includes(squad._id);
            const isDisabled = squad.available <= 0 && !isSelected;
            const disabledAttr = isDisabled ? 'disabled' : '';
            const checkedAttr = isSelected ? 'checked' : '';
            
            const squadDate = new Date(squad.date);
            const dateStr = squadDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            
            return `
                <div class="squad-option" style="display:flex;align-items:center;padding:12px;background:rgba(255,255,255,0.05);border-radius:6px;margin-bottom:8px;${isDisabled ? 'opacity:0.5' : ''}">
                    <label style="display:flex;align-items:center;gap:12px;flex:1;cursor:${isDisabled ? 'not-allowed' : 'pointer'}">
                        <input 
                            type="checkbox" 
                            name="edit-squads-${regId}" 
                            value="${squad._id}"
                            ${checkedAttr}
                            ${disabledAttr}
                            style="width:18px;height:18px;cursor:${isDisabled ? 'not-allowed' : 'pointer'}"
                        />
                        <div style="flex:1">
                            <div style="font-weight:600;color:var(--text-primary)">
                                ${squad.name}
                                ${squad.isQualifying ? '<span style="background:#f59e0b;color:#000;padding:2px 6px;border-radius:4px;font-size:0.75rem;margin-left:8px">QUALIFYING</span>' : ''}
                            </div>
                            <div style="font-size:0.85rem;color:var(--muted)">
                                ${dateStr} ${squad.time || ''} • ${squad.available}/${squad.capacity} spots ${isSelected ? '(currently selected)' : ''}
                            </div>
                        </div>
                    </label>
                </div>
            `;
        }).join('');
        
        editArea.innerHTML = `
            <div style="background:rgba(59,130,246,0.1);border:1px solid rgba(59,130,246,0.3);padding:16px;border-radius:8px">
                <h4 style="margin-bottom:12px;color:var(--text-primary)">Edit Squad Selection</h4>
                <div style="max-height:400px;overflow-y:auto;margin-bottom:12px">
                    ${squadOptions}
                </div>
                <div class="form-actions">
                    <button onclick="saveSquadChanges('${regId}')" class="btn btn-primary">
                        Save Changes
                    </button>
                    <button onclick="document.getElementById('edit-area-${regId}').style.display='none'" class="btn btn-secondary">
                        Cancel
                    </button>
                </div>
                <div id="edit-msg-${regId}" style="margin-top:12px;font-size:0.9rem"></div>
            </div>
        `;
        
    } catch (error) {
        console.error('Failed to load squad editor:', error);
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = 'color:#ef4444;padding:12px';
        errorDiv.textContent = `Failed to load squad editor: ${error.message}`;
        editArea.innerHTML = '';
        editArea.appendChild(errorDiv);
    }
}

/**
 * Save squad selection changes for a registration
 * Updates the registration with newly selected squads
 * 
 * @async
 * @param {string} regId - Registration ID
 * @returns {Promise<void>}
 */
async function saveSquadChanges(regId) {
    const msgDiv = document.getElementById(`edit-msg-${regId}`);
    msgDiv.innerHTML = '<span style="color:var(--muted)">Saving...</span>';
    
    try {
        // Get selected squads
        const checkboxes = document.querySelectorAll(`input[name="edit-squads-${regId}"]:checked`);
        const selectedSquads = Array.from(checkboxes).map(cb => cb.value);
        
        if (selectedSquads.length === 0) {
            msgDiv.innerHTML = '<span style="color:#ef4444">Please select at least one squad</span>';
            return;
        }
        
        const response = await fetch(`/api/registrations/${regId}/squads`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken
            },
            credentials: 'same-origin',
            body: JSON.stringify({ assignedSquads: selectedSquads })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            msgDiv.innerHTML = '<span style="color:#4ade80">✓ Squads updated successfully!</span>';
            setTimeout(() => {
                loadRegistrations();
            }, 1000);
        } else {
            msgDiv.innerHTML = `<span style="color:#ef4444">❌ ${data.error || 'Failed to update squads'}</span>`;
        }
    } catch (error) {
        msgDiv.innerHTML = '<span style="color:#ef4444">❌ Network error</span>';
    }
}

/**
 * Cancel a tournament registration
 * Prompts for confirmation before deleting the registration
 * 
 * @async
 * @param {string} regId - Registration ID
 * @param {string} tournamentName - Tournament name (for confirmation dialog)
 * @returns {Promise<void>}
 */
async function cancelRegistration(regId, tournamentName) {
    if (!confirm(`Are you sure you want to cancel your registration for ${tournamentName}? This cannot be undone.`)) {
        return;
    }
    
    const card = document.getElementById(`reg-card-${regId}`);
    const originalContent = card.innerHTML;
    card.innerHTML = '<div style="padding:20px;text-align:center;color:var(--muted)">Cancelling...</div>';
    
    try {
        const response = await fetch(`/api/registrations/${regId}/cancel`, {
            method: 'DELETE',
            headers: { 'X-CSRF-Token': csrfToken },
            credentials: 'same-origin'
        });
        
        const data = await response.json();
        
        if (response.ok) {
            card.innerHTML = `
                <div style="padding:20px;text-align:center">
                    <div style="color:#4ade80;margin-bottom:8px">✓ Registration cancelled</div>
                    <div style="color:var(--muted);font-size:0.9rem">Refreshing...</div>
                </div>
            `;
            setTimeout(() => loadRegistrations(), 1500);
        } else {
            card.innerHTML = originalContent;
            alert(`Failed to cancel registration: ${data.error || 'Unknown error'}`);
        }
    } catch (error) {
        card.innerHTML = originalContent;
        alert('Network error. Please try again.');
    }
}

// ========================================
// EVENT LISTENERS
// ========================================

/**
 * Email form submission handler
 * Requests an OTP code to be sent to the provided email address
 */
document.getElementById('email-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('email-input').value.trim();
    const messageDiv = document.getElementById('email-message');
    const submitBtn = e.target.querySelector('button[type="submit"]');
    
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';
    messageDiv.innerHTML = '';
    
    try {
        const response = await fetch('/api/bowlers/request-otp', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken
            },
            credentials: 'same-origin',
            body: JSON.stringify({ email })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            currentEmail = email;
            document.getElementById('sent-email').textContent = email;
            document.getElementById('email-step').style.display = 'none';
            document.getElementById('otp-step').style.display = 'block';
            document.getElementById('otp-input').focus();
        } else {
            messageDiv.innerHTML = `<div class="error-message">❌ ${data.error || 'Failed to send code'}</div>`;
        }
    } catch (error) {
        messageDiv.innerHTML = `<div class="error-message">❌ Network error. Please try again.</div>`;
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Send Code';
    }
});

/**
 * OTP form submission handler
 * Verifies the OTP code and logs the user in
 */
document.getElementById('otp-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const otp = document.getElementById('otp-input').value.trim();
    const messageDiv = document.getElementById('otp-message');
    const submitBtn = e.target.querySelector('button[type="submit"]');
    
    submitBtn.disabled = true;
    submitBtn.textContent = 'Verifying...';
    messageDiv.innerHTML = '';
    
    try {
        const response = await fetch('/api/bowlers/verify-otp', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken
            },
            credentials: 'same-origin',
            body: JSON.stringify({ email: currentEmail, otp })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            currentBowler = data.bowler;
            currentBowlerId = data.bowler._id;
            messageDiv.innerHTML = `<div class="success-message">✓ Login successful! Loading...</div>`;
            setTimeout(() => loadBowlerHub(), 500);
        } else {
            messageDiv.innerHTML = `<div class="error-message">❌ ${data.error || 'Invalid code'}</div>`;
        }
    } catch (error) {
        messageDiv.innerHTML = `<div class="error-message">❌ Network error. Please try again.</div>`;
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Verify Code';
    }
});

// ========================================
// APPLICATION START
// ========================================

// Fetch CSRF token on page load
async function fetchCsrfToken() {
    try {
        const response = await fetch('/api/csrf-token');
        const data = await response.json();
        csrfToken = data.csrfToken;
    } catch (error) {
        console.error('Failed to fetch CSRF token:', error);
    }
}

// Initialize: Fetch CSRF token and check for existing session
fetchCsrfToken().then(() => checkSession());
