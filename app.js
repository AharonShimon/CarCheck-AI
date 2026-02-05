import { CAR_DATA, CHECKLIST_CONFIG } from './config.js';

let score = 100;
let dynamicSpecs = { engines: [], trims: [] };

document.addEventListener('DOMContentLoaded', () => {
    setupListeners();
});

function setupListeners() {
    ['brand', 'model', 'year', 'engine', 'trim'].forEach(type => {
        document.getElementById(`${type}-trigger`).addEventListener('click', () => openPicker(type));
    });

    document.getElementById('brand-search').addEventListener('keyup', (e) => filterGrid('brand', e.target.value));
    document.getElementById('model-search').addEventListener('keyup', (e) => filterGrid('model', e.target.value));
    document.getElementById('btn-ai').addEventListener('click', startAnalysis);
}

async function openPicker(type) {
    const trigger = document.getElementById(`${type}-trigger`);
    if(trigger.classList.contains('disabled')) return;

    document.querySelectorAll('.popup-grid').forEach(p => p.classList.remove('active'));
    const popup = document.getElementById(`${type}-popup`);
    popup.classList.add('active');
    
    const grid = document.getElementById(`${type}-grid`);
    if (type === 'brand' && grid.innerHTML === '') {
        Object.keys(CAR_DATA).sort().forEach(b => createItem(grid, b, 'brand'));
    } else if (type === 'model' && grid.innerHTML === '') {
        const b = document.getElementById('val-b').value;
        CAR_DATA[b]?.models.forEach(m => createItem(grid, m, 'model'));
    } else if (type === 'year' && grid.innerHTML === '') {
        for(let y = 2026; y >= 2008; y--) createItem(grid, y, 'year');
    } else if (type === 'engine' || type === 'trim') {
        grid.innerHTML = '';
        const list = type === 'engine' ? dynamicSpecs.engines : dynamicSpecs.trims;
        list.forEach(item => createItem(grid, item, type));
    }
}

function createItem(grid, val, type) {
    const d = document.createElement('div');
    d.className = 'grid-item';
    d.innerText = val;
    d.onclick = (e) => { e.stopPropagation(); selectValue(type, val); };
    grid.appendChild(d);
}

async function selectValue(type, val) {
    document.getElementById(`val-${type.charAt(0)}`).value = val;
    document.getElementById(`${type}-trigger`).querySelector('span').innerText = val;
    document.getElementById(`${type}-popup`).classList.remove('active');

    if(type === 'brand') { enableField('model'); document.getElementById('model-grid').innerHTML = ''; }
    else if(type === 'model') { enableField('year'); }
    else if(type === 'year') { await fetchSpecsFromAI(); }
    else if(type === 'engine') { enableField('trim'); }
    
    checkForm();
}

async function fetchSpecsFromAI() {
    const brand = document.getElementById('val-b').value;
    const model = document.getElementById('val-m').value;
    const year = document.getElementById('val-y').value;

    const loader = document.getElementById('loader');
    loader.style.display = 'flex';

    try {
        const res = await fetch('/get-specs', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ brand, model, year })
        });
        const json = await res.json();
        if (json.success) {
            dynamicSpecs = json.data;
            enableField('engine');
            openPicker('engine');
        }
    } catch (err) {
        console.error(err);
    } finally {
        loader.style.display = 'none';
    }
}

function enableField(id) { document.getElementById(`${id}-trigger`).classList.remove('disabled'); }

function checkForm() {
    const fields = ['b', 'm', 'y', 'e', 't'].every(f => document.getElementById(`val-${f}`).value);
    document.getElementById('btn-ai').disabled = !fields;
}

async function startAnalysis() {
    // ... לוגיקת הניתוח הסופי (דומה למה שכתבת)
}
