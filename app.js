import { CAR_DATA } from './config.js';

let dynamicSpecs = { engines: [], trims: [] };

document.addEventListener('DOMContentLoaded', () => {
    setupListeners();
});

function setupListeners() {
    // מאזינים ללחיצות על השדות
    ['brand', 'model', 'year', 'engine', 'trim'].forEach(type => {
        document.getElementById(`${type}-trigger`).addEventListener('click', () => openPicker(type));
    });

    // כפתור ניתוח
    document.getElementById('btn-analyze').addEventListener('click', startAnalysis);

    // סגירת פופאפים בלחיצה בחוץ
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.field-box') && !e.target.closest('.popup')) {
            document.querySelectorAll('.popup').forEach(p => p.classList.remove('active'));
        }
    });
}

function openPicker(type) {
    const trigger = document.getElementById(`${type}-trigger`);
    if (trigger.classList.contains('disabled')) return;

    // סגור את כל האחרים
    document.querySelectorAll('.popup').forEach(p => p.classList.remove('active'));
    
    const popup = document.getElementById(`${type}-popup`);
    popup.classList.add('active');
    
    const grid = document.getElementById(`${type}-grid`);
    
    // מילוי הנתונים רק אם הגריד ריק
    if (grid.innerHTML === '') {
        populateGrid(type, grid);
    }
}

function populateGrid(type, grid) {
    let items = [];
    
    if (type === 'brand') {
        items = Object.keys(CAR_DATA).sort();
    } else if (type === 'model') {
        const b = document.getElementById('val-b').value;
        items = CAR_DATA[b]?.models || [];
    } else if (type === 'year') {
        for (let y = 2025; y >= 2005; y--) items.push(y);
    } else if (type === 'engine') {
        items = dynamicSpecs.engines;
    } else if (type === 'trim') {
        items = dynamicSpecs.trims;
    }

    items.forEach(val => {
        const div = document.createElement('div');
        div.className = 'grid-item';
        div.innerText = val;
        div.onclick = (e) => {
            e.stopPropagation();
            selectValue(type, val);
        };
        grid.appendChild(div);
    });
}

async function selectValue(type, val) {
    // עדכון הערך הנבחר
    document.getElementById(`val-${type.charAt(0)}`).value = val;
    document.getElementById(`${type}-trigger`).querySelector('span').innerText = val;
    document.getElementById(`${type}-popup`).classList.remove('active');

    // לוגיקת השרשרת
    if (type === 'brand') {
        resetNextFields('model');
        document.getElementById('model-grid').innerHTML = ''; // איפוס כדי שיתמלא מחדש
        enableField('model');
        openPicker('model');
    } 
    else if (type === 'model') {
        resetNextFields('year');
        enableField('year');
        openPicker('year');
    } 
    else if (type === 'year') {
        // === כאן קורה הקסם: פונים ל-AI ===
        resetNextFields('engine');
        await fetchSpecsFromAI();
    } 
    else if (type === 'engine') {
        resetNextFields('trim');
        enableField('trim');
        openPicker('trim');
    }
    
    checkFormCompletion();
}

async function fetchSpecsFromAI() {
    const brand = document.getElementById('val-b').value;
    const model = document.getElementById('val-m').value;
    const year = document.getElementById('val-y').value;

    const loader = document.getElementById('loader');
    const loaderText = document.getElementById('loader-text');
    loaderText.innerText = `מאתר מפרטים עבור ${brand} ${model}...`;
    loader.style.display = 'flex';

    try {
        const response = await fetch('/get-specs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ brand, model, year })
        });

        const json = await response.json();

        if (json.success && json.data) {
            dynamicSpecs = json.data;
            // ניקוי גרידים קודמים
            document.getElementById('engine-grid').innerHTML = '';
            document.getElementById('trim-grid').innerHTML = '';
            
            enableField('engine');
            openPicker('engine');
        } else {
            alert("לא נמצאו נתונים מדויקים, נסה שוב");
        }
    } catch (e) {
        console.error(e);
        // Fallback למקרה חירום
        dynamicSpecs = { engines: ["בנזין 1.6", "היברידי"], trims: ["רגיל", "מפואר"] };
        enableField('engine');
    } finally {
        loader.style.display = 'none';
    }
}

function startAnalysis() {
    // כאן תבוא הפונקציה המלאה ששלחתי לך קודם
    // לצורך הדוגמה, רק נציג הודעה
    alert("שולח לניתוח AI...");
}

// עזרים
function enableField(id) { document.getElementById(`${id}-trigger`).classList.remove('disabled'); }
function resetNextFields(fromType) {
    // לוגיקה פשוטה לאיפוס שדות בהמשך הדרך
    const order = ['brand', 'model', 'year', 'engine', 'trim'];
    let startIdx = order.indexOf(fromType);
    for(let i=startIdx; i<order.length; i++) {
        const t = order[i];
        document.getElementById(`val-${t.charAt(0)}`).value = '';
        const el = document.getElementById(`${t}-trigger`);
        el.classList.add('disabled');
        el.querySelector('span').innerText = 'בחר...';
    }
}

function checkFormCompletion() {
    const allFilled = ['b','m','y','e','t'].every(k => document.getElementById(`val-${k}`).value);
    document.getElementById('btn-analyze').disabled = !allFilled;
}
