/**
 * @fileoverview Tournament registration page - handles bowler registration workflow
 * Manages multi-step registration process including OTP authentication, squad selection,
 * spot reservations, and form submission for tournament registrations
 * @module register
 */

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

/** @type {Object.<string, number>} Map of tournament IDs to their reservation timer intervals */
let reservationTimers = {};

/** @type {Object.<string, Object>} Map of tournament IDs to their reservation data */
let reservationData = {};

/** @type {Object.<string, string>} Map of tournament IDs to the email addresses being used for signin */
let currentSigninEmail = {};

// ============================================================================
// DATA LOADING
// ============================================================================

/**
 * Loads all upcoming tournaments available for registration
 * Filters for open registration, fetches registration counts and squad availability,
 * then renders tournament cards with registration forms
 * @async
 * @returns {Promise<void>}
 * @throws {Error} If the API request fails
 */
async function loadTournaments() {
    try {
        const response = await fetch('/api/tournaments');
        const tournaments = await response.json();

        // Filter for upcoming tournaments that accept registrations
        const now = new Date();
        const openTournaments = tournaments.filter(t => {
            if (t.status !== 'upcoming') return false;
            if (t.registrationDeadline && new Date(t.registrationDeadline) < now) return false;
            return true;
        });

        // Sort by date
        openTournaments.sort((a, b) => new Date(a.date) - new Date(b.date));

        if (openTournaments.length === 0) {
            document.getElementById('empty-state').style.display = 'block';
            return;
        }

        // Load registration counts and squad availability for each tournament
        const tournamentsWithCounts = await Promise.all(
            openTournaments.map(async (tournament) => {
                try {
                    const countRes = await fetch(`/api/tournaments/${tournament._id}/registrations/count`);
                    const { count } = await countRes.json();
                    
                    // Fetch squad availability
                    let squadsData = null;
                    if (tournament.squads && tournament.squads.length > 0) {
                        const squadsRes = await fetch(`/api/tournaments/${tournament._id}/squads/availability`);
                        squadsData = await squadsRes.json();
                    }
                    
                    return { ...tournament, registrationCount: count, squadsData };
                } catch (e) {
                    return { ...tournament, registrationCount: 0, squadsData: null };
                }
            })
        );

        // Render tournament cards
        const container = document.getElementById('tournaments-container');
        container.innerHTML = tournamentsWithCounts.map(renderTournamentCard).join('');

        // Attach form handlers
        tournamentsWithCounts.forEach(tournament => {
            const form = document.getElementById(`form-${tournament._id}`);
            if (form) {
                form.addEventListener('submit', (e) => handleSubmit(e, tournament));
            }
        });

    } catch (error) {
        console.error('Failed to load tournaments:', error);
        document.getElementById('empty-state').style.display = 'block';
    }
}

// ============================================================================
// UI RENDERING
// ============================================================================

/**
 * Validates squad selection based on tournament re-entry rules
 * Enforces limits on qualifying squad selection when re-entry is not allowed
 * @param {HTMLInputElement} checkbox - The squad checkbox being validated
 * @returns {void}
 */
function validateSquadSelection(checkbox) {
    const allowReentry = checkbox.dataset.allowReentry === 'true';
    const requiredQualifying = parseInt(checkbox.dataset.requiredQualifying) || 0;
    
    if (!allowReentry && requiredQualifying > 0) {
        // Get all qualifying checkboxes in the same form
        const form = checkbox.closest('.registration-form');
        const qualifyingCheckboxes = form.querySelectorAll('input[name="squads"][data-is-qualifying="true"]:checked');
        
        // If user tries to select more than allowed, uncheck this one
        if (qualifyingCheckboxes.length > requiredQualifying) {
            checkbox.checked = false;
            alert(`Re-entry is not allowed for this tournament. You can only select ${requiredQualifying} qualifying squad${requiredQualifying > 1 ? 's' : ''}.`);
        }
    }
}

/**
 * Renders the squad selection section for a tournament
 * Creates checkboxes for each squad with availability information and qualification badges
 * @param {Object} tournament - The tournament object
 * @param {Object} tournament.squadsData - Squad availability data
 * @param {Array} tournament.squadsData.squads - Array of squad objects
 * @param {Object} tournament.squadsData.tournament - Tournament configuration
 * @param {number} tournament.squadsData.tournament.squadsRequiredToQualify - Required qualifying squads
 * @param {boolean} tournament.squadsData.tournament.allowReentry - Whether re-entry is allowed
 * @returns {string} HTML string for squad selection form group
 */
function renderSquadSelection(tournament) {
    if (!tournament.squadsData || !tournament.squadsData.squads || tournament.squadsData.squads.length === 0) {
        return '';
    }

    const squads = tournament.squadsData.squads;
    const requiredQualifying = tournament.squadsData.tournament.squadsRequiredToQualify || 0;
    const allowReentry = tournament.squadsData.tournament.allowReentry !== false; // Default to true

    let requirementText = '';
    if (requiredQualifying > 0) {
        if (allowReentry) {
            requirementText = `<div class="squad-requirement">* Must select at least ${requiredQualifying} qualifying squad${requiredQualifying > 1 ? 's' : ''} (re-entry allowed - bowl as many as you want!)</div>`;
        } else {
            requirementText = `<div class="squad-requirement">* Must select exactly ${requiredQualifying} qualifying squad${requiredQualifying > 1 ? 's' : ''} (re-entry NOT allowed)</div>`;
        }
    }

    const squadCheckboxes = squads.map(squad => {
        const isDisabled = squad.available <= 0;
        const disabledAttr = isDisabled ? 'disabled' : '';
        const disabledClass = isDisabled ? 'disabled' : '';
        
        const squadDate = new Date(squad.date);
        const dateStr = squadDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const timeStr = squad.time || '';
        
        return `
            <div class="squad-option ${disabledClass}">
                <label>
                    <input 
                        type="checkbox" 
                        name="squads" 
                        value="${squad._id}" 
                        data-is-qualifying="${squad.isQualifying}"
                        data-allow-reentry="${allowReentry}"
                        data-required-qualifying="${requiredQualifying}"
                        ${disabledAttr}
                        onchange="validateSquadSelection(this)"
                    />
                    <div class="squad-info">
                        <div class="squad-name">
                            ${squad.name}
                            ${squad.isQualifying ? '<span class="qualifying-badge">QUALIFYING</span>' : ''}
                        </div>
                        <div class="squad-details">
                            ${dateStr} ${timeStr ? `• ${timeStr}` : ''} • ${squad.available}/${squad.capacity} spots available
                        </div>
                    </div>
                </label>
            </div>
        `;
    }).join('');

    return `
        <div class="form-group full-width squad-selection">
            <label>Select Squad(s) *</label>
            ${requirementText}
            <div class="squad-list" id="squad-list-${tournament._id}">
                ${squadCheckboxes}
            </div>
        </div>
    `;
}

/**
 * Renders a complete tournament registration card
 * Creates multi-step registration UI with choice buttons, authentication, and forms
 * @param {Object} tournament - The tournament object
 * @param {string} tournament._id - Tournament unique identifier
 * @param {string} tournament.name - Tournament name
 * @param {string} tournament.location - Tournament location
 * @param {string} tournament.startDate - Tournament start date
 * @param {string} [tournament.endDate] - Tournament end date
 * @param {string} [tournament.description] - Tournament description
 * @param {string} [tournament.registrationDeadline] - Registration deadline
 * @param {number} [tournament.maxParticipants] - Maximum participants
 * @param {number} tournament.registrationCount - Current registration count
 * @param {Object} [tournament.squadsData] - Squad availability data
 * @returns {string} HTML string for tournament card
 */
function renderTournamentCard(tournament) {
    const startDate = new Date(tournament.startDate || tournament.date);
    const endDate = new Date(tournament.endDate || tournament.date);
    const formattedDate = startDate.toDateString() === endDate.toDateString()
        ? startDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
        : `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`;

    const spotsLeft = tournament.maxParticipants 
        ? tournament.maxParticipants - tournament.registrationCount 
        : '∞';
    
    const isFull = tournament.maxParticipants && tournament.registrationCount >= tournament.maxParticipants;

    let deadlineWarning = '';
    if (tournament.registrationDeadline) {
        const deadline = new Date(tournament.registrationDeadline);
        const daysUntil = Math.ceil((deadline - new Date()) / (1000 * 60 * 60 * 24));
        if (daysUntil <= 7 && daysUntil > 0) {
            deadlineWarning = `<div class="deadline-warning">⏰ Registration closes in ${daysUntil} day${daysUntil !== 1 ? 's' : ''} - ${deadline.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>`;
        }
    }

    if (isFull) {
        return `
            <div class="tournament-section">
                <div class="tournament-card">
                    <div class="tournament-header">
                        <div class="tournament-info">
                            <h2>${tournament.name}</h2>
                            <div class="tournament-meta">
                                <div class="meta-item">📅 ${formattedDate}</div>
                                <div class="meta-item">📍 ${tournament.location}</div>
                            </div>
                        </div>
                        <div class="spots-info">
                            <div class="spots-count">FULL</div>
                            <div class="spots-label">Registration Closed</div>
                        </div>
                    </div>
                    ${tournament.description ? `<p style="color:var(--muted);margin-top:16px">${tournament.description}</p>` : ''}
                    <div class="closed-notice">
                        This tournament has reached maximum capacity.
                    </div>
                </div>
            </div>
        `;
    }

    return `
        <div class="tournament-section">
            <div class="tournament-card">
                <div class="tournament-header">
                    <div class="tournament-info">
                        <h2>${tournament.name}</h2>
                        <div class="tournament-meta">
                            <div class="meta-item">📅 ${formattedDate}</div>
                            <div class="meta-item">📍 ${tournament.location}</div>
                            ${tournament.registrationDeadline ? `<div class="meta-item">⏰ Register by ${new Date(tournament.registrationDeadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>` : ''}
                        </div>
                    </div>
                    ${tournament.maxParticipants ? `
                        <div class="spots-info">
                            <div class="spots-count">${spotsLeft}</div>
                            <div class="spots-label">Spots Left</div>
                        </div>
                    ` : ''}
                </div>

                ${tournament.description ? `<p style="color:var(--muted);margin-top:16px">${tournament.description}</p>` : ''}
                ${deadlineWarning}
                
                ${tournament.squadsData && tournament.squadsData.squads && tournament.squadsData.squads.length > 0 ? `
                    <div style="text-align:center;margin:16px 0">
                        <a href="/squads?id=${tournament._id}" style="color:var(--blue-500);text-decoration:none;font-size:.9rem">
                            📋 View Squad Lists & Availability →
                        </a>
                    </div>
                ` : ''}

                <!-- Initial Choice Buttons -->
                <div id="choice-${tournament._id}" class="registration-choice">
                    <h3 style="text-align:center;margin-bottom:24px;color:var(--text-primary)">How would you like to register?</h3>
                    <div class="choice-buttons">
                        <button type="button" class="choice-btn returning-btn" onclick="startReturningBowler('${tournament._id}')">
                            <div class="choice-icon">🎳</div>
                            <div class="choice-title">Returning Bowler</div>
                            <div class="choice-desc">Sign in with email</div>
                        </button>
                        <button type="button" class="choice-btn new-btn" onclick="startNewBowler('${tournament._id}')">
                            <div class="choice-icon">✨</div>
                            <div class="choice-title">New Bowler</div>
                            <div class="choice-desc">First time registering</div>
                        </button>
                    </div>
                </div>

                <!-- Reservation Timer -->
                <div id="timer-${tournament._id}" class="reservation-timer" style="display:none">
                    <span>⏱️ Your spot is reserved for: <strong id="time-${tournament._id}">10:00</strong></span>
                </div>

                <!-- Step 2a: OTP Sign-in (for returning bowlers) -->
                <div id="signin-step-${tournament._id}" class="registration-step" style="display:none">
                    <h3 style="margin-bottom:16px;color:var(--text-primary)">Sign In</h3>
                    <div class="quick-signin-form">
                        <div id="email-step-${tournament._id}" class="signin-step">
                            <p style="color:var(--muted);font-size:0.9rem;margin-bottom:12px">
                                We'll send a code to your email to verify it's you
                            </p>
                            <div class="input-button-group">
                                <input 
                                    type="email" 
                                    id="signin-email-${tournament._id}" 
                                    placeholder="your@email.com"
                                    style="padding:10px;font-size:1rem;border:1px solid rgba(255,255,255,.1);background:#1a1f2e;color:#fff;border-radius:8px"
                                />
                                <button 
                                    type="button" 
                                    class="btn-secondary" 
                                    onclick="requestOTP('${tournament._id}')"
                                >
                                    Send Code
                                </button>
                            </div>
                            <div id="email-msg-${tournament._id}" style="margin-top:8px;font-size:0.9rem"></div>
                        </div>
                        
                        <div id="otp-step-${tournament._id}" class="signin-step" style="display:none">
                            <p style="color:var(--muted);font-size:0.9rem;margin-bottom:12px">
                                Enter the 6-digit code sent to <strong id="sent-to-${tournament._id}"></strong>
                            </p>
                            <div class="input-button-group">
                                <input 
                                    type="text" 
                                    id="signin-otp-${tournament._id}" 
                                    placeholder="000000"
                                    maxlength="6"
                                    style="padding:10px;font-size:1.2rem;text-align:center;letter-spacing:4px;border:1px solid rgba(255,255,255,.1);background:#1a1f2e;color:#fff;border-radius:8px"
                                />
                                <button 
                                    type="button" 
                                    class="btn-secondary" 
                                    onclick="verifyOTP('${tournament._id}')"
                                >
                                    Verify
                                </button>
                            </div>
                            <div id="otp-msg-${tournament._id}" style="margin-top:8px;font-size:0.9rem"></div>
                            <button 
                                type="button" 
                                class="link-btn" 
                                onclick="backToEmail('${tournament._id}')"
                                style="margin-top:8px;font-size:0.85rem"
                            >
                                Use different email
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Step 2b: Personal Info Form (for new bowlers) -->
                <div id="info-step-${tournament._id}" class="registration-step" style="display:none">
                    <h3 style="margin-bottom:16px;color:var(--text-primary)">Your Information</h3>
                    <div class="personal-info-form" style="display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(200px,1fr))">
                        <div class="form-group">
                            <label for="name-${tournament._id}">Full Name *</label>
                            <input id="name-${tournament._id}" name="playerName" required />
                        </div>

                        <div class="form-group">
                            <label for="email-${tournament._id}">Email *</label>
                            <input id="email-${tournament._id}" name="email" type="email" required />
                        </div>

                        <div class="form-group">
                            <label for="phone-${tournament._id}">Phone *</label>
                            <input id="phone-${tournament._id}" name="phone" type="tel" required />
                        </div>

                        <div class="form-group">
                            <label for="gender-${tournament._id}">Gender *</label>
                            <select id="gender-${tournament._id}" name="gender" required style="padding:10px;font-size:1rem;border:1px solid rgba(255,255,255,.1);background:#1a1f2e;color:#fff;border-radius:8px;width:100%">
                                <option value="">Select...</option>
                                <option value="male">Male</option>
                                <option value="female">Female</option>
                            </select>
                        </div>

                        <div class="form-group">
                            <label for="average-${tournament._id}">Average Score</label>
                            <input id="average-${tournament._id}" name="averageScore" type="number" min="0" max="300" placeholder="e.g., 180" />
                        </div>
                    </div>
                    <button type="button" class="btn-primary" onclick="proceedToSquads('${tournament._id}')" style="margin-top:20px;padding:12px 24px;background:var(--blue-500);color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:1rem;width:100%">
                        Continue to Squad Selection →
                    </button>
                    <div id="info-msg-${tournament._id}" style="margin-top:12px;font-size:0.9rem"></div>
                </div>

                <!-- Step 3: Squad Selection (for all) -->
                <form id="form-${tournament._id}" class="reg-form registration-step" style="display:none">
                    <div id="verified-info-${tournament._id}" style="display:none;background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.3);padding:12px;border-radius:8px;margin-bottom:16px">
                        <span style="color:#4ade80" id="verified-name-${tournament._id}"></span>
                    </div>
                    
                    <h3 style="margin-bottom:16px;color:var(--text-primary)">Select Your Squads</h3>

                    ${renderSquadSelection(tournament)}

                    <div class="form-group full-width">
                        <label for="notes-${tournament._id}">Additional Notes</label>
                        <textarea id="notes-${tournament._id}" name="notes" placeholder="Any special requirements or information..."></textarea>
                    </div>

                    <button type="submit" class="submit-btn">Complete Registration</button>
                    
                    <div id="message-${tournament._id}"></div>
                </form>
            </div>
        </div>
    `;
}

// ============================================================================
// FORM HANDLING
// ============================================================================

/**
 * Handles tournament registration form submission
 * Validates squad selection, collects form data, and submits registration to API
 * @async
 * @param {Event} e - Form submit event
 * @param {Object} tournament - The tournament object being registered for
 * @returns {Promise<void>}
 * @throws {Error} If registration submission fails
 */
async function handleSubmit(e, tournament) {
    e.preventDefault();
    const form = e.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    const messageDiv = document.getElementById(`message-${tournament._id}`);

    // Disable submit button
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';
    messageDiv.innerHTML = '';

    // Gather form data
    const formData = new FormData(form);
    
    // Collect selected squads
    const selectedSquads = [];
    const squadCheckboxes = form.querySelectorAll('input[name="squads"]:checked');
    squadCheckboxes.forEach(cb => selectedSquads.push(cb.value));

    // Validate squad selection if tournament has squads
    if (tournament.squadsData && tournament.squadsData.squads && tournament.squadsData.squads.length > 0) {
        if (selectedSquads.length === 0) {
            messageDiv.innerHTML = `<div class="error-message">❌ Please select at least one squad</div>`;
            submitBtn.disabled = false;
            submitBtn.textContent = `Register for ${tournament.name}`;
            return;
        }

        // Validate qualifying squad requirement
        const requiredQualifying = tournament.squadsData.tournament.squadsRequiredToQualify || 0;
        const allowReentry = tournament.squadsData.tournament.allowReentry !== false;
        
        if (requiredQualifying > 0) {
            const qualifyingSelected = Array.from(squadCheckboxes)
                .filter(cb => cb.dataset.isQualifying === 'true')
                .length;
            
            if (allowReentry) {
                // Re-entry allowed - just need minimum
                if (qualifyingSelected < requiredQualifying) {
                    messageDiv.innerHTML = `<div class="error-message">❌ Must select at least ${requiredQualifying} qualifying squad${requiredQualifying > 1 ? 's' : ''}</div>`;
                    submitBtn.disabled = false;
                    submitBtn.textContent = `Register for ${tournament.name}`;
                    return;
                }
            } else {
                // Re-entry NOT allowed - must select exact number
                if (qualifyingSelected !== requiredQualifying) {
                    messageDiv.innerHTML = `<div class="error-message">❌ Must select exactly ${requiredQualifying} qualifying squad${requiredQualifying > 1 ? 's' : ''} (re-entry not allowed)</div>`;
                    submitBtn.disabled = false;
                    submitBtn.textContent = `Register for ${tournament.name}`;
                    return;
                }
            }
        }
    }

    // Check if this is a returning bowler (has stored data) or new bowler (read from form)
    const bowlerInfo = window.bowlerData && window.bowlerData[tournament._id] 
        ? window.bowlerData[tournament._id]
        : {
            playerName: document.getElementById(`name-${tournament._id}`).value,
            email: document.getElementById(`email-${tournament._id}`).value,
            phone: document.getElementById(`phone-${tournament._id}`).value,
            gender: document.getElementById(`gender-${tournament._id}`).value,
            averageScore: document.getElementById(`average-${tournament._id}`).value ? parseInt(document.getElementById(`average-${tournament._id}`).value) : null
        };
    
    const data = {
        tournamentId: tournament._id,
        playerName: bowlerInfo.playerName,
        email: bowlerInfo.email,
        phone: bowlerInfo.phone,
        gender: bowlerInfo.gender,
        averageScore: bowlerInfo.averageScore,
        notes: formData.get('notes'),
        assignedSquads: selectedSquads
    };

    try {
        const response = await fetch('/api/registrations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Registration failed');
        }

        // Success - Clear reservation timer
        if (reservationTimers[tournament._id]) {
            clearInterval(reservationTimers[tournament._id]);
            delete reservationTimers[tournament._id];
        }
        if (reservationData[tournament._id]) {
            // Release the reservation on server
            fetch(`/api/reservations/${reservationData[tournament._id].sessionId}`, {
                method: 'DELETE'
            }).catch(err => console.error('Failed to release reservation:', err));
            delete reservationData[tournament._id];
        }

        // Success
        const squadInfo = selectedSquads.length > 0 ? ` for ${selectedSquads.length} squad${selectedSquads.length > 1 ? 's' : ''}` : '';
        messageDiv.innerHTML = `
            <div class="success-message">
                ✅ Registration successful! You're registered for ${tournament.name}${squadInfo}. 
                A confirmation email will be sent to ${data.email}.
            </div>
        `;
        form.reset();

        // Reload tournaments to update counts
        setTimeout(() => loadTournaments(), 2000);

    } catch (error) {
        messageDiv.innerHTML = `
            <div class="error-message">
                ❌ ${error.message}
            </div>
        `;
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = `Register for ${tournament.name}`;
    }
}

/**
 * Validates and advances from personal info to squad selection
 * Checks required fields and email format before proceeding
 * @param {string} tournamentId - The tournament ID
 * @returns {void}
 */
function proceedToSquads(tournamentId) {
    const msgDiv = document.getElementById(`info-msg-${tournamentId}`);
    
    // Validate required fields
    const name = document.getElementById(`name-${tournamentId}`).value.trim();
    const email = document.getElementById(`email-${tournamentId}`).value.trim();
    const phone = document.getElementById(`phone-${tournamentId}`).value.trim();
    const gender = document.getElementById(`gender-${tournamentId}`).value;
    
    if (!name || !email || !phone || !gender) {
        msgDiv.innerHTML = '<span style="color:#f87171">Please fill in all required fields</span>';
        return;
    }
    
    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        msgDiv.innerHTML = '<span style="color:#f87171">Please enter a valid email address</span>';
        return;
    }
    
    msgDiv.innerHTML = '';
    
    // Move to squad selection
    document.getElementById(`info-step-${tournamentId}`).style.display = 'none';
    document.getElementById(`form-${tournamentId}`).style.display = 'block';
    
    // Scroll to squad selection
    document.getElementById(`form-${tournamentId}`).scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ============================================================================
// RESERVATION MANAGEMENT
// ============================================================================

/**
 * Starts the registration flow for a returning bowler
 * Creates a spot reservation and displays the OTP signin step
 * @async
 * @param {string} tournamentId - The tournament ID
 * @returns {Promise<void>}
 */
async function startReturningBowler(tournamentId) {
    await createReservation(tournamentId);
    document.getElementById(`choice-${tournamentId}`).style.display = 'none';
    document.getElementById(`timer-${tournamentId}`).style.display = 'block';
    document.getElementById(`signin-step-${tournamentId}`).style.display = 'block';
    document.getElementById(`signin-email-${tournamentId}`).focus();
}

/**
 * Starts the registration flow for a new bowler
 * Creates a spot reservation and displays the personal info form
 * @async
 * @param {string} tournamentId - The tournament ID
 * @returns {Promise<void>}
 */
async function startNewBowler(tournamentId) {
    await createReservation(tournamentId);
    document.getElementById(`choice-${tournamentId}`).style.display = 'none';
    document.getElementById(`timer-${tournamentId}`).style.display = 'block';
    document.getElementById(`info-step-${tournamentId}`).style.display = 'block';
    document.getElementById(`name-${tournamentId}`).focus();
}

/**
 * Creates a temporary spot reservation for the tournament
 * Reserves a spot in the tournament for a limited time during registration
 * @async
 * @param {string} tournamentId - The tournament ID to reserve
 * @returns {Promise<void>}
 * @throws {Error} If reservation creation fails
 */
async function createReservation(tournamentId) {
    try {
        const response = await fetch('/api/reservations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tournamentId })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            reservationData[tournamentId] = data.reservation;
            startReservationTimer(tournamentId, data.expiresAt);
        }
    } catch (error) {
        console.error('Failed to create reservation:', error);
    }
}

/**
 * Starts and manages the countdown timer for a spot reservation
 * Updates the UI every second and handles expiration
 * @param {string} tournamentId - The tournament ID
 * @param {string} expiresAt - ISO timestamp when reservation expires
 * @returns {void}
 */
function startReservationTimer(tournamentId, expiresAt) {
    const updateTimer = () => {
        const now = new Date();
        const timeLeft = Math.max(0, Math.floor((new Date(expiresAt) - now) / 1000));
        
        if (timeLeft <= 0) {
            handleReservationExpired(tournamentId);
            return;
        }
        
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        const timeDisplay = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        
        const timerElement = document.getElementById(`time-${tournamentId}`);
        if (timerElement) {
            timerElement.textContent = timeDisplay;
            
            // Warning color when under 2 minutes
            if (timeLeft < 120) {
                timerElement.style.color = '#f87171';
            }
        }
    };
    
    // Clear existing timer if any
    if (reservationTimers[tournamentId]) {
        clearInterval(reservationTimers[tournamentId]);
    }
    
    // Update immediately and then every second
    updateTimer();
    reservationTimers[tournamentId] = setInterval(updateTimer, 1000);
}

/**
 * Handles expired spot reservations
 * Clears timers, hides forms, and displays expiration message
 * @param {string} tournamentId - The tournament ID
 * @returns {void}
 */
function handleReservationExpired(tournamentId) {
    clearInterval(reservationTimers[tournamentId]);
    delete reservationTimers[tournamentId];
    delete reservationData[tournamentId];
    
    // Hide form and show expired message
    document.getElementById(`form-${tournamentId}`).style.display = 'none';
    document.getElementById(`choice-${tournamentId}`).innerHTML = `
        <div style="text-align:center;padding:40px 20px">
            <div style="font-size:3rem;margin-bottom:16px">⏰</div>
            <h3 style="color:var(--text-primary);margin-bottom:12px">Reservation Expired</h3>
            <p style="color:var(--muted);margin-bottom:24px">Your spot reservation has expired. Please start again to reserve a new spot.</p>
            <button 
                type="button" 
                class="btn-secondary" 
                onclick="location.reload()"
                style="padding:12px 24px;background:var(--blue-500);color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:1rem"
            >
                Start Over
            </button>
        </div>
    `;
    document.getElementById(`choice-${tournamentId}`).style.display = 'block';
}

// ============================================================================
// OTP AUTHENTICATION
// ============================================================================

/**
 * Requests an OTP code to be sent to the provided email address
 * First step of returning bowler authentication
 * @async
 * @param {string} tournamentId - The tournament ID
 * @returns {Promise<void>}
 * @throws {Error} If OTP request fails
 */
async function requestOTP(tournamentId) {
    const emailInput = document.getElementById(`signin-email-${tournamentId}`);
    const email = emailInput.value.trim();
    const msgDiv = document.getElementById(`email-msg-${tournamentId}`);
    
    if (!email) {
        msgDiv.innerHTML = '<span style="color:#f87171">Please enter your email</span>';
        return;
    }
    
    msgDiv.innerHTML = '<span style="color:var(--muted)">Sending code...</span>';
    
    try {
        const response = await fetch('/api/bowlers/request-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            currentSigninEmail[tournamentId] = email;
            document.getElementById(`sent-to-${tournamentId}`).textContent = email;
            document.getElementById(`email-step-${tournamentId}`).style.display = 'none';
            document.getElementById(`otp-step-${tournamentId}`).style.display = 'block';
            document.getElementById(`signin-otp-${tournamentId}`).focus();
            msgDiv.innerHTML = '';
        } else {
            msgDiv.innerHTML = `<span style="color:#f87171">${data.error || 'Failed to send code'}</span>`;
        }
    } catch (error) {
        msgDiv.innerHTML = '<span style="color:#f87171">Network error</span>';
    }
}

/**
 * Verifies the OTP code entered by the user
 * Authenticates returning bowler and loads their information
 * @async
 * @param {string} tournamentId - The tournament ID
 * @returns {Promise<void>}
 * @throws {Error} If OTP verification fails
 */
async function verifyOTP(tournamentId) {
    const otpInput = document.getElementById(`signin-otp-${tournamentId}`);
    const otp = otpInput.value.trim();
    const msgDiv = document.getElementById(`otp-msg-${tournamentId}`);
    const email = currentSigninEmail[tournamentId];
    
    if (!otp || otp.length !== 6) {
        msgDiv.innerHTML = '<span style="color:#f87171">Please enter 6-digit code</span>';
        return;
    }
    
    msgDiv.innerHTML = '<span style="color:var(--muted)">Verifying...</span>';
    
    try {
        const response = await fetch('/api/bowlers/verify-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, otp })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            msgDiv.innerHTML = '<span style="color:#4ade80">✓ Verified! Loading your info...</span>';
            
            // Fetch full bowler details
            const bowlerRes = await fetch(`/api/bowlers/${data.bowler._id}`);
            const bowler = await bowlerRes.json();
            
            // Fetch their most recent registration to get gender
            let recentGender = '';
            try {
                const regsRes = await fetch(`/api/bowlers/my/registrations`);
                const registrations = await regsRes.json();
                if (registrations.length > 0) {
                    // Use gender from most recent registration
                    recentGender = registrations[0].gender || '';
                }
            } catch (e) {
                console.log('Could not fetch recent registrations');
            }
            
            // Store bowler data for form submission
            if (!window.bowlerData) window.bowlerData = {};
            window.bowlerData[tournamentId] = {
                playerName: bowler.playerName || '',
                email: bowler.email,
                phone: bowler.phone || '',
                gender: recentGender,
                averageScore: bowler.currentAverage || null
            };
            
            // Hide signin step, show squad selection
            document.getElementById(`signin-step-${tournamentId}`).style.display = 'none';
            document.getElementById(`form-${tournamentId}`).style.display = 'block';
            document.getElementById(`verified-info-${tournamentId}`).style.display = 'block';
            document.getElementById(`verified-name-${tournamentId}`).textContent = `✓ Signed in as ${bowler.playerName || bowler.email}`;
            
            // Scroll to squad selection
            document.getElementById(`form-${tournamentId}`).scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
            msgDiv.innerHTML = `<span style="color:#f87171">${data.error || 'Invalid code'}</span>`;
        }
    } catch (error) {
        msgDiv.innerHTML = '<span style="color:#f87171">Network error</span>';
    }
}

/**
 * Returns to the email entry step from OTP verification
 * Allows user to use a different email address
 * @param {string} tournamentId - The tournament ID
 * @returns {void}
 */
function backToEmail(tournamentId) {
    document.getElementById(`otp-step-${tournamentId}`).style.display = 'none';
    document.getElementById(`email-step-${tournamentId}`).style.display = 'block';
    document.getElementById(`signin-otp-${tournamentId}`).value = '';
    document.getElementById(`otp-msg-${tournamentId}`).innerHTML = '';
    document.getElementById(`signin-email-${tournamentId}`).focus();
}

// ============================================================================
// INITIALIZATION
// ============================================================================

// Load tournaments on page load
loadTournaments();
