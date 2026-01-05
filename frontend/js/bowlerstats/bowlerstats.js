let currentBowler = null;
let allBowlers = [];
let canEdit = false;

// Initialize on page load
async function init() {
    // Check if we have a bowler ID in URL
    const urlParams = new URLSearchParams(window.location.search);
    const bowlerId = urlParams.get('id');
    
    if (bowlerId) {
        await loadBowlerById(bowlerId);
    } else {
        await loadBowlers();
    }
}

// Load all bowlers for directory
async function loadBowlers() {
    try {
        const sortBy = document.getElementById('sort-select').value;
        const response = await fetch('/api/bowlers');
        allBowlers = await response.json();
        
        // Sort bowlers
        if (sortBy === 'avg-desc') {
            allBowlers.sort((a, b) => (b.tournamentAverage || b.currentAverage || 0) - (a.tournamentAverage || a.currentAverage || 0));
        } else if (sortBy === 'avg-asc') {
            allBowlers.sort((a, b) => (a.tournamentAverage || a.currentAverage || 0) - (b.tournamentAverage || b.currentAverage || 0));
        } else if (sortBy === 'name-asc') {
            allBowlers.sort((a, b) => a.playerName.localeCompare(b.playerName));
        } else if (sortBy === 'tournaments-desc') {
            allBowlers.sort((a, b) => (b.tournamentsEntered?.length || 0) - (a.tournamentsEntered?.length || 0));
        }
        
        filterBowlers();
    } catch (error) {
        console.error('Error loading bowlers:', error);
    }
}

// Filter and display bowlers
function filterBowlers() {
    const searchTerm = document.getElementById('search-input').value.toLowerCase();
    const handFilter = document.getElementById('hand-filter').value;
    
    const filtered = allBowlers.filter(b => {
        const matchesSearch = b.playerName.toLowerCase().includes(searchTerm) || 
                                (b.nickname && b.nickname.toLowerCase().includes(searchTerm));
        const matchesHand = handFilter === 'all' || b.hand === handFilter;
        return matchesSearch && matchesHand;
    });
    
    renderBowlerList(filtered);
}

// Render bowler list
function renderBowlerList(bowlers) {
    const listEl = document.getElementById('bowler-list');
    
    if (bowlers.length === 0) {
        listEl.innerHTML = '<li class="empty-state">No bowlers found</li>';
        return;
    }
    
    listEl.innerHTML = bowlers.map(b => {
        const avg = b.tournamentAverage || b.currentAverage || '--';
        const tournaments = b.tournamentsEntered?.length || 0;
        const isActive = currentBowler && currentBowler._id === b._id;
        
        return `
            <li class="bowler-card ${isActive ? 'active' : ''}" onclick="selectBowler('${b._id}')">
                <div class="bowler-card-name">
                    ${b.playerName}${b.nickname ? ` "${b.nickname}"` : ''}
                </div>
                <div class="bowler-card-stats">
                    <span>Avg: ${avg}</span>
                    <span>•</span>
                    <span>${tournaments} tournament${tournaments !== 1 ? 's' : ''}</span>
                </div>
            </li>
        `;
    }).join('');
}

// Select bowler from list
async function selectBowler(bowlerId) {
    await loadBowlerById(bowlerId);
    // Update URL without reload
    window.history.pushState({}, '', `/playerstats?id=${bowlerId}`);
}

// Load specific bowler by ID
async function loadBowlerById(bowlerId) {
    try {
        const response = await fetch(`/api/bowlers/${bowlerId}`);
        if (!response.ok) throw new Error('Bowler not found');
        
        currentBowler = await response.json();
        canEdit = false; // Public view by default
        await loadHistory();
        displayProfile();
        
        // Update active state in list
        filterBowlers();
    } catch (error) {
        console.error('Error loading bowler:', error);
        alert('Failed to load bowler profile');
    }
}

// Show claim profile form
function showClaimForm() {
    const profileSection = document.getElementById('profile-display-section');
    profileSection.innerHTML = `
        <div class="card">
            <h2 style="margin-top:0">Claim Your Profile</h2>
            <p style="color:var(--muted)">Enter your email address to find and edit your bowler profile.</p>
            <div class="email-form">
                <input 
                    type="email" 
                    id="claim-email" 
                    placeholder="Enter your email address"
                    required
                />
                <button onclick="claimProfile()">Find My Profile</button>
                <div id="claim-message"></div>
            </div>
            <button class="btn btn-secondary" onclick="init()" style="margin-top:16px">Cancel</button>
        </div>
    `;
}

// Claim profile via email
async function claimProfile() {
    const email = document.getElementById('claim-email').value.trim();
    const messageDiv = document.getElementById('claim-message');
    messageDiv.innerHTML = '';

    if (!email) {
        messageDiv.innerHTML = '<div class="message message-error">Please enter your email address</div>';
        return;
    }

    try {
        const response = await fetch(`/api/bowlers/lookup?email=${encodeURIComponent(email)}`);
        
        if (!response.ok) {
            if (response.status === 404) {
                messageDiv.innerHTML = '<div class="message message-error">No profile found. Register for a tournament to create your profile!</div>';
            } else {
                throw new Error('Failed to lookup profile');
            }
            return;
        }

        currentBowler = await response.json();
        canEdit = true; // Enable editing
        await loadHistory();
        displayProfile();
        
        window.history.pushState({}, '', `/playerstats?id=${currentBowler._id}`);
    } catch (error) {
        console.error('Lookup error:', error);
        messageDiv.innerHTML = '<div class="message message-error">Error loading profile. Please try again.</div>';
    }
}

async function loadHistory() {
    try {
        const response = await fetch(`/api/bowlers/${currentBowler._id}/history`);
        const data = await response.json();
        
        const historyList = document.getElementById('tournament-history');
        
        if (data.registrations.length === 0) {
            historyList.innerHTML = '<li class="empty-state">No tournament registrations yet</li>';
            return;
        }

        historyList.innerHTML = data.registrations.map(reg => {
            const date = new Date(reg.tournament.date);
            const dateStr = date.toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            });

            // Find matching result
            const result = data.results.find(r => r.tournament._id === reg.tournament._id);
            
            return `
                <li class="tournament-item">
                    <div>
                        <div class="tournament-name">${reg.tournament.name}</div>
                        <div class="tournament-date">${dateStr} • ${reg.tournament.location}</div>
                    </div>
                    ${result ? `
                        <div class="tournament-score">
                            <div class="score-value">${result.tournamentAverage}</div>
                            <div class="score-label">Average (${result.totalGames} games)</div>
                        </div>
                    ` : `
                        <span class="status-badge status-registered">Registered</span>
                    `}
                </li>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading history:', error);
    }
}

function displayProfile() {
    // Hide directory, show profile section
    document.getElementById('directory-section').style.display = 'none';
    document.getElementById('profile-section').style.display = 'block';
    
    // Render profile HTML
    const profileSection = document.getElementById('profile-section');
    profileSection.innerHTML = `
        <button class="btn btn-secondary" onclick="backToDirectory()" style="margin-bottom:16px">
            ← Back to Directory
        </button>
        
        <!-- Profile Display -->
        <div id="profile-display" class="card">
            <div class="profile-header">
                <div class="profile-info">
                    <h2>${currentBowler.playerName}</h2>
                    <div class="profile-nickname">${currentBowler.nickname ? `"${currentBowler.nickname}"` : ''}</div>
                    <div class="profile-meta">
                        <span>${currentBowler.email}</span>
                        ${currentBowler.hand ? `<span>🎳 ${currentBowler.hand.charAt(0).toUpperCase() + currentBowler.hand.slice(1)} hand</span>` : ''}
                        ${currentBowler.yearsExperience ? `<span>📅 ${currentBowler.yearsExperience} years experience</span>` : ''}
                        ${currentBowler.homeCenter ? `<span>🏠 ${currentBowler.homeCenter}</span>` : ''}
                    </div>
                </div>
                ${canEdit ? '<button class="btn btn-secondary" onclick="toggleEditMode()">Edit Profile</button>' : '<button class="claim-profile-btn" onclick="showClaimForm()">Is this you? Claim this profile</button>'}
            </div>

            ${currentBowler.bio ? `<p style="color:var(--muted);margin-top:16px">${currentBowler.bio}</p>` : ''}

            <div class="stats-grid">
                <div class="stat-box">
                    <div class="stat-value">${currentBowler.tournamentAverage || '--'}</div>
                    <div class="stat-label">Tournament Avg</div>
                </div>
                <div class="stat-box">
                    <div class="stat-value">${currentBowler.currentAverage || '--'}</div>
                    <div class="stat-label">Current Avg</div>
                </div>
                <div class="stat-box">
                    <div class="stat-value">${currentBowler.highGame || '--'}</div>
                    <div class="stat-label">High Game</div>
                </div>
                <div class="stat-box">
                    <div class="stat-value">${currentBowler.tournamentsEntered?.length || '0'}</div>
                    <div class="stat-label">Tournaments</div>
                </div>
            </div>
        </div>

        <!-- Edit Form (hidden initially) -->
        <div id="edit-form" class="card" style="display:none">
            <h3 style="margin-top:0">Edit Profile</h3>
            <form onsubmit="saveProfile(event)" class="edit-form">
                <div class="form-group">
                    <label for="edit-nickname">Nickname</label>
                    <input type="text" id="edit-nickname" placeholder="Optional nickname" value="${currentBowler.nickname || ''}" />
                </div>

                <div class="form-group">
                    <label for="edit-hand">Bowling Hand</label>
                    <select id="edit-hand">
                        <option value="" ${!currentBowler.hand ? 'selected' : ''}>Not specified</option>
                        <option value="right" ${currentBowler.hand === 'right' ? 'selected' : ''}>Right</option>
                        <option value="left" ${currentBowler.hand === 'left' ? 'selected' : ''}>Left</option>
                        <option value="both" ${currentBowler.hand === 'both' ? 'selected' : ''}>Both</option>
                    </select>
                </div>

                <div class="form-group">
                    <label for="edit-home-center">Home Center</label>
                    <input type="text" id="edit-home-center" placeholder="Your home bowling center" value="${currentBowler.homeCenter || ''}" />
                </div>

                <div class="form-group">
                    <label for="edit-years">Years Experience</label>
                    <input type="number" id="edit-years" min="0" max="100" value="${currentBowler.yearsExperience || ''}" />
                </div>

                <div class="form-group">
                    <label for="edit-current-avg">Current Average</label>
                    <input type="number" id="edit-current-avg" min="0" max="300" value="${currentBowler.currentAverage || ''}" />
                </div>

                <div class="form-group">
                    <label for="edit-high-game">High Game</label>
                    <input type="number" id="edit-high-game" min="0" max="300" value="${currentBowler.highGame || ''}" />
                </div>

                <div class="form-group">
                    <label for="edit-high-series">High Series</label>
                    <input type="number" id="edit-high-series" min="0" max="900" value="${currentBowler.highSeries || ''}" />
                </div>

                <div class="form-group full-width">
                    <label for="edit-bio">Bio</label>
                    <textarea id="edit-bio" placeholder="Tell us about yourself...">${currentBowler.bio || ''}</textarea>
                </div>

                <div class="form-group full-width" style="display:flex;gap:12px">
                    <button type="submit" class="btn btn-primary" style="flex:1">Save Changes</button>
                    <button type="button" class="btn btn-secondary" onclick="toggleEditMode()">Cancel</button>
                </div>
            </form>
            <div id="edit-message"></div>
        </div>

        <!-- Tournament History -->
        <div class="card">
            <h3 style="margin-top:0">Tournament History</h3>
            <ul class="tournament-list" id="tournament-history"></ul>
        </div>
    `;
    
    // Load tournament history after rendering
    setTimeout(() => loadHistory(), 100);
}

function backToDirectory() {
    document.getElementById('directory-section').style.display = 'block';
    document.getElementById('profile-section').style.display = 'none';
    window.history.pushState({}, '', '/playerstats');
    currentBowler = null;
    canEdit = false;
}

function toggleEditMode() {
    const display = document.getElementById('profile-display');
    const editForm = document.getElementById('edit-form');
    
    if (editForm.style.display === 'none') {
        // Populate edit form
        document.getElementById('edit-nickname').value = currentBowler.nickname || '';
        document.getElementById('edit-hand').value = currentBowler.hand || '';
        document.getElementById('edit-home-center').value = currentBowler.homeCenter || '';
        document.getElementById('edit-years').value = currentBowler.yearsExperience || '';
        document.getElementById('edit-current-avg').value = currentBowler.currentAverage || '';
        document.getElementById('edit-high-game').value = currentBowler.highGame || '';
        document.getElementById('edit-high-series').value = currentBowler.highSeries || '';
        document.getElementById('edit-bio').value = currentBowler.bio || '';
        
        display.style.display = 'none';
        editForm.style.display = 'block';
    } else {
        display.style.display = 'block';
        editForm.style.display = 'none';
        document.getElementById('edit-message').innerHTML = '';
    }
}

async function saveProfile(event) {
    event.preventDefault();
    const messageDiv = document.getElementById('edit-message');
    messageDiv.innerHTML = '';

    const updatedData = {
        email: currentBowler.email, // Required for verification
        nickname: document.getElementById('edit-nickname').value,
        hand: document.getElementById('edit-hand').value,
        homeCenter: document.getElementById('edit-home-center').value,
        yearsExperience: document.getElementById('edit-years').value ? parseInt(document.getElementById('edit-years').value) : undefined,
        currentAverage: document.getElementById('edit-current-avg').value ? parseInt(document.getElementById('edit-current-avg').value) : undefined,
        highGame: document.getElementById('edit-high-game').value ? parseInt(document.getElementById('edit-high-game').value) : undefined,
        highSeries: document.getElementById('edit-high-series').value ? parseInt(document.getElementById('edit-high-series').value) : undefined,
        bio: document.getElementById('edit-bio').value
    };

    try {
        const response = await fetch(`/api/bowlers/${currentBowler._id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedData)
        });

        if (!response.ok) {
            throw new Error('Failed to update profile');
        }

        currentBowler = await response.json();
        displayProfile();
        
        const messageDiv = document.getElementById('edit-message');
        messageDiv.innerHTML = '<div class="message message-success">✅ Profile updated successfully!</div>';
        setTimeout(() => {
            messageDiv.innerHTML = '';
            toggleEditMode();
        }, 2000);
    } catch (error) {
        console.error('Save error:', error);
        const messageDiv = document.getElementById('edit-message');
        messageDiv.innerHTML = '<div class="message message-error">❌ Failed to save changes. Please try again.</div>';
    }
}

// Initialize on page load
init();