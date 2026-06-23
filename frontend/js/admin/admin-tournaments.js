// Helper function to escape HTML and prevent XSS
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// CSRF token for secure requests
let csrfToken = null;

const form = document.getElementById('tournamentForm');
const listContainer = document.getElementById('tournamentList');
const regListContainer = document.getElementById('registrationList');
const regFilterSelect = document.getElementById('regTournamentFilter');
const regCountSpan = document.getElementById('regCount');
const resultsTournamentFilter = document.getElementById('resultsTournamentFilter');

let currentSquads = [];
let currentStages = [];
let currentTournamentForResults = null;
let loadedTournaments = [];
let currentCalendarDate = new Date();
let editingStageIndex = null;

const calendarGrid = document.getElementById('calendarGrid');
const calendarMonthLabel = document.getElementById('calendarMonthLabel');
const calendarPrevBtn = document.getElementById('calendarPrevBtn');
const calendarNextBtn = document.getElementById('calendarNextBtn');
const calendarTodayBtn = document.getElementById('calendarTodayBtn');
const editOnlySection = document.getElementById('editOnlySection');
const createModeHint = document.getElementById('createModeHint');
const advancedEditorWrap = document.getElementById('advancedEditorWrap');
const quickAddModal = document.getElementById('quickAddModal');
const quickAddForm = document.getElementById('quickAddForm');
const hideEditorBtn = document.getElementById('hideEditorBtn');
const editorDrawerBackdrop = document.getElementById('editorDrawerBackdrop');
const stageTypeSelect = document.getElementById('stageType');
const addStageBtn = document.getElementById('addStageBtn');
const resetStageBuilderBtn = document.getElementById('resetStageBuilderBtn');
let selectedTournamentId = null;

const STAGE_TYPE_LABELS = {
    qualifying: 'Qualifying',
    round_robin: 'Round Robin Matchplay',
    tri_matchplay: 'Tri Matchplay',
    elimination: 'Elimination',
    stepladder: 'Stepladder'
};

const MATCH_FORMAT_LABELS = {
    'single-game': 'Single Game',
    'best-of-3': 'Best of 3',
    'best-of-5': 'Best of 5',
    'total-pinfall-2': 'Total Pinfall (2 Games)',
    'total-pinfall-3': 'Total Pinfall (3 Games)'
};

const MATCH_STAGE_TYPES = new Set(['round_robin', 'tri_matchplay', 'elimination', 'stepladder']);

function generateStageKey() {
    return `stage_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// Load tournaments on page load
loadTournaments();
if (regListContainer) {
    loadRegistrations();
}
renderSquadsList(); // Initialize empty squad list
initializeCustomStageBuilder();
updateFormModeUI(false);

if (hideEditorBtn) {
    hideEditorBtn.addEventListener('click', closeEditorDrawer);
}

if (editorDrawerBackdrop) {
    editorDrawerBackdrop.addEventListener('click', closeEditorDrawer);
}

if (quickAddForm) {
    quickAddForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await createTournamentFromCalendar();
    });
}

if (calendarPrevBtn) {
    calendarPrevBtn.addEventListener('click', (event) => navigateCalendarMonth(-1, event));
}

if (calendarNextBtn) {
    calendarNextBtn.addEventListener('click', (event) => navigateCalendarMonth(1, event));
}

if (calendarTodayBtn) {
    calendarTodayBtn.addEventListener('click', (event) => jumpCalendarToToday(event));
}

if (stageTypeSelect) {
    stageTypeSelect.addEventListener('change', syncStageTypeFields);
}

if (addStageBtn) {
    addStageBtn.addEventListener('click', handleStageSave);
}

if (resetStageBuilderBtn) {
    resetStageBuilderBtn.addEventListener('click', resetStageBuilder);
}

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && advancedEditorWrap?.classList.contains('is-open')) {
        closeEditorDrawer();
    }
});

function toDateOnlyKey(value) {
    if (typeof value === 'string') {
        const isoMatch = value.match(/^(\d{4}-\d{2}-\d{2})/);
        if (isoMatch) return isoMatch[1];
    }
    const d = new Date(value);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatSquadTime(timeValue) {
    if (!timeValue) return '';
    const [hours, minutes] = String(timeValue).split(':').map(Number);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return timeValue;
    const isPm = hours >= 12;
    const h = hours % 12 || 12;
    return `${h}:${String(minutes).padStart(2, '0')} ${isPm ? 'PM' : 'AM'}`;
}

function updateFormModeUI(isEditing) {
    if (advancedEditorWrap) {
        advancedEditorWrap.classList.toggle('is-open', isEditing);
        advancedEditorWrap.setAttribute('aria-hidden', isEditing ? 'false' : 'true');
    }
    document.body.classList.toggle('admin-drawer-open', isEditing);
    if (editOnlySection) {
        editOnlySection.style.display = isEditing ? 'block' : 'none';
    }
    if (createModeHint) {
        createModeHint.style.display = isEditing ? 'none' : 'block';
    }
}

function closeEditorDrawer() {
    updateFormModeUI(false);
}

function navigateCalendarMonth(offset, event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    currentCalendarDate = new Date(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth() + offset, 1);
    renderTournamentCalendar(loadedTournaments);
}

function jumpCalendarToToday(event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    currentCalendarDate = new Date();
    renderTournamentCalendar(loadedTournaments);
}

function beginCreateFromDate(dateKey) {
    openQuickAddModal(dateKey);
}

function openQuickAddModal(dateKey) {
    if (!quickAddModal) return;
    const startEl = document.getElementById('quickAddStartDate');
    const endEl = document.getElementById('quickAddEndDate');
    if (startEl) startEl.value = dateKey;
    if (endEl) endEl.value = dateKey;
    quickAddModal.style.display = 'block';
    const nameEl = document.getElementById('quickAddName');
    if (nameEl) nameEl.focus();
}

function closeQuickAddModal() {
    if (!quickAddModal) return;
    quickAddModal.style.display = 'none';
    if (quickAddForm) quickAddForm.reset();
}

async function createTournamentFromCalendar() {
    try {
        const payload = {
            name: document.getElementById('quickAddName').value,
            location: document.getElementById('quickAddLocation').value,
            startDate: document.getElementById('quickAddStartDate').value,
            endDate: document.getElementById('quickAddEndDate').value,
            status: document.getElementById('quickAddStatus').value,
            maxParticipants: document.getElementById('quickAddMaxParticipants').value ? Number(document.getElementById('quickAddMaxParticipants').value) : null,
            description: document.getElementById('quickAddDescription').value || ''
        };

        const response = await fetch('/api/tournaments', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken
            },
            credentials: 'same-origin',
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to create tournament');
        }

        closeQuickAddModal();
        await loadTournaments();
    } catch (error) {
        alert('Failed to create tournament: ' + error.message);
    }
}

function selectTournament(id, openEditor = false) {
    selectedTournamentId = id;
    renderTournamentCalendar(loadedTournaments);

    if (openEditor) {
        editTournament(id);
    }
}

function renderTournamentCalendar(tournaments) {
    if (!calendarGrid || !calendarMonthLabel) return;

    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const monthStartDay = firstOfMonth.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();
    const todayKey = toDateOnlyKey(new Date());

    calendarMonthLabel.textContent = firstOfMonth.toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric'
    });

    const headers = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
        .map(day => `<div class="calendar-head">${day}</div>`)
        .join('');

    let dayCells = '';

    const totalVisibleCells = Math.ceil((monthStartDay + daysInMonth) / 7) * 7;
    for (let i = 0; i < totalVisibleCells; i++) {
        let dayNumber;
        let cellDate;
        let isOtherMonth = false;

        if (i < monthStartDay) {
            dayNumber = prevMonthDays - monthStartDay + i + 1;
            cellDate = new Date(year, month - 1, dayNumber);
            isOtherMonth = true;
        } else if (i >= monthStartDay + daysInMonth) {
            dayNumber = i - (monthStartDay + daysInMonth) + 1;
            cellDate = new Date(year, month + 1, dayNumber);
            isOtherMonth = true;
        } else {
            dayNumber = i - monthStartDay + 1;
            cellDate = new Date(year, month, dayNumber);
        }

        const dateKey = toDateOnlyKey(cellDate);
        const isToday = dateKey === todayKey;

        const tournamentsForDay = tournaments.filter(t => {
            if (!t.startDate && !t.date) return false;
            const start = toDateOnlyKey(t.startDate || t.date);
            const end = toDateOnlyKey(t.endDate || t.startDate || t.date);
            const inDateRange = dateKey >= start && dateKey <= end;
            const hasSquadOnDay = (t.squads || []).some(s => s.date && toDateOnlyKey(s.date) === dateKey);
            return inDateRange || hasSquadOnDay;
        });

        const chips = tournamentsForDay.slice(0, 2).map(t => {
            const isSelected = t._id === selectedTournamentId;
            const squadTimes = (t.squads || [])
                .filter(s => s.date && toDateOnlyKey(s.date) === dateKey)
                .slice(0, 2)
                .map(s => `<div class="calendar-squad-time">${escapeHtml(s.name || 'Squad')} • ${escapeHtml(formatSquadTime(s.time || ''))}</div>`)
                .join('');

            return `
                <div class="calendar-tournament-chip" style="${isSelected ? 'border-color:#b3361f;background:#f6e2d7' : ''}">
                    <button type="button" onclick="event.stopPropagation(); selectTournament('${t._id}', true)">${escapeHtml(t.name)}</button>
                    ${squadTimes}
                </div>
            `;
        }).join('');

        const extraCount = tournamentsForDay.length - 2;
        const moreLabel = extraCount > 0 ? `<div class="calendar-more">+${extraCount} more</div>` : '';

        dayCells += `
            <div class="calendar-day ${isOtherMonth ? 'is-other-month' : ''} ${isToday ? 'is-today' : ''}" onclick="beginCreateFromDate('${dateKey}')">
                <div class="calendar-day-number">${dayNumber}</div>
                ${chips}
                ${moreLabel}
            </div>
        `;
    }

    calendarGrid.innerHTML = headers + dayCells;
}

// Auto-fill squad date from tournament start date
document.getElementById('startDate').addEventListener('change', (e) => {
    const squadDateInput = document.getElementById('squadDate');
    if (!squadDateInput.value) {
        squadDateInput.value = e.target.value;
    }
});

// Toggle options based on checkboxes
document.getElementById('useHandicap').addEventListener('change', (e) => {
    document.getElementById('handicapOptions').style.display = e.target.checked ? 'grid' : 'none';
});

document.getElementById('bonusPointsEnabled').addEventListener('change', (e) => {
    document.getElementById('bonusPointsOptions').style.display = e.target.checked ? 'grid' : 'none';
});

// Handle form submission
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const editingId = document.getElementById('editingTournamentId').value;
    if (!editingId) {
        alert('Please select a tournament from the calendar before editing.');
        return;
    }

    const normalizedStages = currentStages.map((stage, index) => normalizeStage(stage, index));
    const totalGames = normalizedStages.length > 0
        ? normalizedStages.reduce((sum, stage) => sum + stage.games, 0)
        : 6;
    const defaultMatchPlayStage = normalizedStages.find((stage) => MATCH_STAGE_TYPES.has(stage.type));
    const defaultMatchPlay = getMatchPlayDefaults(defaultMatchPlayStage || {});

    const formData = {
        name: form.name.value,
        startDate: form.startDate.value,
        endDate: form.endDate.value,
        location: form.location.value,
        status: form.status.value,
        description: form.description.value,
        entryFee: form.entryFee.value ? Number(form.entryFee.value) : 0,
        paymentInstructions: form.paymentInstructions.value || '',
        maxParticipants: form.maxParticipants.value ? Number(form.maxParticipants.value) : null,
        registrationOpenDate: form.registrationOpenDate.value || null,
        registrationDeadline: form.registrationDeadline.value || null,
        squadsRequiredToQualify: form.squadsRequiredToQualify.value ? Number(form.squadsRequiredToQualify.value) : 1,
        allowReentry: document.getElementById('allowReentry').checked,
        squads: currentSquads.map(s => {
            const squad = {
                name: s.name,
                date: s.date,
                time: s.time,
                capacity: s.capacity,
                isQualifying: s.isQualifying,
                stageKey: s.stageKey || null,
                stageName: s.stageName || '',
                stageType: s.stageType || (s.isQualifying ? 'qualifying' : '')
            };
            if (s._id && s._id.length === 24 && /^[0-9a-fA-F]{24}$/.test(s._id)) {
                squad._id = s._id;
            }
            return squad;
        }),
        format: {
            gamesPerBowler: totalGames,
            hasStages: normalizedStages.length > 0,
            stages: normalizedStages,
            useHandicap: document.getElementById('useHandicap').checked,
            handicapBase: Number(document.getElementById('handicapBase').value) || 200,
            handicapPercentage: Number(document.getElementById('handicapPercentage').value) || 90,
            separateDivisions: document.getElementById('separateDivisions').checked,
            femaleHandicapPins: Number(document.getElementById('femaleHandicapPins').value) || 8,
            bonusPoints: {
                enabled: document.getElementById('bonusPointsEnabled').checked,
                perGame: Number(document.getElementById('bonusPerGame').value) || 0,
                perSeries: Number(document.getElementById('bonusPerSeries').value) || 0
            },
            scoringMethod: 'total-pinfall',
            matchPlay: {
                pointsForWin: defaultMatchPlay.pointsForWin,
                pointsForTie: defaultMatchPlay.pointsForTie,
                pointsForLoss: defaultMatchPlay.pointsForLoss,
                includePinfall: defaultMatchPlay.includePinfall
            }
        }
    };

    try {
        const response = await fetch(`/api/tournaments/${editingId}`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken
            },
            credentials: 'same-origin',
            body: JSON.stringify(formData)
        });

        if (response.ok) {
            await loadTournaments();
            selectTournament(editingId);
            alert('Tournament updated successfully!');
        } else {
            const error = await response.json();
            alert('Error: ' + error.error + '\n\nYour form data has been preserved.');
        }
    } catch (error) {
        alert('Failed to save tournament: ' + error.message + '\n\nYour form data has been preserved.');
        // Don't reset form - keep user's data
    }
});

// Squad management functions
let editingSquadIndex = null;

function addSquad() {
    const name = document.getElementById('squadName').value;
    const selectedStageKey = document.getElementById('squadStageKey').value;
    const date = document.getElementById('squadDate').value;
    const time = document.getElementById('squadTime').value;
    const capacity = document.getElementById('squadCapacity').value;

    if (!name || !date || !time || !capacity) {
        alert('Please fill in all squad fields');
        return;
    }

    const linkedStage = currentStages.find((stage, index) => normalizeStage(stage, index).key === selectedStageKey);
    const squadData = {
        name,
        date,
        time,
        capacity: Number(capacity),
        isQualifying: !selectedStageKey,
        stageKey: selectedStageKey || null,
        stageName: linkedStage ? linkedStage.name : '',
        stageType: linkedStage ? linkedStage.type : 'qualifying'
    };

    if (editingSquadIndex !== null) {
        // Update existing squad
        currentSquads[editingSquadIndex] = {
            ...currentSquads[editingSquadIndex],
            ...squadData
        };
        editingSquadIndex = null;
        document.querySelector('#squadsList ~ div button[onclick="addSquad()"]').textContent = 'Add Squad';
    } else {
        // Add new squad
        squadData._id = Date.now().toString(); // Temporary ID for new squads
        currentSquads.push(squadData);
    }

    // Clear inputs
    document.getElementById('squadName').value = '';
    document.getElementById('squadStageKey').value = '';
    document.getElementById('squadDate').value = '';
    document.getElementById('squadTime').value = '';
    document.getElementById('squadCapacity').value = '';

    renderSquadsList();
}

// Tournament preset configurations
function applyTournamentPreset() {
    const type = document.getElementById('tournamentType').value;
    const descriptions = {
        'custom': 'Build your own tournament with custom stages'
    };

    document.getElementById('typeDescription').textContent = descriptions[type] || '';
    
    // Force custom builder mode and keep existing stages untouched.
    if (type !== 'custom') {
        document.getElementById('tournamentType').value = 'custom';
    }
    document.getElementById('customStagesSection').style.display = 'block';
    const quickSettings = document.getElementById('quickSettings');
    if (quickSettings) quickSettings.style.display = 'none';
    const multiBlockSettings = document.getElementById('multiBlockSettings');
    if (multiBlockSettings) multiBlockSettings.style.display = 'none';
    document.getElementById('matchPlaySettings').style.display = 'none';
    document.getElementById('formatSummary').style.display = 'block';

    renderStagesList();
    updateFormatSummary();
}

function applySingleBlockPreset() {
    const games = document.getElementById('qualifyingGames')?.value || 6;
    currentStages = [{
        name: 'Qualifying',
        games: Number(games),
        advancingBowlers: null,
        carryoverPinfall: false,
        carryoverPercentage: 0
    }];
    updateFormatSummary();
}

function applyMultiBlockPreset() {
    const qualGames = Number(document.getElementById('qualifyingGamesMulti')?.value) || Number(document.getElementById('qualifyingGames')?.value) || 6;
    const numBlocks = Number(document.getElementById('numberOfBlocks')?.value) || 3;
    
    currentStages = [];
    for (let i = 1; i <= numBlocks; i++) {
        currentStages.push({
            name: `Block ${i}`,
            games: qualGames,
            advancingBowlers: null,
            carryoverPinfall: true,
            carryoverPercentage: 100
        });
    }
    updateFormatSummary();
}

function applyTripleCrownPreset() {
    const qualGames = Number(document.getElementById('qualifyingGames')?.value) || 6;
    const advancing = Number(document.getElementById('advancingBowlers')?.value) || 24;
    const finalsGames = Number(document.getElementById('finalsGames')?.value) || 6;

    currentStages = [
        {
            name: 'Qualifying',
            games: qualGames,
            advancingBowlers: advancing,
            carryoverPinfall: false,
            carryoverPercentage: 0
        },
        {
            name: 'Semifinals',
            games: finalsGames,
            advancingBowlers: Math.floor(advancing / 2),
            carryoverPinfall: true,
            carryoverPercentage: 100
        },
        {
            name: 'Finals',
            games: finalsGames,
            advancingBowlers: null,
            carryoverPinfall: true,
            carryoverPercentage: 100
        }
    ];
    updateFormatSummary();
}

function applyRoundRobinPreset() {
    const qualGames = Number(document.getElementById('qualifyingGames')?.value) || 6;
    const advancing = Number(document.getElementById('advancingBowlers')?.value) || 16;
    const format = document.getElementById('matchPlayFormat')?.value || 'single-game';
    const formatGames = {
        'best-of-3': 3,
        'best-of-5': 5,
        'single-game': 1,
        'total-pinfall-2': 2,
        'total-pinfall-3': 3
    };

    // For round robin: n-1 matches per player
    const matchesPerPlayer = advancing - 1;

    currentStages = [
        {
            name: 'Qualifying',
            games: qualGames,
            advancingBowlers: advancing,
            carryoverPinfall: false,
            carryoverPercentage: 0
        },
        {
            name: `Round Robin (${matchesPerPlayer} matches per player)`,
            games: formatGames[format] || 1,
            advancingBowlers: null,
            carryoverPinfall: false,
            carryoverPercentage: 0
        }
    ];
    updateFormatSummary();
}

function applySingleEliminationPreset() {
    const qualGames = Number(document.getElementById('qualifyingGames')?.value) || 6;
    const advancing = Number(document.getElementById('advancingBowlers')?.value) || 16;
    const format = document.getElementById('matchPlayFormat')?.value || 'single-game';
    const formatGames = {
        'best-of-3': 3,
        'best-of-5': 5,
        'single-game': 1,
        'total-pinfall-2': 2,
        'total-pinfall-3': 3
    };

    currentStages = [
        {
            name: 'Qualifying',
            games: qualGames,
            advancingBowlers: advancing,
            carryoverPinfall: false,
            carryoverPercentage: 0
        },
        {
            name: 'Round of 16',
            games: formatGames[format] || 1,
            advancingBowlers: 8,
            carryoverPinfall: false,
            carryoverPercentage: 0
        },
        {
            name: 'Quarterfinals',
            games: formatGames[format] || 1,
            advancingBowlers: 4,
            carryoverPinfall: false,
            carryoverPercentage: 0
        },
        {
            name: 'Semifinals',
            games: formatGames[format] || 1,
            advancingBowlers: 2,
            carryoverPinfall: false,
            carryoverPercentage: 0
        },
        {
            name: 'Championship',
            games: formatGames[format] || 1,
            advancingBowlers: 1,
            carryoverPinfall: false,
            carryoverPercentage: 0
        }
    ];
    updateFormatSummary();
}

function applyDoubleEliminationPreset() {
    const qualGames = Number(document.getElementById('qualifyingGames')?.value) || 6;
    const advancing = Math.max(8, Number(document.getElementById('advancingBowlers')?.value) || 8);
    const format = document.getElementById('matchPlayFormat')?.value || 'single-game';
    const formatGames = {
        'best-of-3': 3,
        'best-of-5': 5,
        'single-game': 1,
        'total-pinfall-2': 2,
        'total-pinfall-3': 3
    };

    currentStages = [
        {
            name: 'Qualifying',
            games: qualGames,
            advancingBowlers: advancing,
            carryoverPinfall: false,
            carryoverPercentage: 0
        },
        {
            name: 'Winners Round 1 (4 matches)',
            games: formatGames[format] || 1,
            advancingBowlers: 4,
            carryoverPinfall: false,
            carryoverPercentage: 0
        },
        {
            name: 'Losers Round 1 (2 matches)',
            games: formatGames[format] || 1,
            advancingBowlers: 2,
            carryoverPinfall: false,
            carryoverPercentage: 0
        },
        {
            name: 'Winners Semifinals (2 matches)',
            games: formatGames[format] || 1,
            advancingBowlers: 2,
            carryoverPinfall: false,
            carryoverPercentage: 0
        },
        {
            name: 'Losers Round 2 (2 matches)',
            games: formatGames[format] || 1,
            advancingBowlers: 2,
            carryoverPinfall: false,
            carryoverPercentage: 0
        },
        {
            name: 'Winners Final',
            games: formatGames[format] || 1,
            advancingBowlers: 1,
            carryoverPinfall: false,
            carryoverPercentage: 0
        },
        {
            name: 'Losers Final',
            games: formatGames[format] || 1,
            advancingBowlers: 1,
            carryoverPinfall: false,
            carryoverPercentage: 0
        },
        {
            name: 'Grand Final',
            games: formatGames[format] || 1,
            advancingBowlers: 1,
            carryoverPinfall: false,
            carryoverPercentage: 0
        }
    ];
    updateFormatSummary();
}

function applyExtendedStepladderPreset() {
    const qualGames = Number(document.getElementById('qualifyingGames')?.value) || 6;
    currentStages = [
        {
            name: 'Qualifying',
            games: qualGames,
            advancingBowlers: 8,
            carryoverPinfall: false,
            carryoverPercentage: 0
        },
        {
            name: '#8 vs #7',
            games: 1,
            advancingBowlers: 1,
            carryoverPinfall: false,
            carryoverPercentage: 0
        },
        {
            name: 'Winner vs #6',
            games: 1,
            advancingBowlers: 1,
            carryoverPinfall: false,
            carryoverPercentage: 0
        },
        {
            name: 'Winner vs #5',
            games: 1,
            advancingBowlers: 1,
            carryoverPinfall: false,
            carryoverPercentage: 0
        },
        {
            name: 'Winner vs #4',
            games: 1,
            advancingBowlers: 1,
            carryoverPinfall: false,
            carryoverPercentage: 0
        },
        {
            name: 'Winner vs #3',
            games: 1,
            advancingBowlers: 1,
            carryoverPinfall: false,
            carryoverPercentage: 0
        },
        {
            name: 'Winner vs #2',
            games: 1,
            advancingBowlers: 1,
            carryoverPinfall: false,
            carryoverPercentage: 0
        },
        {
            name: 'Championship (#1 vs Winner)',
            games: 1,
            advancingBowlers: 1,
            carryoverPinfall: false,
            carryoverPercentage: 0
        }
    ];
    updateFormatSummary();
}

function applyTeamBakerPreset() {
    const qualGames = Number(document.getElementById('qualifyingGames')?.value) || 6;
    currentStages = [
        {
            name: 'Baker Qualifying',
            games: qualGames,
            advancingBowlers: null,
            carryoverPinfall: false,
            carryoverPercentage: 0
        }
    ];
    updateFormatSummary();
}

function applyQualifyingFinalsPreset() {
    const qualGames = Number(document.getElementById('qualifyingGames')?.value) || 6;
    const advancing = Number(document.getElementById('advancingBowlers')?.value) || 16;
    const finalsGames = Number(document.getElementById('finalsGames')?.value) || 6;

    currentStages = [
        {
            name: 'Qualifying',
            games: qualGames,
            advancingBowlers: advancing,
            carryoverPinfall: false,
            carryoverPercentage: 0
        },
        {
            name: 'Finals',
            games: finalsGames,
            advancingBowlers: null,
            carryoverPinfall: true,
            carryoverPercentage: 100
        }
    ];
    updateFormatSummary();
}

function applyMatchPlayPreset() {
    const qualGames = Number(document.getElementById('qualifyingGames')?.value) || 6;
    const advancing = Number(document.getElementById('advancingBowlers')?.value) || 16;
    const format = document.getElementById('matchPlayFormat')?.value || 'best-of-3';
    const formatGames = {
        'best-of-3': 3,
        'best-of-5': 5,
        'single-game': 1,
        'total-pinfall-2': 2,
        'total-pinfall-3': 3
    };

    // For match play: n-1 matches per player
    const matchesPerPlayer = advancing - 1;

    currentStages = [
        {
            name: 'Qualifying',
            games: qualGames,
            advancingBowlers: advancing,
            carryoverPinfall: false,
            carryoverPercentage: 0
        },
        {
            name: `Match Play (${matchesPerPlayer} matches per player)`,
            games: formatGames[format] || 3,
            advancingBowlers: null,
            carryoverPinfall: false,
            carryoverPercentage: 0
        }
    ];
    updateFormatSummary();
}

function applyStepladderPreset() {
    const qualGames = Number(document.getElementById('qualifyingGames')?.value) || 6;
    currentStages = [
        {
            name: 'Qualifying',
            games: qualGames,
            advancingBowlers: 5,
            carryoverPinfall: false,
            carryoverPercentage: 0
        },
        {
            name: '#5 vs #4',
            games: 1,
            advancingBowlers: 1,
            carryoverPinfall: false,
            carryoverPercentage: 0
        },
        {
            name: 'Winner vs #3',
            games: 1,
            advancingBowlers: 1,
            carryoverPinfall: false,
            carryoverPercentage: 0
        },
        {
            name: 'Winner vs #2',
            games: 1,
            advancingBowlers: 1,
            carryoverPinfall: false,
            carryoverPercentage: 0
        },
        {
            name: 'Championship (#1 vs Winner)',
            games: 1,
            advancingBowlers: 1,
            carryoverPinfall: false,
            carryoverPercentage: 0
        }
    ];
    updateFormatSummary();
}

function applyFullTournamentPreset() {
    const qualGames = Number(document.getElementById('qualifyingGames')?.value) || 6;
    const advancing = Number(document.getElementById('advancingBowlers')?.value) || 16;
    const finalsGames = Number(document.getElementById('finalsGames')?.value) || 6;
    const format = document.getElementById('matchPlayFormat')?.value || 'best-of-3';
    const formatGames = {
        'best-of-3': 3,
        'best-of-5': 5,
        'single-game': 1,
        'total-pinfall-2': 2,
        'total-pinfall-3': 3
    };

    // For round robin: 8 players = 7 matches per player
    const roundRobinPlayers = 8;
    const matchesPerPlayer = roundRobinPlayers - 1;

    currentStages = [
        {
            name: 'Qualifying',
            games: qualGames,
            advancingBowlers: advancing,
            carryoverPinfall: false,
            carryoverPercentage: 0
        },
        {
            name: 'Finals',
            games: finalsGames,
            advancingBowlers: roundRobinPlayers,
            carryoverPinfall: true,
            carryoverPercentage: 100
        },
        {
            name: `Round Robin (${matchesPerPlayer} matches per player)`,
            games: formatGames[format] || 1,
            advancingBowlers: 5,
            carryoverPinfall: false,
            carryoverPercentage: 0
        },
        {
            name: '#5 vs #4',
            games: 1,
            advancingBowlers: 1,
            carryoverPinfall: false,
            carryoverPercentage: 0
        },
        {
            name: 'Winner vs #3',
            games: 1,
            advancingBowlers: 1,
            carryoverPinfall: false,
            carryoverPercentage: 0
        },
        {
            name: 'Winner vs #2',
            games: 1,
            advancingBowlers: 1,
            carryoverPinfall: false,
            carryoverPercentage: 0
        },
        {
            name: 'Championship (#1 vs Winner)',
            games: 1,
            advancingBowlers: 1,
            carryoverPinfall: false,
            carryoverPercentage: 0
        }
    ];
    updateFormatSummary();
}

function updateFormatSummary() {
    const content = document.getElementById('formatSummaryContent');
    if (currentStages.length === 0) {
        content.innerHTML = '<p style="color:#888">No stages configured</p>';
        return;
    }

    const summary = currentStages.map((stage, i) => 
        `<div style="margin-bottom:6px">
            <strong>Stage ${i + 1}:</strong> ${escapeHtml(stage.name)} (${parseInt(stage.games)} games)
            ${stage.advancingBowlers ? ` → Top ${parseInt(stage.advancingBowlers)} advance` : ''}
            ${stage.carryoverPinfall ? ` with ${parseInt(stage.carryoverPercentage)}% carryover` : ''}
        </div>`
    ).join('');

    content.innerHTML = summary;
}

function updateMatchPlayDetails() {
    const format = document.getElementById('matchPlayFormat').value;
    const descriptions = {
        'best-of-3': 'Best of 3 games - first to win 2 games advances',
        'best-of-5': 'Best of 5 games - first to win 3 games advances',
        'single-game': 'Single elimination - higher score advances',
        'total-pinfall-2': 'Total pinfall across 2 games - higher total advances',
        'total-pinfall-3': 'Total pinfall across 3 games - higher total advances'
    };

    // Update preset if format requires match play configuration
    const type = document.getElementById('tournamentType').value;
    const matchPlayTypes = ['match-play', 'round-robin', 'bracket-single', 'bracket-double', 'full-tournament'];
    
    if (matchPlayTypes.includes(type)) {
        applyTournamentPreset();
    }
}

function addStage() {
    const name = document.getElementById('stageName').value;
    const games = document.getElementById('stageGames').value;
    const advancing = document.getElementById('stageAdvancing').value;
    const carryover = document.getElementById('stageCarryover').checked;
    const carryoverPct = document.getElementById('stageCarryoverPct').value;

    if (!name || !games) {
        alert('Please fill in stage name and games');
        return;
    }

    currentStages.push({
        name,
        games: Number(games),
        advancingBowlers: advancing ? Number(advancing) : null,
        carryoverPinfall: carryover,
        carryoverPercentage: Number(carryoverPct) || 100
    });

    // Clear inputs
    document.getElementById('stageName').value = '';
    document.getElementById('stageGames').value = '6';
    document.getElementById('stageAdvancing').value = '';
    document.getElementById('stageCarryover').checked = true;
    document.getElementById('stageCarryoverPct').value = '100';

    renderStagesList();
    updateFormatSummary();
}

function removeStage(index) {
    currentStages.splice(index, 1);
    renderStagesList();
    updateFormatSummary();
}

function renderStagesList() {
    const container = document.getElementById('stagesList');
    if (currentStages.length === 0) {
        container.innerHTML = '<p style="color:#888;text-align:center;padding:8px;font-size:.85rem">No stages added yet</p>';
        updateFormatSummary();
        return;
    }
    
    container.innerHTML = currentStages.map((stage, i) => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.05);border-radius:6px;gap:8px">
            <div style="flex:1">
                <strong>${escapeHtml(stage.name)}</strong> • ${parseInt(stage.games)} games
                ${stage.advancingBowlers ? ` • Top ${parseInt(stage.advancingBowlers)} advance` : ''}
                ${stage.carryoverPinfall ? ` • ${parseInt(stage.carryoverPercentage)}% carryover` : ''}
            </div>
            <div style="display:flex;gap:4px">
                <button onclick="editStage(${i})" class="button" style="padding:4px 8px;font-size:.75rem;background:var(--blue-600)">Edit</button>
                <button onclick="removeStage(${i})" class="button" style="padding:4px 8px;font-size:.75rem;background:#c92a2a">Remove</button>
            </div>
        </div>
    `).join('');

    updateFormatSummary();
}

function editStage(index) {
    const stage = currentStages[index];
    document.getElementById('stageName').value = stage.name;
    document.getElementById('stageGames').value = stage.games;
    document.getElementById('stageAdvancing').value = stage.advancingBowlers || '';
    document.getElementById('stageCarryover').checked = stage.carryoverPinfall;
    document.getElementById('stageCarryoverPct').value = stage.carryoverPercentage || 100;
    
    editingStageIndex = index;
    const addButton = document.querySelector('button[onclick="addStage()"]');
    addButton.textContent = 'Update Stage';
    addButton.onclick = function() { updateStage(); };
    
    // Scroll to stage form
    document.getElementById('stageName').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function updateStage() {
    const name = document.getElementById('stageName').value;
    const games = document.getElementById('stageGames').value;
    const advancing = document.getElementById('stageAdvancing').value;
    const carryover = document.getElementById('stageCarryover').checked;
    const carryoverPct = document.getElementById('stageCarryoverPct').value;

    if (!name || !games) {
        alert('Please fill in stage name and games');
        return;
    }

    currentStages[editingStageIndex] = {
        name,
        games: Number(games),
        advancingBowlers: advancing ? Number(advancing) : null,
        carryoverPinfall: carryover,
        carryoverPercentage: Number(carryoverPct) || 100
    };

    // Reset form
    document.getElementById('stageName').value = '';
    document.getElementById('stageGames').value = '6';
    document.getElementById('stageAdvancing').value = '';
    document.getElementById('stageCarryover').checked = true;
    document.getElementById('stageCarryoverPct').value = '100';
    
    editingStageIndex = null;
    const addButton = document.querySelector('button[onclick="updateStage()"]');
    addButton.textContent = '+ Add';
    addButton.onclick = function() { addStage(); };

    renderStagesList();
    updateFormatSummary();
}

function initializeCustomStageBuilder() {
    syncStageTypeFields();
    resetStageBuilder();
    renderCustomStagesList();
    populateSquadStageOptions();
}

function getDefaultStageName(type) {
    return STAGE_TYPE_LABELS[type] || 'Stage';
}

function getMatchPlayDefaults(stage = {}) {
    return {
        pointsForWin: Number(stage.matchPlaySettings?.pointsForWin ?? 30),
        pointsForTie: Number(stage.matchPlaySettings?.pointsForTie ?? 15),
        pointsForLoss: Number(stage.matchPlaySettings?.pointsForLoss ?? 0),
        includePinfall: stage.matchPlaySettings?.includePinfall !== false,
        matchFormat: stage.matchPlaySettings?.matchFormat || 'single-game'
    };
}

function inferStageType(name = '', index = 0) {
    const label = String(name).toLowerCase();
    if (label.includes('round robin')) return 'round_robin';
    if (label.includes('tri')) return 'tri_matchplay';
    if (label.includes('step')) return 'stepladder';
    if (label.includes('elimination') || label.includes('quarter') || label.includes('semi') || label.includes('championship') || label.includes('round of')) return 'elimination';
    if (label.includes('qual')) return 'qualifying';
    return index === 0 ? 'qualifying' : 'elimination';
}

function normalizeStage(stage, index = 0) {
    const inferredType = stage.type || inferStageType(stage.name, index);
    return {
        key: stage.key || generateStageKey(),
        type: inferredType,
        name: stage.name || getDefaultStageName(inferredType),
        description: stage.description || '',
        games: Number(stage.games) || 1,
        advancingBowlers: stage.advancingBowlers ? Number(stage.advancingBowlers) : null,
        carryoverPinfall: Boolean(stage.carryoverPinfall),
        carryoverPercentage: stage.carryoverPercentage === 0 ? 0 : (Number(stage.carryoverPercentage) || 100),
        matchPlaySettings: getMatchPlayDefaults(stage),
        stageConfig: {
            ...(stage.stageConfig || {})
        }
    };
}

function syncStageTypeFields() {
    const type = stageTypeSelect?.value || 'qualifying';
    document.querySelectorAll('[data-stage-type-fields]').forEach((section) => {
        section.hidden = section.dataset.stageTypeFields !== type;
    });
}

function populateSquadStageOptions(selectedKey = '') {
    const select = document.getElementById('squadStageKey');
    if (!select) return;

    const options = ['<option value="">Qualifying</option>'];
    currentStages.forEach((rawStage, index) => {
        const stage = normalizeStage(rawStage, index);
        currentStages[index] = stage;
        options.push(`<option value="${escapeHtml(stage.key)}">${escapeHtml(stage.name)} (${escapeHtml(STAGE_TYPE_LABELS[stage.type] || 'Stage')})</option>`);
    });

    select.innerHTML = options.join('');
    select.value = selectedKey || '';
}

function resetStageBuilder() {
    editingStageIndex = null;
    document.getElementById('stageBuilderTitle').textContent = 'Add Stage';
    document.getElementById('stageBuilderCopy').textContent = 'Create each phase manually so the tournament flow matches your event.';
    if (addStageBtn) addStageBtn.textContent = 'Add Stage';

    document.getElementById('stageName').value = '';
    document.getElementById('stageType').value = 'qualifying';
    document.getElementById('stageGames').value = '6';
    document.getElementById('stageAdvancing').value = '';
    document.getElementById('stageDescription').value = '';
    document.getElementById('stageCarryover').checked = false;
    document.getElementById('stageCarryoverPct').value = '100';
    document.getElementById('stageQualifyingSpots').value = '';
    document.getElementById('stageScoresToCount').value = '1';
    document.getElementById('stageQualifyingLabel').value = '';
    document.getElementById('stageMatchesPerBowler').value = '7';
    document.getElementById('stageMatchFormat').value = 'single-game';
    document.getElementById('stagePositionRoundInterval').value = '0';
    document.getElementById('stagePointsWin').value = '30';
    document.getElementById('stagePointsTie').value = '15';
    document.getElementById('stagePointsLoss').value = '0';
    document.getElementById('stageIncludePinfall').checked = true;
    document.getElementById('stageTriRounds').value = '8';
    document.getElementById('stageTriPointsWin').value = '30';
    document.getElementById('stageTriPointsMiddle').value = '15';
    document.getElementById('stageTriPointsLoss').value = '0';
    document.getElementById('stageTriIncludePinfall').checked = true;
    document.getElementById('stageEliminationStyle').value = 'single';
    document.getElementById('stageBracketSize').value = '8';
    document.getElementById('stageEliminationRounds').value = '3';
    document.getElementById('stageEliminationFormat').value = 'single-game';
    document.getElementById('stageStepladderFinalists').value = '5';
    document.getElementById('stageStepladderFormat').value = 'single-game';
    document.getElementById('stageStepladderSeedNote').value = '';
    syncStageTypeFields();
    populateSquadStageOptions(document.getElementById('squadStageKey')?.value || '');
}

function buildStageFromInputs() {
    const type = document.getElementById('stageType').value;
    const name = document.getElementById('stageName').value.trim() || getDefaultStageName(type);
    const games = Number(document.getElementById('stageGames').value);
    if (!games || games < 1) {
        throw new Error('Please enter a valid number of games for the stage.');
    }

    const stage = {
        type,
        name,
        description: document.getElementById('stageDescription').value.trim(),
        games,
        advancingBowlers: document.getElementById('stageAdvancing').value ? Number(document.getElementById('stageAdvancing').value) : null,
        carryoverPinfall: document.getElementById('stageCarryover').checked,
        carryoverPercentage: Number(document.getElementById('stageCarryoverPct').value) || 100,
        matchPlaySettings: getMatchPlayDefaults(),
        stageConfig: {}
    };

    if (type === 'qualifying') {
        stage.stageConfig = {
            qualifyingSpots: document.getElementById('stageQualifyingSpots').value ? Number(document.getElementById('stageQualifyingSpots').value) : null,
            scoresToCount: Number(document.getElementById('stageScoresToCount').value) || 1,
            cutLineLabel: document.getElementById('stageQualifyingLabel').value.trim()
        };
    } else if (type === 'round_robin') {
        stage.matchPlaySettings = {
            pointsForWin: Number(document.getElementById('stagePointsWin').value) || 30,
            pointsForTie: Number(document.getElementById('stagePointsTie').value) || 15,
            pointsForLoss: Number(document.getElementById('stagePointsLoss').value) || 0,
            includePinfall: document.getElementById('stageIncludePinfall').checked,
            matchFormat: document.getElementById('stageMatchFormat').value
        };
        stage.stageConfig = {
            matchesPerBowler: Number(document.getElementById('stageMatchesPerBowler').value) || 1,
            positionRoundInterval: Number(document.getElementById('stagePositionRoundInterval').value) || 0
        };
    } else if (type === 'tri_matchplay') {
        stage.matchPlaySettings = {
            pointsForWin: Number(document.getElementById('stageTriPointsWin').value) || 30,
            pointsForTie: Number(document.getElementById('stageTriPointsMiddle').value) || 15,
            pointsForLoss: Number(document.getElementById('stageTriPointsLoss').value) || 0,
            includePinfall: document.getElementById('stageTriIncludePinfall').checked,
            matchFormat: 'single-game'
        };
        stage.stageConfig = {
            triRounds: Number(document.getElementById('stageTriRounds').value) || games,
            groupSize: 3
        };
    } else if (type === 'elimination') {
        stage.matchPlaySettings = {
            ...getMatchPlayDefaults(),
            matchFormat: document.getElementById('stageEliminationFormat').value
        };
        stage.stageConfig = {
            eliminationStyle: document.getElementById('stageEliminationStyle').value,
            bracketSize: Number(document.getElementById('stageBracketSize').value) || 2,
            rounds: Number(document.getElementById('stageEliminationRounds').value) || 1
        };
    } else if (type === 'stepladder') {
        stage.matchPlaySettings = {
            ...getMatchPlayDefaults(),
            matchFormat: document.getElementById('stageStepladderFormat').value
        };
        stage.stageConfig = {
            finalists: Number(document.getElementById('stageStepladderFinalists').value) || 2,
            seedingNote: document.getElementById('stageStepladderSeedNote').value.trim()
        };
    }

    return stage;
}

function handleStageSave() {
    try {
        const stage = buildStageFromInputs();
        if (editingStageIndex === null) {
            currentStages.push(stage);
        } else {
            currentStages[editingStageIndex] = stage;
        }
        resetStageBuilder();
        renderCustomStagesList();
        populateSquadStageOptions();
    } catch (error) {
        alert(error.message);
    }
}

function editCustomStage(index) {
    const stage = normalizeStage(currentStages[index], index);
    editingStageIndex = index;
    document.getElementById('stageBuilderTitle').textContent = 'Edit Stage';
    document.getElementById('stageBuilderCopy').textContent = 'Adjust the stage settings, then save them back into the tournament flow.';
    if (addStageBtn) addStageBtn.textContent = 'Update Stage';

    document.getElementById('stageName').value = stage.name;
    document.getElementById('stageType').value = stage.type;
    document.getElementById('stageGames').value = stage.games;
    document.getElementById('stageAdvancing').value = stage.advancingBowlers || '';
    document.getElementById('stageDescription').value = stage.description || '';
    document.getElementById('stageCarryover').checked = stage.carryoverPinfall;
    document.getElementById('stageCarryoverPct').value = stage.carryoverPercentage || 100;
    document.getElementById('stageQualifyingSpots').value = stage.stageConfig?.qualifyingSpots || '';
    document.getElementById('stageScoresToCount').value = stage.stageConfig?.scoresToCount || 1;
    document.getElementById('stageQualifyingLabel').value = stage.stageConfig?.cutLineLabel || '';
    document.getElementById('stageMatchesPerBowler').value = stage.stageConfig?.matchesPerBowler || 7;
    document.getElementById('stageMatchFormat').value = stage.matchPlaySettings?.matchFormat || 'single-game';
    document.getElementById('stagePositionRoundInterval').value = stage.stageConfig?.positionRoundInterval || 0;
    document.getElementById('stagePointsWin').value = stage.matchPlaySettings?.pointsForWin ?? 30;
    document.getElementById('stagePointsTie').value = stage.matchPlaySettings?.pointsForTie ?? 15;
    document.getElementById('stagePointsLoss').value = stage.matchPlaySettings?.pointsForLoss ?? 0;
    document.getElementById('stageIncludePinfall').checked = stage.matchPlaySettings?.includePinfall !== false;
    document.getElementById('stageTriRounds').value = stage.stageConfig?.triRounds || 8;
    document.getElementById('stageTriPointsWin').value = stage.matchPlaySettings?.pointsForWin ?? 30;
    document.getElementById('stageTriPointsMiddle').value = stage.matchPlaySettings?.pointsForTie ?? 15;
    document.getElementById('stageTriPointsLoss').value = stage.matchPlaySettings?.pointsForLoss ?? 0;
    document.getElementById('stageTriIncludePinfall').checked = stage.matchPlaySettings?.includePinfall !== false;
    document.getElementById('stageEliminationStyle').value = stage.stageConfig?.eliminationStyle || 'single';
    document.getElementById('stageBracketSize').value = stage.stageConfig?.bracketSize || 8;
    document.getElementById('stageEliminationRounds').value = stage.stageConfig?.rounds || 3;
    document.getElementById('stageEliminationFormat').value = stage.matchPlaySettings?.matchFormat || 'single-game';
    document.getElementById('stageStepladderFinalists').value = stage.stageConfig?.finalists || 5;
    document.getElementById('stageStepladderFormat').value = stage.matchPlaySettings?.matchFormat || 'single-game';
    document.getElementById('stageStepladderSeedNote').value = stage.stageConfig?.seedingNote || '';
    syncStageTypeFields();
    document.getElementById('stageName').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function removeCustomStage(index) {
    currentStages.splice(index, 1);
    if (editingStageIndex === index) {
        resetStageBuilder();
    }
    renderCustomStagesList();
    populateSquadStageOptions();
}

function moveCustomStage(index, direction) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= currentStages.length) return;
    const [stage] = currentStages.splice(index, 1);
    currentStages.splice(targetIndex, 0, stage);
    renderCustomStagesList();
    populateSquadStageOptions();
}

function getStageSummary(stage) {
    const details = [`${stage.games} game${stage.games === 1 ? '' : 's'}`];
    if (stage.advancingBowlers) details.push(`Top ${stage.advancingBowlers} advance`);
    if (stage.carryoverPinfall) details.push(`${stage.carryoverPercentage}% carryover`);

    if (stage.type === 'round_robin') {
        details.push(`${stage.stageConfig?.matchesPerBowler || 1} matches each`);
        details.push(MATCH_FORMAT_LABELS[stage.matchPlaySettings?.matchFormat] || 'Single Game');
    } else if (stage.type === 'tri_matchplay') {
        details.push(`${stage.stageConfig?.triRounds || stage.games} tri rounds`);
    } else if (stage.type === 'elimination') {
        details.push(`${stage.stageConfig?.eliminationStyle || 'single'} elimination`);
        details.push(`Bracket ${stage.stageConfig?.bracketSize || 2}`);
    } else if (stage.type === 'stepladder') {
        details.push(`${stage.stageConfig?.finalists || 2} finalists`);
        details.push(MATCH_FORMAT_LABELS[stage.matchPlaySettings?.matchFormat] || 'Single Game');
    }

    return details.join(' • ');
}

function renderCustomStagesList() {
    const container = document.getElementById('stagesList');
    if (!container) return;

    if (currentStages.length === 0) {
        container.innerHTML = '<div class="stage-empty">No stages added yet. Start with qualifying, then stack any matchplay or finals phases underneath it.</div>';
        return;
    }

    container.innerHTML = currentStages.map((rawStage, index) => {
        const stage = normalizeStage(rawStage, index);
        const note = stage.description ? `<p class="stage-card-note">${escapeHtml(stage.description)}</p>` : '';
        return `
            <article class="stage-card">
                <div class="stage-card-top">
                    <div>
                        <div class="stage-card-order">Stage ${index + 1}</div>
                        <h5>${escapeHtml(stage.name)}</h5>
                        <p class="stage-card-type">${escapeHtml(STAGE_TYPE_LABELS[stage.type] || 'Stage')}</p>
                    </div>
                    <div class="stage-card-actions">
                        <button type="button" class="button button-subtle" onclick="moveCustomStage(${index}, -1)" ${index === 0 ? 'disabled' : ''}>Up</button>
                        <button type="button" class="button button-subtle" onclick="moveCustomStage(${index}, 1)" ${index === currentStages.length - 1 ? 'disabled' : ''}>Down</button>
                        <button type="button" class="button" onclick="editCustomStage(${index})">Edit</button>
                        <button type="button" class="btn-delete" onclick="removeCustomStage(${index})">Remove</button>
                    </div>
                </div>
                <p class="stage-card-summary">${escapeHtml(getStageSummary(stage))}</p>
                ${note}
            </article>
        `;
    }).join('');
}

function editSquad(index) {
    const squad = currentSquads[index];
    document.getElementById('squadName').value = squad.name;
    populateSquadStageOptions(squad.stageKey || '');
    document.getElementById('squadDate').value = squad.date;
    document.getElementById('squadTime').value = squad.time;
    document.getElementById('squadCapacity').value = squad.capacity;
    
    editingSquadIndex = index;
    document.querySelector('#squadsList ~ div button[onclick="addSquad()"]').textContent = 'Update Squad';
    
    // Scroll to squad form
    document.getElementById('squadName').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function removeSquad(index) {
    if (editingSquadIndex === index) {
        editingSquadIndex = null;
        document.querySelector('#squadsList ~ div button[onclick="addSquad()"]').textContent = 'Add Squad';
        // Clear inputs
        document.getElementById('squadName').value = '';
        document.getElementById('squadStageKey').value = '';
        document.getElementById('squadDate').value = '';
        document.getElementById('squadTime').value = '';
        document.getElementById('squadCapacity').value = '';
    }
    currentSquads.splice(index, 1);
    renderSquadsList();
}

function renderSquadsList() {
    const container = document.getElementById('squadsList');
    if (currentSquads.length === 0) {
        container.innerHTML = '<p style="color:#b9c6d8;font-size:.85rem;margin:0">No squads added yet</p>';
        return;
    }

    container.innerHTML = currentSquads.map((squad, index) => {
        const squadDate = new Date(squad.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const stageBadge = squad.isQualifying
            ? '<span style="display:inline-flex;align-items:center;margin-left:8px;padding:2px 8px;border-radius:999px;background:#f4c95d;color:#2f2516;font-size:.72rem;font-weight:700">QUALIFYING</span>'
            : `<span style="display:inline-flex;align-items:center;margin-left:8px;padding:2px 8px;border-radius:999px;background:#dceee9;color:#145449;font-size:.72rem;font-weight:700">${escapeHtml(squad.stageName || 'FORMATTED STAGE')}</span>`;
        return `
            <div style="background:#141a22;padding:10px;border-radius:6px;display:flex;justify-content:space-between;align-items:center;border:1px solid rgba(255,255,255,.05)">
                <div>
                    <strong style="font-size:.9rem">${escapeHtml(squad.name)}</strong>${stageBadge}
                    <span style="color:#b9c6d8;font-size:.85rem;margin-left:8px">
                        ${squadDate} @ ${escapeHtml(squad.time)} • Capacity: ${parseInt(squad.capacity)}
                    </span>
                </div>
                <div style="display:flex;gap:6px">
                    <button type="button" class="button" onclick="editSquad(${index})" style="font-size:.75rem;padding:4px 8px;background:#6c757d">Edit</button>
                    <button type="button" class="btn-delete" onclick="removeSquad(${index})" style="font-size:.75rem;padding:4px 8px">Remove</button>
                </div>
            </div>
        `;
    }).join('');
}

function editTournament(id) {
    // Check if we're on the tournaments page by checking for form elements
    const editingIdField = document.getElementById('editingTournamentId');
    const formTitle = document.getElementById('formTitle');
    
    // If key form elements don't exist, we're not on the tournaments page
    if (!form || !editingIdField || !formTitle) {
        console.error('Form elements not found - cannot edit tournament');
        return;
    }
    
    fetch(`/api/tournaments/${id}`)
        .then(res => res.json())
        .then(tournament => {
            updateFormModeUI(true);
            editingIdField.value = id;
            formTitle.textContent = 'Edit Tournament';
            const submitBtn = document.getElementById('submitBtn');
            const cancelBtn = document.getElementById('cancelBtn');
            if (submitBtn) submitBtn.textContent = 'Update Tournament';
            if (cancelBtn) cancelBtn.style.display = 'inline-block';

            // Fill form with null checks
            if (form.name) form.name.value = tournament.name;
            if (form.startDate) form.startDate.value = (tournament.startDate || tournament.date).split('T')[0];
            if (form.endDate) form.endDate.value = (tournament.endDate || tournament.date).split('T')[0];
            if (form.location) form.location.value = tournament.location;
            if (form.status) form.status.value = tournament.status;
            if (form.description) form.description.value = tournament.description || '';
            if (form.entryFee) form.entryFee.value = tournament.entryFee || 0;
            if (form.paymentInstructions) form.paymentInstructions.value = tournament.paymentInstructions || '';
            if (form.maxParticipants) form.maxParticipants.value = tournament.maxParticipants || '';
            if (form.registrationOpenDate) form.registrationOpenDate.value = tournament.registrationOpenDate ? tournament.registrationOpenDate.slice(0, 16) : '';
            if (form.registrationDeadline) form.registrationDeadline.value = tournament.registrationDeadline ? tournament.registrationDeadline.split('T')[0] : '';
            if (form.squadsRequiredToQualify) form.squadsRequiredToQualify.value = tournament.squadsRequiredToQualify || 1;
            
            const allowReentry = document.getElementById('allowReentry');
            if (allowReentry) allowReentry.checked = tournament.allowReentry !== false;

            // Load squads
            currentSquads = (tournament.squads || []).map((squad) => ({
                ...squad,
                isQualifying: squad.isQualifying !== false && !squad.stageKey,
                stageKey: squad.stageKey || null,
                stageName: squad.stageName || '',
                stageType: squad.stageType || (squad.isQualifying !== false ? 'qualifying' : '')
            }));
            renderSquadsList();
            
            // Load format settings
            const format = tournament.format || {};
            const hasStages = format.hasStages || false;
            
            const setValueIfExists = (id, value) => {
                const el = document.getElementById(id);
                if (el) {
                    if (el.type === 'checkbox') {
                        el.checked = value;
                    } else {
                        el.value = value;
                    }
                }
            };
            
            setValueIfExists('useHandicap', format.useHandicap || false);
            setValueIfExists('handicapBase', format.handicapBase || 200);
            setValueIfExists('handicapPercentage', format.handicapPercentage || 90);
            setValueIfExists('separateDivisions', format.separateDivisions || false);
            setValueIfExists('femaleHandicapPins', format.femaleHandicapPins || 8);
            setValueIfExists('bonusPointsEnabled', format.bonusPoints?.enabled || false);
            setValueIfExists('bonusPerGame', format.bonusPoints?.perGame || 0);
            setValueIfExists('bonusPerSeries', format.bonusPoints?.perSeries || 0);
            
            // Show/hide sections based on settings
            const handicapOptions = document.getElementById('handicapOptions');
            const bonusPointsOptions = document.getElementById('bonusPointsOptions');
            if (handicapOptions) handicapOptions.style.display = format.useHandicap ? 'grid' : 'none';
            if (bonusPointsOptions) bonusPointsOptions.style.display = format.bonusPoints?.enabled ? 'grid' : 'none';
            
            // Load stages
            currentStages = (format.stages || []).map((stage, index) => normalizeStage(stage, index));
            resetStageBuilder();
            renderCustomStagesList();
            populateSquadStageOptions();

            const drawerBody = advancedEditorWrap?.querySelector('.editor-drawer-body');
            if (drawerBody) {
                drawerBody.scrollTo({ top: 0, behavior: 'smooth' });
            }
        })
        .catch(error => {
            alert('Failed to load tournament: ' + error.message);
        });
}

function cancelEdit() {
    closeEditorDrawer();
    document.getElementById('editingTournamentId').value = '';
    document.getElementById('formTitle').textContent = 'Edit Tournament';
    document.getElementById('submitBtn').textContent = 'Update Tournament';
    document.getElementById('cancelBtn').style.display = 'none';
    form.reset();
    currentSquads = [];
    currentStages = [];
    renderSquadsList();
    resetStageBuilder();
    renderCustomStagesList();
    populateSquadStageOptions();
    
    // Reset format options
    document.getElementById('useHandicap').checked = false;
    document.getElementById('bonusPointsEnabled').checked = false;
    document.getElementById('handicapOptions').style.display = 'none';
    document.getElementById('bonusPointsOptions').style.display = 'none';
}

// Load and display tournaments
async function loadTournaments() {
    try {
        // Fetch CSRF token if not already fetched
        if (!csrfToken) {
            const csrfResponse = await fetch('/api/csrf-token');
            const csrfData = await csrfResponse.json();
            csrfToken = csrfData.csrfToken;
        }
        
        const response = await fetch('/api/tournaments');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const tournaments = await response.json();
        loadedTournaments = tournaments;
        renderTournamentCalendar(tournaments);

        if (selectedTournamentId) {
            const exists = tournaments.some(t => t._id === selectedTournamentId);
            if (exists) {
                selectTournament(selectedTournamentId);
            } else {
                selectedTournamentId = null;
            }
        }

        // Update registration filter dropdown (if it exists)
        if (regFilterSelect) {
            regFilterSelect.innerHTML = '<option value="">All Tournaments</option>' + 
                tournaments.map(t => {
                    const startDate = new Date(t.startDate || t.date).toLocaleDateString();
                    const endDate = new Date(t.endDate || t.date).toLocaleDateString();
                    const dateRange = startDate === endDate ? startDate : `${startDate} - ${endDate}`;
                    return `<option value="${t._id}">${t.name} (${dateRange})</option>`;
                }).join('');
        }

        // Update results tournament filter dropdown (if it exists)
        if (resultsTournamentFilter) {
            resultsTournamentFilter.innerHTML = '<option value="">Choose a tournament...</option>' + 
                tournaments.map(t => {
                    const startDate = new Date(t.startDate || t.date).toLocaleDateString();
                    const endDate = new Date(t.endDate || t.date).toLocaleDateString();
                    const dateRange = startDate === endDate ? startDate : `${startDate} - ${endDate}`;
                    return `<option value="${t._id}">${t.name} (${dateRange})</option>`;
                }).join('');
        }

        if (!listContainer) {
            return;
        }

        if (tournaments.length === 0) {
            listContainer.innerHTML = '<p style="color:#b9c6d8;text-align:center">No tournaments scheduled yet.</p>';
            return;
        }

        listContainer.innerHTML = tournaments.map(t => {
            const startDate = new Date(t.startDate || t.date);
            const endDate = new Date(t.endDate || t.date);
            const dateStr = startDate.toDateString() === endDate.toDateString()
                ? startDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
                : `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`;
            const statusClass = `status-${t.status}`;
            const squadCount = t.squads ? t.squads.length : 0;
            
            // Check registration status
            const now = new Date();
            const openDate = t.registrationOpenDate ? new Date(t.registrationOpenDate) : null;
            const deadlineDate = t.registrationDeadline ? new Date(t.registrationDeadline) : null;
            let registrationStatus = '';
            let showReleaseButton = false;
            let showCloseButton = false;
            
            if (deadlineDate && now > deadlineDate) {
                registrationStatus = '<span style="color:#c92a2a">🔒 Registration Closed</span>';
            } else if (t.registrationManuallyClosed) {
                registrationStatus = '<span style="color:#c92a2a">🔒 Registration Closed (Manually)</span>';
            } else if (t.registrationManuallyOpened) {
                registrationStatus = '<span style="color:#51cf66">✅ Registration Open (Manually Released)</span>';
                showCloseButton = true;
            } else if (openDate && now < openDate) {
                registrationStatus = `<span style="color:#ffa94d">⏰ Opens ${openDate.toLocaleString()}</span>`;
                showReleaseButton = true;
            } else if (!openDate || now >= openDate) {
                registrationStatus = '<span style="color:#51cf66">✅ Registration Open</span>';
                showCloseButton = true;
            }
            
            // Format info
            const format = t.format || {};
            const formatDetails = [];
            if (format.gamesPerBowler && format.gamesPerBowler !== 3) {
                formatDetails.push(`${format.gamesPerBowler} games`);
            }
            if (format.scoringMethod && format.scoringMethod !== 'total-pinfall') {
                const methodNames = { 'match-play': 'Match Play', 'head-to-head': 'H2H', 'points': 'Points' };
                formatDetails.push(methodNames[format.scoringMethod] || format.scoringMethod);
            }
            if (format.useHandicap) formatDetails.push('Handicap');
            if (format.hasStages) formatDetails.push(`${format.stages?.length || 0} stages`);
            if (format.bonusPoints?.enabled) formatDetails.push('Bonus Points');
            
            const formatInfo = formatDetails.length > 0 
                ? `<p style="margin-top:4px;font-size:.85rem;color:#6c9bd1">⚙️ ${formatDetails.join(' • ')}</p>` 
                : '';
            
            return `
                <div class="tournament-item">
                    <div class="tournament-info">
                        <h4>${t.name}</h4>
                        <p>${dateStr} • ${t.location} • <span class="status-badge ${statusClass}">${t.status}</span></p>
                        ${t.description ? `<p style="margin-top:4px">${t.description}</p>` : ''}
                        <p style="margin-top:4px;font-size:.9rem">${registrationStatus}</p>
                        ${squadCount > 0 ? `<p style="margin-top:4px;font-size:.85rem;color:#b9c6d8">📅 ${squadCount} squad${squadCount !== 1 ? 's' : ''} configured</p>` : ''}
                        ${formatInfo}
                    </div>
                    <div class="tournament-actions">
                        ${showReleaseButton ? `<button class="button" onclick="openRegistration('${t._id}')" style="font-size:.85rem;padding:6px 10px;background:#51cf66;color:#000">Open Registration</button>` : ''}
                        ${showCloseButton ? `<button class="button" onclick="closeRegistration('${t._id}')" style="font-size:.85rem;padding:6px 10px;background:#ff6b6b;color:#fff">Close Registration</button>` : ''}
                        <button class="button" onclick="editTournament('${t._id}')" style="font-size:.85rem;padding:6px 10px;background:#6c757d">Edit</button>
                        <button class="btn-delete" onclick="deleteTournament('${t._id}')">Delete</button>
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading tournaments:', error);
        if (!listContainer) return;
        const errorP = document.createElement('p');
        errorP.style.cssText = 'color:#c92a2a;text-align:center';
        errorP.textContent = `Failed to load tournaments: ${error.message}`;
        listContainer.innerHTML = '';
        listContainer.appendChild(errorP);
    }
}

// Manually open registration for a tournament
async function openRegistration(id) {
    if (!confirm('Open registration for this tournament immediately?')) return;

    try {
        const response = await fetch(`/api/tournaments/${id}/open-registration`, { 
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken
            },
            credentials: 'same-origin'
        });
        
        if (response.ok) {
            alert('Registration opened successfully!');
            loadTournaments();
        } else {
            const error = await response.json();
            alert('Failed to open registration: ' + (error.error || 'Unknown error'));
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

async function closeRegistration(id) {
    if (!confirm('Close registration for this tournament? No new registrations will be accepted.')) return;

    try {
        const response = await fetch(`/api/tournaments/${id}/close-registration`, { 
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken
            },
            credentials: 'same-origin'
        });
        
        if (response.ok) {
            alert('Registration closed successfully!');
            loadTournaments();
        } else {
            const error = await response.json();
            alert('Failed to close registration: ' + (error.error || 'Unknown error'));
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

// Delete tournament
async function deleteTournament(id) {
    if (!confirm('Are you sure you want to delete this tournament?')) return;

    try {
        const response = await fetch(`/api/tournaments/${id}`, { 
            method: 'DELETE',
            headers: { 'X-CSRF-Token': csrfToken },
            credentials: 'same-origin'
        });
        if (response.ok) {
            loadTournaments();
            loadRegistrations();
        } else {
            alert('Failed to delete tournament');
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

// Load registrations
async function loadRegistrations() {
    // Skip if registration elements don't exist (not on registrations page)
    if (!regListContainer || !regFilterSelect || !regCountSpan) {
        return;
    }
    
    try {
        const tournamentId = regFilterSelect.value;
        const url = tournamentId 
            ? `/api/registrations?tournamentId=${tournamentId}`
            : '/api/registrations';
        
        const response = await fetch(url);
        const registrations = await response.json();

        regCountSpan.textContent = registrations.length;

        if (registrations.length === 0) {
            regListContainer.innerHTML = '<p style="color:#b9c6d8;text-align:center;padding:20px">No registrations found.</p>';
            return;
        }

        // Fetch all tournaments to get squad names
        const tournamentsRes = await fetch('/api/tournaments');
        const allTournaments = await tournamentsRes.json();
        const tournamentsById = {};
        allTournaments.forEach(t => tournamentsById[t._id] = t);

        regListContainer.innerHTML = `
            <table style="width:100%;border-collapse:collapse">
                <thead>
                    <tr style="border-bottom:1px solid rgba(255,255,255,.08);text-align:left">
                        <th style="padding:10px 8px;font-size:.85rem;color:#b9c6d8">Player</th>
                        <th style="padding:10px 8px;font-size:.85rem;color:#b9c6d8">Tournament</th>
                        <th style="padding:10px 8px;font-size:.85rem;color:#b9c6d8">Squads</th>
                        <th style="padding:10px 8px;font-size:.85rem;color:#b9c6d8">Contact</th>
                        <th style="padding:10px 8px;font-size:.85rem;color:#b9c6d8">Status</th>
                        <th style="padding:10px 8px;font-size:.85rem;color:#b9c6d8">Registered</th>
                        <th style="padding:10px 8px;font-size:.85rem;color:#b9c6d8">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${registrations.map(r => {
                        // Get squad names for this registration
                        let squadInfo = '<span style="color:#888;font-size:.85rem">None</span>';
                        if (r.assignedSquads && r.assignedSquads.length > 0) {
                            const tournament = tournamentsById[r.tournament._id];
                            if (tournament && tournament.squads) {
                                const squadNames = r.assignedSquads.map(squadId => {
                                    const squad = tournament.squads.find(s => s._id === squadId);
                                    return squad ? squad.name : 'Unknown';
                                });
                                squadInfo = squadNames.join('<br>');
                            }
                        }

                        return `
                        <tr style="border-bottom:1px solid rgba(255,255,255,.03)">
                            <td style="padding:10px 8px">
                                <strong>${r.playerName}</strong>
                                ${r.averageScore ? `<br><span style="font-size:.8rem;color:#b9c6d8">Avg: ${r.averageScore}</span>` : ''}
                            </td>
                            <td style="padding:10px 8px;font-size:.9rem">${r.tournament?.name || 'N/A'}</td>
                            <td style="padding:10px 8px;font-size:.85rem">${squadInfo}</td>
                            <td style="padding:10px 8px;font-size:.85rem">
                                ${r.email}<br>
                                ${r.phone}
                            </td>
                            <td style="padding:10px 8px">
                                <select onchange="updateRegistrationStatus('${r._id}', this.value)" style="font-size:.8rem;padding:4px 6px">
                                    <option value="pending" ${r.status === 'pending' ? 'selected' : ''}>Pending</option>
                                    <option value="confirmed" ${r.status === 'confirmed' ? 'selected' : ''}>Confirmed</option>
                                    <option value="cancelled" ${r.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                                    <option value="waitlist" ${r.status === 'waitlist' ? 'selected' : ''}>Waitlist</option>
                                </select>
                            </td>
                            <td style="padding:10px 8px;font-size:.85rem">${new Date(r.registeredAt).toLocaleDateString()}</td>
                            <td style="padding:10px 8px">
                                <button class="btn-delete" style="font-size:.75rem;padding:4px 8px" onclick="deleteRegistration('${r._id}')">Delete</button>
                            </td>
                        </tr>
                    `}).join('')}
                </tbody>
            </table>
        `;
    } catch (error) {
        regListContainer.innerHTML = '<p style="color:#c92a2a;text-align:center;padding:20px">Failed to load registrations</p>';
    }
}

// Update registration status
async function updateRegistrationStatus(id, status) {
    try {
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
            loadRegistrations(); // Reload to reset dropdown
        }
    } catch (error) {
        alert('Error: ' + error.message);
        loadRegistrations();
    }
}

// Delete registration
async function deleteRegistration(id) {
    if (!confirm('Are you sure you want to delete this registration?')) return;

    try {
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
        alert('Error: ' + error.message);
    }
}

// Export registrations to CSV
async function exportRegistrations() {
    try {
        const tournamentId = regFilterSelect.value;
        const url = tournamentId 
            ? `/api/registrations?tournamentId=${tournamentId}`
            : '/api/registrations';
        
        const response = await fetch(url);
        const registrations = await response.json();

        if (registrations.length === 0) {
            alert('No registrations to export');
            return;
        }

        // Fetch all tournaments to get squad names
        const tournamentsRes = await fetch('/api/tournaments');
        const allTournaments = await tournamentsRes.json();
        const tournamentsById = {};
        allTournaments.forEach(t => tournamentsById[t._id] = t);

        // Create CSV content
        const headers = ['Player Name', 'Email', 'Phone', 'Tournament', 'Squads', 'Average Score', 'Status', 'Notes', 'Registered Date'];
        const rows = registrations.map(r => {
            // Get squad names
            let squadNames = '';
            if (r.assignedSquads && r.assignedSquads.length > 0) {
                const tournament = tournamentsById[r.tournament._id];
                if (tournament && tournament.squads) {
                    squadNames = r.assignedSquads.map(squadId => {
                        const squad = tournament.squads.find(s => s._id === squadId);
                        return squad ? squad.name : 'Unknown';
                    }).join('; ');
                }
            }

            return [
                r.playerName,
                r.email,
                r.phone,
                r.tournament?.name || '',
                squadNames,
                r.averageScore || '',
                r.status,
                r.notes || '',
                new Date(r.registeredAt).toLocaleDateString()
            ];
        });

        const csvContent = [headers, ...rows]
            .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
            .join('\n');

        // Download CSV
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url2 = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url2;
        a.download = `registrations-${tournamentId ? regFilterSelect.options[regFilterSelect.selectedIndex].text.replace(/[^a-z0-9]/gi, '_') : 'all'}-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url2);
    } catch (error) {
        alert('Failed to export: ' + error.message);
    }
}

// Listen for filter changes
if (regFilterSelect) {
    regFilterSelect.addEventListener('change', loadRegistrations);
}

// ==================== RESULTS MANAGEMENT ====================

async function loadTournamentResults() {
    const tournamentId = resultsTournamentFilter.value;
    const container = document.getElementById('resultsContainer');

    if (!tournamentId) {
        container.innerHTML = '<p style="color:#b9c6d8;text-align:center">Select a tournament to manage results</p>';
        return;
    }

    try {
        // Load tournament details
        const tournamentsRes = await fetch('/api/tournaments');
        const tournaments = await tournamentsRes.json();
        currentTournamentForResults = tournaments.find(t => t._id === tournamentId);

        // Load registrations
        const regRes = await fetch(`/api/registrations?tournamentId=${tournamentId}`);
        const registrations = await regRes.json();

        if (registrations.length === 0) {
            container.innerHTML = '<p style="color:#b9c6d8;text-align:center">No registrations for this tournament</p>';
            return;
        }

        // Organize by squad if squads exist
        if (currentTournamentForResults.squads && currentTournamentForResults.squads.length > 0) {
            renderSquadResults(registrations);
        } else {
            renderSimpleResults(registrations);
        }

    } catch (error) {
        console.error('Error loading results:', error);
        container.innerHTML = '<p style="color:#c92a2a;text-align:center">Failed to load tournament data</p>';
    }
}

function renderSquadResults(registrations) {
    const container = document.getElementById('resultsContainer');
    const squads = currentTournamentForResults.squads;
    const gamesCount = currentTournamentForResults?.format?.gamesPerBowler || 3;

    let html = '<div style="display:flex;flex-direction:column;gap:24px">';

    squads.forEach(squad => {
        const squadRegistrations = registrations.filter(reg => 
            reg.assignedSquads && reg.assignedSquads.some(sid => sid.toString() === squad._id.toString())
        );

        if (squadRegistrations.length === 0) return;
        
        // Generate game header columns
        const gameHeaders = Array.from({length: gamesCount}, (_, i) => 
            `<th style="padding:8px;text-align:center;font-size:.85rem;color:#b9c6d8">Game ${i+1}</th>`
        ).join('');

        html += `
            <div style="border:1px solid rgba(255,255,255,.1);border-radius:8px;padding:16px;background:rgba(255,255,255,.02)">
                <h3 style="margin:0 0 16px;color:var(--blue-500)">${squad.name}</h3>
                <table style="width:100%;border-collapse:collapse">
                    <thead>
                        <tr style="border-bottom:1px solid rgba(255,255,255,.08)">
                            <th style="padding:8px;text-align:left;font-size:.85rem;color:#b9c6d8">Bowler</th>
                            ${gameHeaders}
                            <th style="padding:8px;text-align:center;font-size:.85rem;color:#b9c6d8">Total</th>
                            <th style="padding:8px;text-align:center;font-size:.85rem;color:#b9c6d8">Avg</th>
                            <th style="padding:8px;text-align:center;font-size:.85rem;color:#b9c6d8">Actions</th>
                        </tr>
                    </thead>
                    <tbody id="squad-${squad._id}-results">
                        ${squadRegistrations.map(reg => renderResultRow(reg, squad._id)).join('')}
                    </tbody>
                </table>
            </div>
        `;
    });

    html += '</div>';
    container.innerHTML = html;

    // Load existing results
    loadExistingResults();
}

function renderSimpleResults(registrations) {
    const container = document.getElementById('resultsContainer');
    const gamesCount = currentTournamentForResults?.format?.gamesPerBowler || 3;
    
    // Generate game header columns
    const gameHeaders = Array.from({length: gamesCount}, (_, i) => 
        `<th style="padding:8px;text-align:center;font-size:.85rem;color:#b9c6d8">Game ${i+1}</th>`
    ).join('');

    container.innerHTML = `
        <table style="width:100%;border-collapse:collapse">
            <thead>
                <tr style="border-bottom:1px solid rgba(255,255,255,.08)">
                    <th style="padding:8px;text-align:left;font-size:.85rem;color:#b9c6d8">Bowler</th>
                    ${gameHeaders}
                    <th style="padding:8px;text-align:center;font-size:.85rem;color:#b9c6d8">Total</th>
                    <th style="padding:8px;text-align:center;font-size:.85rem;color:#b9c6d8">Avg</th>
                    <th style="padding:8px;text-align:center;font-size:.85rem;color:#b9c6d8">Actions</th>
                </tr>
            </thead>
            <tbody>
                ${registrations.map(reg => renderResultRow(reg, null)).join('')}
            </tbody>
        </table>
    `;

    loadExistingResults();
}

function renderResultRow(registration, squadId) {
    const rowId = squadId ? `result-${registration.bowler}-${squadId}` : `result-${registration.bowler}`;
    const gamesCount = currentTournamentForResults?.format?.gamesPerBowler || 3;
    
    // Generate game input columns
    const gameInputs = Array.from({length: gamesCount}, (_, i) => `
        <td style="padding:8px;text-align:center">
            <input type="number" id="${rowId}-g${i+1}" min="0" max="300" style="width:60px;padding:4px;text-align:center" />
        </td>
    `).join('');
    
    return `
        <tr id="${rowId}" style="border-bottom:1px solid rgba(255,255,255,.03)">
            <td style="padding:8px">
                <strong>${registration.playerName}</strong>
                ${registration.averageScore ? `<br><span style="font-size:.8rem;color:#b9c6d8">Avg: ${registration.averageScore}</span>` : ''}
            </td>
            ${gameInputs}
            <td style="padding:8px;text-align:center;font-weight:700" id="${rowId}-total">-</td>
            <td style="padding:8px;text-align:center;font-weight:700;color:var(--blue-500)" id="${rowId}-avg">-</td>
            <td style="padding:8px;text-align:center">
                <button class="button" style="font-size:.75rem;padding:4px 8px" 
                    onclick="saveResult('${registration.bowler}', '${squadId || ''}', '${rowId}')">
                    Save
                </button>
            </td>
        </tr>
    `;
}

async function loadExistingResults() {
    if (!currentTournamentForResults) return;

    try {
        // Load all registrations to get bowler IDs
        const regRes = await fetch(`/api/tournaments/${currentTournamentForResults._id}/registrations`);
        const registrations = await regRes.json();
        
        // For each bowler, load their results
        for (const reg of registrations) {
            if (!reg.bowler) continue;
            
            const bowlerId = reg.bowler._id || reg.bowler;
            
            try {
                const historyRes = await fetch(`/api/bowlers/${bowlerId}/history`);
                if (!historyRes.ok) continue;
                
                const history = await historyRes.json();
                
                if (!history.results || history.results.length === 0) continue;
                
                // Find result matching current tournament
                const result = history.results.find(r => {
                    if (!r || !r.tournament) return false;
                    const tournamentId = typeof r.tournament === 'object' ? r.tournament._id : r.tournament;
                    return tournamentId === currentTournamentForResults._id;
                });
                
                if (result && result.squadResults && result.squadResults.length > 0) {
                    result.squadResults.forEach(squadResult => {
                        const squadId = squadResult.squadId || '';
                        const rowId = squadId ? `result-${bowlerId}-${squadId}` : `result-${bowlerId}`;
                        
                        // Populate game scores
                        if (squadResult.games && squadResult.games.length > 0) {
                            squadResult.games.forEach((score, i) => {
                                const input = document.getElementById(`${rowId}-g${i+1}`);
                                if (input) {
                                    input.value = score;
                                }
                            });
                            
                            // Calculate and display totals
                            const games = squadResult.games.filter(g => g >= 0);
                            if (games.length > 0) {
                                const total = games.reduce((sum, g) => sum + g, 0);
                                const avg = Math.round(total / games.length);
                                const totalEl = document.getElementById(`${rowId}-total`);
                                const avgEl = document.getElementById(`${rowId}-avg`);
                                if (totalEl) totalEl.textContent = total;
                                if (avgEl) avgEl.textContent = avg;
                                
                                // Mark row as saved
                                const row = document.getElementById(rowId);
                                if (row) row.style.background = 'rgba(46, 204, 113, .05)';
                            }
                        }
                    });
                }
            } catch (err) {
                console.error(`Error loading results for bowler ${bowlerId}:`, err);
            }
        }
    } catch (error) {
        console.error('Error loading existing results:', error);
    }
}

async function saveResult(bowlerId, squadId, rowId) {
    const gamesCount = currentTournamentForResults?.format?.gamesPerBowler || 3;
    const games = [];
    
    // Collect all game scores (include empty fields as they may be filled later)
    for (let i = 1; i <= gamesCount; i++) {
        const input = document.getElementById(`${rowId}-g${i}`);
        const value = input?.value;
        
        if (value !== '' && value !== null && value !== undefined) {
            const score = parseInt(value);
            if (!isNaN(score) && score >= 0) {
                games.push(score);
            }
        }
    }

    if (games.length === 0) {
        alert('Please enter at least one score');
        return;
    }

    const total = games.reduce((sum, g) => sum + g, 0);
    const avg = Math.round(total / games.length);

    // Update display
    document.getElementById(`${rowId}-total`).textContent = total;
    document.getElementById(`${rowId}-avg`).textContent = avg;

    // Prepare data
    const squadResults = squadId && squadId !== '' ? [{
        squadId: squadId,
        squadName: currentTournamentForResults.squads?.find(s => s._id === squadId)?.name || '',
        games: games
    }] : [{
        games: games
    }];

    const payload = {
        bowlerId: bowlerId,
        tournamentId: currentTournamentForResults._id,
        squadResults: squadResults
    };

    try {
        const response = await fetch('/api/results', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken
            },
            credentials: 'same-origin',
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Server error:', errorText);
            throw new Error(`Failed to save result: ${response.status} - ${errorText}`);
        }

        await response.json();

        // Visual feedback
        const row = document.getElementById(rowId);
        row.style.background = 'rgba(46, 204, 113, .1)';
        setTimeout(() => row.style.background = 'rgba(46, 204, 113, .05)', 2000);

        // Show success message
        const saveBtn = row.querySelector('button');
        const originalText = saveBtn.textContent;
        saveBtn.textContent = '✓ Saved';
        saveBtn.style.background = '#2ecc71';
        setTimeout(() => {
            saveBtn.textContent = originalText;
            saveBtn.style.background = '';
        }, 2000);
    } catch (error) {
        console.error('Error saving result:', error);
        alert('Failed to save result: ' + error.message);
    }
}

// Auto-calculate totals and averages on input
document.addEventListener('input', (e) => {
    if (e.target.type === 'number' && e.target.id.includes('result-')) {
        const rowId = e.target.id.split('-g')[0];
        const gamesCount = currentTournamentForResults?.format?.gamesPerBowler || 3;
        
        // Collect all game scores dynamically
        const games = [];
        for (let i = 1; i <= gamesCount; i++) {
            const score = parseInt(document.getElementById(`${rowId}-g${i}`)?.value) || 0;
            if (score > 0) games.push(score);
        }
        
        // Calculate and display totals
        if (games.length > 0) {
            const total = games.reduce((sum, g) => sum + g, 0);
            const avg = Math.round(total / games.length);
            document.getElementById(`${rowId}-total`).textContent = total;
            document.getElementById(`${rowId}-avg`).textContent = avg;
        } else {
            document.getElementById(`${rowId}-total`).textContent = '-';
            document.getElementById(`${rowId}-avg`).textContent = '-';
        }
    }
});
