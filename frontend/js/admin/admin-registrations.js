/**
 * @fileoverview Admin registration management
 */

let csrfToken = null;

const regListContainer = document.getElementById('registrationList');
const regFilterSelect = document.getElementById('regTournamentFilter');
const regCountSpan = document.getElementById('regCount');

loadTournamentsForFilter();
loadRegistrations();
regFilterSelect.addEventListener('change', loadRegistrations);

async function ensureCsrfToken() {
    if (csrfToken) return;
    const csrfResponse = await fetch('/api/csrf-token');
    const csrfData = await csrfResponse.json();
    csrfToken = csrfData.csrfToken;
}

async function loadTournamentsForFilter() {
    try {
        await ensureCsrfToken();
        const response = await fetch('/api/tournaments');
        const tournaments = await response.json();
        regFilterSelect.innerHTML = '<option value="">All Tournaments</option>' +
            tournaments.map((tournament) => {
                const date = new Date(tournament.startDate || tournament.date).toLocaleDateString();
                return `<option value="${tournament._id}">${tournament.name} (${date})</option>`;
            }).join('');
    } catch (error) {
        console.error('Error loading tournaments:', error);
    }
}

async function loadRegistrations() {
    try {
        const tournamentId = regFilterSelect.value;
        const url = tournamentId ? `/api/registrations?tournamentId=${tournamentId}` : '/api/registrations';

        const response = await fetch(url);
        const registrations = await response.json();
        regCountSpan.textContent = registrations.length;

        if (registrations.length === 0) {
            regListContainer.innerHTML = '<p class="admin-empty-state">No registrations found.</p>';
            return;
        }

        const tournamentsRes = await fetch('/api/tournaments');
        const tournaments = await tournamentsRes.json();
        const tournamentsById = {};
        tournaments.forEach((tournament) => {
            tournamentsById[tournament._id] = tournament;
        });

        regListContainer.innerHTML = `
            <div class="registration-table-wrap">
                <table class="registration-table">
                    <thead>
                        <tr>
                            <th>Player</th>
                            <th>Tournament</th>
                            <th>Squads</th>
                            <th>Contact</th>
                            <th>Status</th>
                            <th>Payment</th>
                            <th>Registered</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${registrations.map((registration) => renderRegistrationTableRow(registration, tournamentsById)).join('')}
                    </tbody>
                </table>
            </div>
            <div class="registration-card-list">
                ${registrations.map((registration) => renderRegistrationCard(registration, tournamentsById)).join('')}
            </div>
        `;
    } catch (error) {
        console.error('Error loading registrations:', error);
        regListContainer.innerHTML = '<p class="admin-empty-state">Failed to load registrations.</p>';
    }
}

function getSquadNames(registration, tournamentsById) {
    if (!registration.assignedSquads || registration.assignedSquads.length === 0) {
        return [];
    }

    const tournament = tournamentsById[registration.tournament._id];
    if (!tournament || !tournament.squads) {
        return [];
    }

    return registration.assignedSquads.map((squadId) => {
        const squad = tournament.squads.find((entry) => entry._id === squadId);
        return squad ? squad.name : 'Unknown';
    });
}

function getPaymentClass(paymentStatus) {
    if (paymentStatus === 'paid') return 'is-paid';
    if (paymentStatus === 'deposit') return 'is-deposit';
    return 'is-unpaid';
}

function renderGenderBadge(gender) {
    if (!gender) return '';
    const className = gender === 'female' ? 'is-female' : 'is-male';
    const label = gender === 'female' ? 'F' : 'M';
    return `<span class="registration-gender ${className}">${label}</span>`;
}

function renderRegistrationTableRow(registration, tournamentsById) {
    const squadNames = getSquadNames(registration, tournamentsById);

    return `
        <tr>
            <td>
                <div class="registration-player">
                    <strong>${registration.playerName}</strong>
                    ${renderGenderBadge(registration.gender)}
                    ${registration.averageScore ? `<span class="registration-meta">Average: ${registration.averageScore}</span>` : ''}
                </div>
            </td>
            <td>${registration.tournament?.name || 'N/A'}</td>
            <td><div class="registration-squads">${squadNames.length ? squadNames.join('<br>') : 'None assigned'}</div></td>
            <td><div class="registration-contact">${registration.email}<br>${registration.phone}</div></td>
            <td>
                <select class="registration-status-select" onchange="updateRegistrationStatus('${registration._id}', this.value)">
                    <option value="pending" ${registration.status === 'pending' ? 'selected' : ''}>Pending</option>
                    <option value="confirmed" ${registration.status === 'confirmed' ? 'selected' : ''}>Confirmed</option>
                    <option value="cancelled" ${registration.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                    <option value="waitlist" ${registration.status === 'waitlist' ? 'selected' : ''}>Waitlist</option>
                </select>
            </td>
            <td>
                <select class="registration-payment-select ${getPaymentClass(registration.paymentStatus)}" onchange="updatePaymentStatus('${registration._id}', this.value)">
                    <option value="unpaid" ${registration.paymentStatus === 'unpaid' ? 'selected' : ''}>Unpaid</option>
                    <option value="deposit" ${registration.paymentStatus === 'deposit' ? 'selected' : ''}>Deposit</option>
                    <option value="paid" ${registration.paymentStatus === 'paid' ? 'selected' : ''}>Paid</option>
                </select>
            </td>
            <td><span class="registration-date">${new Date(registration.registeredAt).toLocaleDateString()}</span></td>
            <td><button class="btn-delete" onclick="deleteRegistration('${registration._id}')">Delete</button></td>
        </tr>
    `;
}

function renderRegistrationCard(registration, tournamentsById) {
    const squadNames = getSquadNames(registration, tournamentsById);

    return `
        <article class="registration-card">
            <div class="registration-card-header">
                <div class="registration-player">
                    <strong>${registration.playerName}</strong>
                    ${renderGenderBadge(registration.gender)}
                    ${registration.averageScore ? `<span class="registration-meta">Average: ${registration.averageScore}</span>` : ''}
                </div>
                <span class="registration-date">${new Date(registration.registeredAt).toLocaleDateString()}</span>
            </div>
            <div class="registration-card-row">
                <span class="registration-card-label">Tournament</span>
                <span class="registration-card-value">${registration.tournament?.name || 'N/A'}</span>
            </div>
            <div class="registration-card-row">
                <span class="registration-card-label">Squads</span>
                <span class="registration-card-value">${squadNames.length ? squadNames.join(', ') : 'None assigned'}</span>
            </div>
            <div class="registration-card-row">
                <span class="registration-card-label">Contact</span>
                <span class="registration-card-value">${registration.email}<br>${registration.phone}</span>
            </div>
            <div class="registration-card-row">
                <span class="registration-card-label">Status</span>
                <select class="registration-status-select" onchange="updateRegistrationStatus('${registration._id}', this.value)">
                    <option value="pending" ${registration.status === 'pending' ? 'selected' : ''}>Pending</option>
                    <option value="confirmed" ${registration.status === 'confirmed' ? 'selected' : ''}>Confirmed</option>
                    <option value="cancelled" ${registration.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                    <option value="waitlist" ${registration.status === 'waitlist' ? 'selected' : ''}>Waitlist</option>
                </select>
            </div>
            <div class="registration-card-row">
                <span class="registration-card-label">Payment</span>
                <select class="registration-payment-select ${getPaymentClass(registration.paymentStatus)}" onchange="updatePaymentStatus('${registration._id}', this.value)">
                    <option value="unpaid" ${registration.paymentStatus === 'unpaid' ? 'selected' : ''}>Unpaid</option>
                    <option value="deposit" ${registration.paymentStatus === 'deposit' ? 'selected' : ''}>Deposit</option>
                    <option value="paid" ${registration.paymentStatus === 'paid' ? 'selected' : ''}>Paid</option>
                </select>
            </div>
            <div class="registration-card-actions">
                <button class="btn-delete" onclick="deleteRegistration('${registration._id}')">Delete</button>
            </div>
        </article>
    `;
}

async function updateRegistrationStatus(id, status) {
    try {
        await ensureCsrfToken();
        const response = await fetch(`/api/registrations/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken
            },
            credentials: 'same-origin',
            body: JSON.stringify({ status })
        });

        if (!response.ok) {
            alert('Failed to update status');
            loadRegistrations();
        }
    } catch (error) {
        alert(`Error: ${error.message}`);
        loadRegistrations();
    }
}

async function updatePaymentStatus(id, paymentStatus) {
    try {
        await ensureCsrfToken();
        const response = await fetch(`/api/registrations/${id}/payment-status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken
            },
            credentials: 'same-origin',
            body: JSON.stringify({ paymentStatus })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            alert(`Failed to update payment status: ${errorData.error || response.status}`);
            loadRegistrations();
        }
    } catch (error) {
        alert(`Error: ${error.message}`);
        loadRegistrations();
    }
}

window.updatePaymentStatus = updatePaymentStatus;

async function deleteRegistration(id) {
    if (!confirm('Are you sure you want to delete this registration?')) return;

    try {
        await ensureCsrfToken();
        const response = await fetch(`/api/registrations/${id}`, {
            method: 'DELETE',
            headers: { 'X-CSRF-Token': csrfToken },
            credentials: 'same-origin'
        });

        if (response.ok) {
            loadRegistrations();
        } else {
            alert('Failed to delete registration');
        }
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
}

async function exportRegistrations() {
    try {
        const tournamentId = regFilterSelect.value;
        const url = tournamentId ? `/api/registrations?tournamentId=${tournamentId}` : '/api/registrations';

        const response = await fetch(url);
        const registrations = await response.json();

        if (registrations.length === 0) {
            alert('No registrations to export');
            return;
        }

        const tournamentsRes = await fetch('/api/tournaments');
        const tournaments = await tournamentsRes.json();
        const tournamentsById = {};
        tournaments.forEach((tournament) => {
            tournamentsById[tournament._id] = tournament;
        });

        const headers = ['Player Name', 'Email', 'Phone', 'Tournament', 'Squads', 'Average Score', 'Status', 'Notes', 'Registered Date'];
        const rows = registrations.map((registration) => [
            registration.playerName,
            registration.email,
            registration.phone,
            registration.tournament?.name || '',
            getSquadNames(registration, tournamentsById).join('; '),
            registration.averageScore || '',
            registration.status,
            registration.notes || '',
            new Date(registration.registeredAt).toLocaleDateString()
        ]);

        const csvContent = [headers, ...rows]
            .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
            .join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = `registrations-${tournamentId ? regFilterSelect.options[regFilterSelect.selectedIndex].text.replace(/[^a-z0-9]/gi, '_') : 'all'}-${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
        alert(`Failed to export: ${error.message}`);
    }
}
