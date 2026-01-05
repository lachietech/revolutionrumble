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

                <form id="form-${tournament._id}" class="reg-form">
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

                    ${renderSquadSelection(tournament)}

                    <div class="form-group full-width">
                        <label for="notes-${tournament._id}">Additional Notes</label>
                        <textarea id="notes-${tournament._id}" name="notes" placeholder="Any special requirements or information..."></textarea>
                    </div>

                    <button type="submit" class="submit-btn">Register for ${tournament.name}</button>
                    
                    <div id="message-${tournament._id}"></div>
                </form>
            </div>
        </div>
    `;
}

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

    const data = {
        tournamentId: tournament._id,
        playerName: formData.get('playerName'),
        email: formData.get('email'),
        phone: formData.get('phone'),
        gender: formData.get('gender'),
        averageScore: formData.get('averageScore') ? parseInt(formData.get('averageScore')) : null,
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

// Load tournaments on page load
loadTournaments();