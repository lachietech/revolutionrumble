// ===== Mock Data (extend/replace with real feed) =====
const BASE = [
    { name: 'Jordan Carter', games: 12, avg: 226.3, pins: 2716, high: 279, squad: 'A' },
    { name: 'Lachlan Nielsen', games: 12, avg: 223.9, pins: 2687, high: 278, squad: 'B' },
    { name: 'Maria Diaz', games: 12, avg: 221.1, pins: 2653, high: 276, squad: 'A' },
    { name: 'Arjun Singh', games: 12, avg: 219.5, pins: 2634, high: 274, squad: 'B' },
    { name: 'Kai Tan', games: 12, avg: 218.0, pins: 2616, high: 268, squad: 'A' },
    { name: 'Ethan Park', games: 12, avg: 217.2, pins: 2606, high: 266, squad: 'B' },
    { name: 'Sofia Rossi', games: 12, avg: 216.7, pins: 2600, high: 265, squad: 'A' },
    { name: 'Noah Kim', games: 12, avg: 215.4, pins: 2585, high: 264, squad: 'B' },
    { name: 'Ava Patel', games: 12, avg: 214.9, pins: 2579, high: 263, squad: 'A' },
    { name: 'Lucas Meyer', games: 12, avg: 214.3, pins: 2572, high: 262, squad: 'B' }
];

const STAGES = {
    qualifying: BASE,
    match: BASE.map((x) => ({ ...x, games: 20, avg: +(x.avg - 2).toFixed(1), pins: x.pins + 800, high: Math.max(x.high - 3, 240) })),
    finals: BASE.slice(0, 5).map((x) => ({ ...x, games: 24, avg: +(x.avg - 1.5).toFixed(1), pins: x.pins + 1400, high: Math.max(x.high - 5, 235) }))
};

const tbody = document.getElementById('tbody');
const year = document.getElementById('year');
const stage = document.getElementById('stage');
const squad = document.getElementById('squad');
const query = document.getElementById('query');
const pageLabel = document.getElementById('pageLabel');
const prevBtn = document.getElementById('prev');
const nextBtn = document.getElementById('next');

let PAGE = 1;
const PER = 10;
let SORT = { key: 'pos', dir: 'asc' };

function getData() {
    const list = [...STAGES[stage.value]];
    // add positions according to current sort base (pins desc default)
    list.sort((a, b) => b.pins - a.pins);
    list.forEach((x, i) => (x.pos = i + 1));

    // filter by squad
    const f1 = squad.value === 'all' ? list : list.filter((x) => x.squad === squad.value);

    // filter by search
    const q = (query.value || '').trim().toLowerCase();
    const f2 = q ? f1.filter((x) => x.name.toLowerCase().includes(q)) : f1;
    return f2;
}

function sortData(rows) {
    const { key, dir } = SORT;
    const mult = dir === 'asc' ? 1 : -1;
    return rows.sort((a, b) => {
        const A = a[key];
        const B = b[key];
        if (typeof A === 'string') return A.localeCompare(B) * mult;
        return (A - B) * mult;
    });
}

function render() {
    const data = sortData(getData());
    const total = data.length;
    const pages = Math.max(1, Math.ceil(total / PER));
    PAGE = Math.min(PAGE, pages);
    const start = (PAGE - 1) * PER;
    const view = data.slice(start, start + PER);

    tbody.innerHTML = view
    .map((r) => `
    <tr>
        <td>${r.pos}</td>
        <td>${r.name}</td>
        <td class="right">${r.games}</td>
        <td class="right">${r.avg.toFixed(1)}</td>
        <td class="right">${r.pins}</td>
        <td class="right">${r.high}</td>
    </tr>`)
    .join('');

    pageLabel.textContent = `Page ${PAGE} / ${pages}`;
    prevBtn.disabled = PAGE <= 1;
    nextBtn.disabled = PAGE >= pages;
}

// Table sorting
document.querySelectorAll('th').forEach((th) => {
    th.addEventListener('click', () => {
        const key = th.dataset.key;
        if (!key) return;
        SORT.dir = SORT.key === key && SORT.dir === 'asc' ? 'desc' : 'asc';
        SORT.key = key;
        render();
    });
});

// Filters & paging
[stage, squad, query].forEach((el) => el.addEventListener('input', () => {
    PAGE = 1;
    render();
}));

prevBtn.addEventListener('click', () => { PAGE = Math.max(1, PAGE - 1); render(); });
nextBtn.addEventListener('click', () => { PAGE = PAGE + 1; render(); });

// CSV download
document.getElementById('download').addEventListener('click', () => {
    const rows = sortData(getData());
    const head = ['pos', 'name', 'games', 'avg', 'pins', 'high'];
    const csv = [head.join(','), ...rows.map((r) => head.map((k) => r[k]).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `results_${stage.value}_${(year && year.value) || '2026'}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
});

render();