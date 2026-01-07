const form = document.getElementById('tournamentForm');
const listContainer = document.getElementById('tournamentList');
const regListContainer = document.getElementById('registrationList');
const regFilterSelect = document.getElementById('regTournamentFilter');
const regCountSpan = document.getElementById('regCount');
const resultsTournamentFilter = document.getElementById('resultsTournamentFilter');

let currentSquads = [];
let currentStages = [];
let currentTournamentForResults = null;

// Load tournaments on page load
loadTournaments();
loadRegistrations();
renderSquadsList(); // Initialize empty squad list
applyTournamentPreset(); // Initialize with default preset

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
    const isEditing = !!editingId;
    
    // Calculate total games from stages
    const totalGames = currentStages.length > 0 
        ? currentStages.reduce((sum, stage) => sum + stage.games, 0)
        : 6;
    
    const formData = {
        name: form.name.value,
        startDate: form.startDate.value,
        endDate: form.endDate.value,
        location: form.location.value,
        status: form.status.value,
        description: form.description.value,
        maxParticipants: form.maxParticipants.value ? Number(form.maxParticipants.value) : null,
        registrationDeadline: form.registrationDeadline.value || null,
        squadsRequiredToQualify: form.squadsRequiredToQualify.value ? Number(form.squadsRequiredToQualify.value) : 1,
        allowReentry: document.getElementById('allowReentry').checked,
        squads: currentSquads.map(s => {
            const squad = {
                name: s.name,
                date: s.date,
                time: s.time,
                capacity: s.capacity,
                isQualifying: s.isQualifying
            };
            // Only include _id if it's a valid MongoDB ObjectId (24 hex characters)
            if (s._id && s._id.length === 24 && /^[0-9a-fA-F]{24}$/.test(s._id)) {
                squad._id = s._id;
            }
            return squad;
        }),
        format: {
            gamesPerBowler: totalGames,
            hasStages: currentStages.length > 1,
            stages: currentStages,
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
            scoringMethod: 'total-pinfall', // Default scoring method
            matchPlay: {
                pointsForWin: Number(document.getElementById('pointsForWin').value) || 30,
                pointsForTie: Number(document.getElementById('pointsForTie').value) || 15,
                pointsForLoss: Number(document.getElementById('pointsForLoss').value) || 0,
                includePinfall: true
            }
        }
    };

    try {
        const url = isEditing ? `/api/tournaments/${editingId}` : '/api/tournaments';
        const method = isEditing ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });

        if (response.ok) {
            form.reset();
            currentSquads = [];
            currentStages = [];
            renderSquadsList();
            renderStagesList();
            cancelEdit();
            loadTournaments();
            loadRegistrations();
            // Reset tournament type dropdown
            document.getElementById('tournamentType').value = 'single-block';
            applyTournamentPreset();
            alert(isEditing ? 'Tournament updated successfully!' : 'Tournament added successfully!');
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
    const date = document.getElementById('squadDate').value;
    const time = document.getElementById('squadTime').value;
    const capacity = document.getElementById('squadCapacity').value;

    if (!name || !date || !time || !capacity) {
        alert('Please fill in all squad fields');
        return;
    }

    const squadData = {
        name,
        date,
        time,
        capacity: Number(capacity),
        isQualifying: true
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
    document.getElementById('squadDate').value = '';
    document.getElementById('squadTime').value = '';
    document.getElementById('squadCapacity').value = '';

    renderSquadsList();
}

// Tournament preset configurations
function applyTournamentPreset() {
    const type = document.getElementById('tournamentType').value;
    const descriptions = {
        'single-block': 'Simple tournament with one block of games for all bowlers',
        'multi-block': 'Multiple qualifying blocks (e.g., Block 1, Block 2, Block 3) with combined standings',
        'qualifying-finals': 'Qualifying round with top bowlers advancing to a final block',
        'triple-crown': 'Three-stage tournament: Qualifying → Semifinals → Finals (common in majors)',
        'match-play': 'Head-to-head matches with points awarded for wins/ties/losses',
        'round-robin': 'Round robin format where each bowler plays every other bowler',
        'bracket-single': 'Single elimination bracket - lose once and you\'re eliminated',
        'bracket-double': 'Double elimination - you get a second chance in losers bracket',
        'stepladder': 'TV-style elimination: 5th vs 4th, winner vs 3rd, etc.',
        'stepladder-extended': 'Extended stepladder with top 8 bowlers (7v8, 6vW, 5vW, etc.)',
        'full-tournament': 'Complete format: Qualifying → Finals → Match Play → Stepladder',
        'team-baker': 'Team Baker format with alternating bowlers per frame',
        'custom': 'Build your own tournament with custom stages'
    };

    document.getElementById('typeDescription').textContent = descriptions[type] || '';

    // Reset everything
    currentStages = [];
    renderStagesList();
    
    // Hide/show sections based on type
    document.getElementById('customStagesSection').style.display = type === 'custom' ? 'block' : 'none';
    document.getElementById('quickSettings').style.display = type !== 'custom' ? 'block' : 'none';
    document.getElementById('multiBlockSettings').style.display = type === 'multi-block' ? 'block' : 'none';
    document.getElementById('matchPlaySettings').style.display = 
        ['match-play', 'round-robin', 'bracket-single', 'bracket-double', 'full-tournament'].includes(type) ? 'block' : 'none';
    document.getElementById('formatSummary').style.display = type !== 'custom' ? 'block' : 'none';

    // Apply preset stages based on type
    switch(type) {
        case 'single-block':
            applySingleBlockPreset();
            break;
        case 'multi-block':
            applyMultiBlockPreset();
            break;
        case 'qualifying-finals':
            applyQualifyingFinalsPreset();
            break;
        case 'triple-crown':
            applyTripleCrownPreset();
            break;
        case 'match-play':
            applyMatchPlayPreset();
            break;
        case 'round-robin':
            applyRoundRobinPreset();
            break;
        case 'bracket-single':
            applySingleEliminationPreset();
            break;
        case 'bracket-double':
            applyDoubleEliminationPreset();
            break;
        case 'stepladder':
            applyStepladderPreset();
            break;
        case 'stepladder-extended':
            applyExtendedStepladderPreset();
            break;
        case 'full-tournament':
            applyFullTournamentPreset();
            break;
        case 'team-baker':
            applyTeamBakerPreset();
            break;
    }

    renderStagesList();
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
}

function removeStage(index) {
    currentStages.splice(index, 1);
    renderStagesList();
}

function renderStagesList() {
    const container = document.getElementById('stagesList');
    if (currentStages.length === 0) {
        container.innerHTML = '<p style="color:#888;text-align:center;padding:8px;font-size:.85rem">No stages added yet</p>';
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
}

let editingStageIndex = null;

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

function editSquad(index) {
    const squad = currentSquads[index];
    document.getElementById('squadName').value = squad.name;
    document.getElementById('squadDate').value = squad.date;
    document.getElementById('squadTime').value = squad.time;
    document.getElementById('squadCapacity').value = squad.capacity;
    document.getElementById('squadIsQualifying').checked = squad.isQualifying;
    
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
        document.getElementById('squadDate').value = '';
        document.getElementById('squadTime').value = '';
        document.getElementById('squadCapacity').value = '';
        document.getElementById('squadIsQualifying').checked = false;
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
        return `
            <div style="background:#141a22;padding:10px;border-radius:6px;display:flex;justify-content:space-between;align-items:center;border:1px solid rgba(255,255,255,.05)">
                <div>
                    <strong style="font-size:.9rem">${escapeHtml(squad.name)}</strong>
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
    fetch(`/api/tournaments/${id}`)
        .then(res => res.json())
        .then(tournament => {
            document.getElementById('editingTournamentId').value = id;
            document.getElementById('formTitle').textContent = 'Edit Tournament';
            document.getElementById('submitBtn').textContent = 'Update Tournament';
            document.getElementById('cancelBtn').style.display = 'inline-block';

            // Fill form
            form.name.value = tournament.name;
            form.startDate.value = (tournament.startDate || tournament.date).split('T')[0];
            form.endDate.value = (tournament.endDate || tournament.date).split('T')[0];
            form.location.value = tournament.location;
            form.status.value = tournament.status;
            form.description.value = tournament.description || '';
            form.maxParticipants.value = tournament.maxParticipants || '';
            form.registrationDeadline.value = tournament.registrationDeadline ? tournament.registrationDeadline.split('T')[0] : '';
            form.squadsRequiredToQualify.value = tournament.squadsRequiredToQualify || 1;
            document.getElementById('allowReentry').checked = tournament.allowReentry !== false; // Default to true for existing tournaments

            // Load squads
            currentSquads = tournament.squads || [];
            renderSquadsList();
            
            // Load format settings
            const format = tournament.format || {};
            const hasStages = format.hasStages || false;
            
            document.getElementById('gamesPerBowler').value = format.gamesPerBowler || 6;
            document.getElementById('scoringMethod').value = format.scoringMethod || 'total-pinfall';
            document.getElementById('hasStages').checked = hasStages;
            document.getElementById('useHandicap').checked = format.useHandicap || false;
            document.getElementById('handicapBase').value = format.handicapBase || 200;
            document.getElementById('handicapPercentage').value = format.handicapPercentage || 90;
            document.getElementById('separateDivisions').checked = format.separateDivisions || false;
            document.getElementById('femaleHandicapPins').value = format.femaleHandicapPins || 8;
            document.getElementById('bonusPointsEnabled').checked = format.bonusPoints?.enabled || false;
            document.getElementById('bonusPerGame').value = format.bonusPoints?.perGame || 0;
            document.getElementById('bonusPerSeries').value = format.bonusPoints?.perSeries || 0;
            document.getElementById('pointsForWin').value = format.matchPlay?.pointsForWin || 30;
            document.getElementById('pointsForTie').value = format.matchPlay?.pointsForTie || 15;
            document.getElementById('pointsForLoss').value = format.matchPlay?.pointsForLoss || 0;
            document.getElementById('includePinfall').checked = format.matchPlay?.includePinfall !== false;
            
            // Show/hide sections based on settings
            document.getElementById('handicapOptions').style.display = format.useHandicap ? 'grid' : 'none';
            document.getElementById('bonusPointsOptions').style.display = format.bonusPoints?.enabled ? 'grid' : 'none';
            
            // Load stages
            currentStages = format.stages || [];
            renderStagesList();

            // Scroll to form
            form.scrollIntoView({ behavior: 'smooth', block: 'start' });
        })
        .catch(error => {
            alert('Failed to load tournament: ' + error.message);
        });
}

function cancelEdit() {
    document.getElementById('editingTournamentId').value = '';
    document.getElementById('formTitle').textContent = 'Add New Tournament';
    document.getElementById('submitBtn').textContent = 'Add Tournament';
    document.getElementById('cancelBtn').style.display = 'none';
    form.reset();
    currentSquads = [];
    currentStages = [];
    renderSquadsList();
    renderStagesList();
    
    // Reset format options
    document.getElementById('useHandicap').checked = false;
    document.getElementById('bonusPointsEnabled').checked = false;
    document.getElementById('handicapOptions').style.display = 'none';
    document.getElementById('bonusPointsOptions').style.display = 'none';
    document.getElementById('matchPlaySettings').style.display = 'none';
    
    // Reset tournament type to default
    document.getElementById('tournamentType').value = 'single-block';
    applyTournamentPreset();
}

// Load and display tournaments
async function loadTournaments() {
    try {
        const response = await fetch('/api/tournaments');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const tournaments = await response.json();

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
                        ${squadCount > 0 ? `<p style="margin-top:4px;font-size:.85rem;color:#b9c6d8">📅 ${squadCount} squad${squadCount !== 1 ? 's' : ''} configured</p>` : ''}
                        ${formatInfo}
                    </div>
                    <div class="tournament-actions">
                        <button class="button" onclick="editTournament('${t._id}')" style="font-size:.85rem;padding:6px 10px;background:#6c757d">Edit</button>
                        <button class="btn-delete" onclick="deleteTournament('${t._id}')">Delete</button>
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading tournaments:', error);
        const errorP = document.createElement('p');
        errorP.style.cssText = 'color:#c92a2a;text-align:center';
        errorP.textContent = `Failed to load tournaments: ${error.message}`;
        listContainer.innerHTML = '';
        listContainer.appendChild(errorP);
    }
}

// Delete tournament
async function deleteTournament(id) {
    if (!confirm('Are you sure you want to delete this tournament?')) return;

    try {
        const response = await fetch(`/api/tournaments/${id}`, { method: 'DELETE' });
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
            headers: { 'Content-Type': 'application/json' },
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
        const response = await fetch(`/api/registrations/${id}`, { method: 'DELETE' });
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
regFilterSelect.addEventListener('change', loadRegistrations);

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
    
    console.log('Rendering row:', { rowId, gamesCount, registration });
    
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

    console.log('Loading existing results for tournament:', currentTournamentForResults._id);

    try {
        // Load all registrations to get bowler IDs
        const regRes = await fetch(`/api/tournaments/${currentTournamentForResults._id}/registrations`);
        const registrations = await regRes.json();
        
        console.log('Loaded registrations:', registrations.length);
        
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
                    console.log('Found existing result for bowler:', bowlerId, result);
                    
                    result.squadResults.forEach(squadResult => {
                        const squadId = squadResult.squadId || '';
                        const rowId = squadId ? `result-${bowlerId}-${squadId}` : `result-${bowlerId}`;
                        
                        // Populate game scores
                        if (squadResult.games && squadResult.games.length > 0) {
                            squadResult.games.forEach((score, i) => {
                                const input = document.getElementById(`${rowId}-g${i+1}`);
                                if (input) {
                                    input.value = score;
                                    console.log(`Set ${rowId}-g${i+1} to ${score}`);
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
    
    console.log('Saving result:', { bowlerId, squadId, rowId, gamesCount });
    
    // Collect all game scores (include empty fields as they may be filled later)
    for (let i = 1; i <= gamesCount; i++) {
        const input = document.getElementById(`${rowId}-g${i}`);
        const value = input?.value;
        console.log(`Game ${i} input:`, input, 'value:', value);
        
        if (value !== '' && value !== null && value !== undefined) {
            const score = parseInt(value);
            if (!isNaN(score) && score >= 0) {
                games.push(score);
            }
        }
    }

    console.log('Collected games:', games);

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

    console.log('Sending payload:', payload);

    try {
        const response = await fetch('/api/results', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        console.log('Response status:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Server error:', errorText);
            throw new Error(`Failed to save result: ${response.status} - ${errorText}`);
        }

        const savedResult = await response.json();
        console.log('Saved successfully:', savedResult);

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