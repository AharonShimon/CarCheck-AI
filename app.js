import { CAR_DATA, CHECKLIST_CONFIG } from './config.js';

let selection = { brand: '', model: '', year: '', engine: '', trim: '' };
let currentEngines = [];
let currentTrims = [];
let score = 100;
let totalCost = 0;
let defects = [];

document.addEventListener('DOMContentLoaded', () => {
    setupListeners();
});

function setupListeners() {
    ['brand', 'model', 'year', 'engine', 'trim'].forEach(type => {
        document.getElementById(`${type}-trigger`).addEventListener('click', () => openPicker(type));
    });

    ['brand', 'model'].forEach(type => {
        document.getElementById(`${type}-search`).addEventListener('keyup', (e) => filterGrid(type, e.target.value));
    });

    document.getElementById('btn-ai').addEventListener('click', startAnalysis);
    document.getElementById('btn-skip').addEventListener('click', goToChecklist);
    document.getElementById('btn-continue').addEventListener('click', goToChecklist);
    document.getElementById('btn-finish').addEventListener('click', finishCheck);
    document.getElementById('btn-share').addEventListener('click', () => window.open("https://www.waze.com/ul?q=מכון%20בדיקת%20רכב", "_blank"));
    document.getElementById('btn-restart').addEventListener('click', () => location.reload());

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.field-group') && !e.target.closest('.popup-grid')) {
            document.querySelectorAll('.popup-grid').forEach(p => p.classList.remove('active'));
        }
    });
}

function openPicker(type) {
    if(document.getElementById(`${type}-trigger`).classList.contains('disabled')) return;
    document.querySelectorAll('.popup-grid').forEach(p => p.classList.remove('active'));
    document.getElementById(`${type}-popup`).classList.add('active');
    
    const grid = document.getElementById(`${type}-grid`);
    if (grid.children.length > 0 && type !== 'engine' && type !== 'trim') return;
    
    grid.innerHTML = '';
    let items = [];

    if (type === 'brand') items = Object.keys(CAR_DATA).sort();
    else if (type === 'model') items = CAR_DATA[selection.brand]?.models || [];
    else if (type === 'year') for(let y=2026; y>=2008; y--) items.push(y);
    else if (type === 'engine') items = currentEngines;
    else if (type === 'trim') items = currentTrims;

    items.forEach(val => createItem(grid, val, type));
}

function createItem(grid, val, type) {
    const d = document.createElement('div');
    d.className = 'grid-item';
    d.innerText = val;
    d.onclick = (e) => { e.stopPropagation(); selectValue(type, val); };
    grid.appendChild(d);
}

function selectValue(type, val) {
    selection[type] = val;
    document.getElementById(`val-${type.charAt(0)}`).value = val;
    document.getElementById(`${type}-trigger`).querySelector('span').innerText = val;
    document.getElementById(`${type}-popup`).classList.remove('active');

    if(type === 'brand') { 
        selection.model=''; selection.year=''; selection.engine=''; selection.trim='';
        reset('model'); reset('year'); reset('engine'); reset('trim'); 
        enable('model'); 
    }
    else if(type === 'model') { reset('year'); reset('engine'); reset('trim'); enable('year'); }
    else if(type === 'year') { 
        reset('engine'); reset('trim');
        const data = CAR_DATA[selection.brand];
        currentEngines = data.engines || [];
        currentTrims = data.trims || [];
        enable('engine'); 
        openPicker('engine');
    }
    else if(type === 'engine') { reset('trim'); enable('trim'); openPicker('trim'); }
    
    checkForm();
}

function enable(id) { document.getElementById(`${id}-trigger`).classList.remove('disabled'); }
function reset(id) { 
    document.getElementById(`${id}-trigger`).classList.add('disabled'); 
    document.getElementById(`${id}-trigger`).querySelector('span').innerText = 'בחר...';
}

function filterGrid(type, query) {
    const items = document.getElementById(`${type}-grid`).children;
    for (let item of items) item.style.display = item.innerText.toLowerCase().includes(query.toLowerCase()) ? 'flex' : 'none';
}

function checkForm() {
    const ready = Object.values(selection).every(v => v !== '');
    document.getElementById('btn-ai').disabled = !ready;
}

// AI
async function startAnalysis() {
    const userNotes = document.getElementById('user-notes').value;
    document.getElementById('loader').style.display = 'flex';
    document.getElementById('btn-ai').disabled = true;

    try {
        const res = await fetch('/analyze-ai', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ ...selection, userNotes })
        });
        const data = await res.json();
        if(data.success) renderAI(data.aiAnalysis);
    } catch(e) {
        renderAI({
            reliability_score: 80,
            summary: "לא הצלחנו להתחבר לשרת, אך הרכב נחשב אמין. המשך לבדיקה.",
            pros: ["רכב פופולרי"],
            common_faults: ["בלאי טבעי"]
        });
    } finally {
        document.getElementById('loader').style.display = 'none';
        document.getElementById('btn-ai').disabled = false;
    }
}

function renderAI(ai) {
    document.getElementById('ai-panel').style.display = 'block';
    document.getElementById('ai-content').innerHTML = `
        <div style="font-size:40px; font-weight:900; color:var(--accent); text-align:center;">${ai.reliability_score}</div>
        <p style="text-align:center; color:#cbd5e1;">${ai.summary}</p>
        <div style="margin-top:10px;">
            <strong style="color:var(--success)">✅ יתרונות:</strong> ${ai.pros.join(', ')}<br>
            <strong style="color:var(--danger)">❌ תקלות:</strong> ${ai.common_faults.join(', ')}
        </div>
    `;
    document.getElementById('ai-panel').scrollIntoView({behavior:'smooth'});
}

// יצירת הכרטיסיות החדשות
function goToChecklist() {
    document.getElementById('screen-input').style.display = 'none';
    document.getElementById('screen-check').style.display = 'block';
    window.scrollTo(0,0);
    const container = document.getElementById('checklist-content');
    if(container.innerHTML !== '') return;

    CHECKLIST_CONFIG.forEach((cat, cIdx) => {
        container.innerHTML += `<div class="category-header"><h3>${cat.category}</h3></div>`;
        cat.items.forEach((item, iIdx) => {
            const id = `task-${cIdx}-${iIdx}`;
            const card = document.createElement('div');
            card.className = 'task-card';
            card.id = `card-${id}`;
            card.innerHTML = `
                <div class="task-header"><span class="task-number">#${iIdx+1}</span><h4 class="task-title">${item.name}</h4></div>
                <div class="task-details">
                    <div class="detail-row"><span class="icon">📍</span> ${item.location}</div>
                    <div class="detail-row"><span class="icon">🖐️</span> ${item.action}</div>
                </div>
                <div class="buttons-row">
                    <button class="btn-decision btn-good" onclick="window.handleDecision('${id}', true, ${item.weight}, '${item.name}', 0)">✅ ${item.ok}</button>
                    <button class="btn-decision btn-bad" onclick="window.handleDecision('${id}', false, ${item.weight}, '${item.name}', ${item.cost})">❌ ${item.notOk}</button>
                </div>
            `;
            container.appendChild(card);
        });
    });
}

window.handleDecision = (id, isGood, weight, name, cost) => {
    const card = document.getElementById(`card-${id}`);
    const btnGood = card.querySelector('.btn-good');
    const btnBad = card.querySelector('.btn-bad');

    if (card.dataset.status === 'bad') { score += weight; totalCost -= cost; defects = defects.filter(d => d.name !== name); }
    
    if (isGood) {
        card.dataset.status = 'good';
        btnGood.classList.add('selected'); btnBad.classList.remove('selected');
        card.classList.add('completed-good'); card.classList.remove('completed-bad');
    } else {
        card.dataset.status = 'bad';
        btnBad.classList.add('selected'); btnGood.classList.remove('selected');
        card.classList.add('completed-bad'); card.classList.remove('completed-good');
        score -= weight; totalCost += cost; defects.push({name, cost});
    }

    setTimeout(() => {
        const next = card.nextElementSibling;
        if(next && next.classList.contains('task-card')) next.scrollIntoView({behavior: 'smooth', block: 'center'});
    }, 400);
};

function finishCheck() {
    document.getElementById('screen-check').style.display = 'none';
    document.getElementById('screen-result').style.display = 'block';
    window.scrollTo(0,0);

    const final = Math.max(0, score);
    const gauge = document.getElementById('final-gauge');
    gauge.innerText = final;
    
    let color = final > 85 ? "var(--success)" : (final > 65 ? "var(--plate-yellow)" : "var(--danger)");
    gauge.style.color = color; gauge.style.borderColor = color;
    document.getElementById('result-status').innerText = final > 85 ? "רכב מציאה! ✅" : "דורש בדיקה ⚠️";

    const ul = document.getElementById('defects-ul');
    ul.innerHTML = '';
    if(defects.length > 0) {
        document.getElementById('defects-container').style.display = 'block';
        defects.forEach(d => ul.innerHTML += `<li>${d.name} <span style="float:left">₪${d.cost}</span></li>`);
        ul.innerHTML += `<div style="margin-top:10px; font-weight:bold; border-top:1px solid #555; padding-top:5px;">סה"כ תיקונים: ₪${totalCost.toLocaleString()}</div>`;
    }
}
