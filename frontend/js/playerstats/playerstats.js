// ===== Mock Roster =====
const ROSTER = [
    {id:1, name:'Jordan Carter', division:'open', hand:'R', avg:226.3, high:279, strike:0.61, spare:0.78, events:5},
    {id:2, name:'Lachlan Nielsen', division:'open', hand:'R', avg:223.9, high:278, strike:0.59, spare:0.77, events:6},
    {id:3, name:'Maria Diaz', division:'open', hand:'R', avg:221.1, high:276, strike:0.58, spare:0.77, events:4},
    {id:4, name:'Arjun Singh', division:'open', hand:'R', avg:219.5, high:274, strike:0.57, spare:0.76, events:5},
    {id:5, name:'Kai Tan', division:'youth', hand:'R', avg:218.0, high:268, strike:0.56, spare:0.74, events:3},
    {id:6, name:'Noah Kim', division:'senior', hand:'L', avg:215.4, high:264, strike:0.55, spare:0.75, events:5},
    {id:7, name:'Ava Patel', division:'youth', hand:'R', avg:214.9, high:263, strike:0.54, spare:0.73, events:2},
    {id:8, name:'Lucas Meyer', division:'open', hand:'L', avg:214.3, high:262, strike:0.53, spare:0.72, events:3}
];

const list = document.getElementById('list');
const q = document.getElementById('q');
const division = document.getElementById('division');
const hand = document.getElementById('hand');

const pName = document.getElementById('pName');
const pMeta = document.getElementById('pMeta');
const pAvatar = document.getElementById('pAvatar');
const kAvg = document.getElementById('kAvg');
const kHigh = document.getElementById('kHigh');
const kStrike = document.getElementById('kStrike');
const kSpare = document.getElementById('kSpare');
const kEvents = document.getElementById('kEvents');

const compare = document.getElementById('compare');
const addCompare = document.getElementById('addCompare');
const clearCompare = document.getElementById('clearCompare');

let SELECTED = null;
let COMPARE = [];

function renderList(){
    const qv = q.value.trim().toLowerCase();
    const rows = ROSTER.filter(p =>
        (division.value==='all' || p.division===division.value) &&
        (hand.value==='all' || p.hand===hand.value) &&
        (!qv || p.name.toLowerCase().includes(qv))
    );
    list.innerHTML = rows.map(p => `
        <div class="player" data-id="${p.id}">
            <div class="avatar">${p.name.split(' ').map(w=>w[0]).join('').slice(0,2)}</div>
        <div>
        <div><strong>${p.name}</strong></div>
            <div class="sub">${p.division[0].toUpperCase()+p.division.slice(1)} • ${p.hand==='R'?'Right':'Left'} • Avg ${p.avg.toFixed(1)}</div>
        </div>
    </div>`).join('');
    list.querySelectorAll('.player').forEach(el=> el.addEventListener('click',()=> select(+el.dataset.id)));
}

function select(id){
    const p = ROSTER.find(x=>x.id===id); if(!p) return;
    SELECTED = p;
    pName.textContent = p.name;
    pMeta.textContent = `${p.division[0].toUpperCase()+p.division.slice(1)} • ${p.hand==='R'?'Right':'Left'} • ${p.events} events`;
    pAvatar.textContent = p.name.split(' ').map(w=>w[0]).join('').slice(0,2);
    kAvg.textContent = p.avg.toFixed(1);
    kHigh.textContent = p.high;
    kStrike.style.width = (p.strike*100).toFixed(0)+'%';
    kSpare.style.width = (p.spare*100).toFixed(0)+'%';
    kEvents.textContent = p.events;
}

function renderCompare(){
    compare.innerHTML = COMPARE.slice(0,2).map(p=> `
    <div class="cmp-card">
        <div class="row" style="align-items:center;margin-bottom:8px">
            <div class="avatar">${p.name.split(' ').map(w=>w[0]).join('').slice(0,2)}</div>
            <div>
                <div><strong>${p.name}</strong></div>
                <div class="sub">Avg ${p.avg.toFixed(1)} • High ${p.high}</div>
            </div>
        </div>
        <div class="row"><span class="sub" style="width:100px">Strike%</span><div class="bar" style="flex:1"><span style="width:${(p.strike*100).toFixed(0)}%"></span></div></div>
        <div class="row"><span class="sub" style="width:100px">Spare%</span><div class="bar" style="flex:1"><span style="width:${(p.spare*100).toFixed(0)}%"></span></div></div>
    </div>`).join('');
}

addCompare.addEventListener('click',()=>{ if(SELECTED && !COMPARE.find(p=>p.id===SELECTED.id)){ COMPARE.push(SELECTED); renderCompare(); } });
clearCompare.addEventListener('click',()=>{ COMPARE = []; renderCompare(); });

[q,division,hand].forEach(el=> el.addEventListener('input', renderList));

renderList();
select(1);
renderCompare();