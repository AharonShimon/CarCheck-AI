import { CAR_DATA, CHECKLIST_CONFIG } from './config.js';

let score = 100;
let defects = [];

// משתנים לשמירת הנתונים שה-AI יביא
let dynamicSpecs = { engines: [], trims: [] };

document.addEventListener('DOMContentLoaded', () => {
    setupListeners();
});

function setupListeners() {
    // טריגרים לפופ-אפים
    document.getElementById('brand-trigger').addEventListener('click', () => openPicker('brand'));
    document.getElementById('model-trigger').addEventListener('click', () => openPicker('model'));
    document.getElementById('year-trigger').addEventListener('click', () => openPicker('year'));
    
    // אלו תלויים ב-AI, נפתח אותם רק אחרי שהמידע הגיע
    document.getElementById('engine-trigger').addEventListener('click', () => openPicker('engine'));
    document.getElementById('trim-trigger').addEventListener('click', () => openPicker('trim'));

    // חיפוש
    document.getElementById('brand-search').addEventListener('keyup', (e) => filterGrid('brand', e.target.value));
    document.getElementById('model-search').addEventListener('keyup', (e) => filterGrid('model', e.target.value));

    // כפתורים
    document.getElementById('btn-ai').addEventListener('click', startAnalysis);
    document.getElementById('btn-skip').addEventListener('click', goToChecklist);
    document.getElementById('btn-finish').addEventListener('click', finishCheck);

    // סגירה בלחיצה בחוץ
    document.addEventListener('click', (e) => {
        if(!e.target.closest('.field-group')) {
            document.querySelectorAll('.popup-grid').forEach(p => p.classList.remove('active'));
        }
    });
}

function openPicker(type) {
    if(document.getElementById(`${type}-trigger`).classList.contains('disabled')) return;

    // סגירת אחרים
    document.querySelectorAll('.popup-grid').forEach(p => p.classList.remove('active'));
    
    const popup = document.getElementById(`${type}-popup`);
    popup.classList.add('active');
    
    const grid = document.getElementById(`${type}-grid`);
    
    // מילוי הנתונים
    if (type === 'brand') {
        if(grid.innerHTML === '') Object.keys(CAR_DATA).sort().forEach(b => createItem(grid, b, 'brand'));
    } 
    else if (type === 'model') {
        // מודלים מתנקים כל פעם שבוחרים יצרן חדש
        if(grid.innerHTML === '') {
            const selectedBrand = document.getElementById('val-b').value;
            if(selectedBrand && CAR_DATA[selectedBrand]) {
                CAR_DATA[selectedBrand].models.forEach(m => createItem(grid, m, 'model'));
            }
        }
    } 
    else if (type === 'year') {
        if(grid.innerHTML === '') {
            for(let y = 2026; y >= 2008; y--) createItem(grid, y, 'year');
        }
    }
    // כאן הנתונים מגיעים מה-AI!
    else if (type === 'engine') {
        grid.innerHTML = ''; 
        dynamicSpecs.engines.forEach(e => createItem(grid, e, 'engine'));
    }
    else if (type === 'trim') {
        grid.innerHTML = '';
        dynamicSpecs.trims.forEach(t => createItem(grid, t, 'trim'));
    }
}

function createItem(grid, val, type) {
    const d = document.createElement('div');
    d.className = 'grid-item';
    d.innerText = val;
    d.addEventListener('click', (e) => {
        e.stopPropagation();
        selectValue(type, val);
    });
    grid.appendChild(d);
}

// פונקציה ראשית שמנהלת את השרשרת
async function selectValue(type, val) {
    document.getElementById(`val-${type.charAt(0)}`).value = val;
    document.getElementById(`${type}-trigger`).querySelector('span').innerText = val;
    document.getElementById(`${type}-popup`).classList.remove('active');

    // לוגיקת השרשרת
    if(type === 'brand') {
        resetField('model'); resetField('year'); resetField('engine'); resetField('trim');
        // ניקוי הגריד של המודלים כדי שיתמלא מחדש
        document.getElementById('model-grid').innerHTML = ''; 
        enableField('model');
    }
    else if(type === 'model') {
        resetField('year'); resetField('engine'); resetField('trim');
        enableField('year');
    }
    else if(type === 'year') {
        // === כאן מתרחש הקסם: שליחה ל-AI להביא מפרטים ===
        resetField('engine'); resetField('trim');
        await fetchSpecsFromAI(); // מחכה לתשובה מהשרת
    }
    else if(type === 'engine') {
        enableField('trim');
    }
    
    checkForm();
}

// פונקציה שרצה לשרת ומביאה מנועים וגימורים
async function fetchSpecsFromAI() {
    const brand = document.getElementById('val-b').value;
    const model = document.getElementById('val-m').value;
    const year = document.getElementById('val-y').value;

    // הצגת לואדר
    const loader = document.getElementById('loader');
    const loaderText = document.getElementById('loader-text');
    loaderText.innerText = `🔍 מחפש מפרטים ל-${model}...`;
    loader.style.display = 'flex';

    try {
        const res = await fetch('/get-specs', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ brand, model, year })
        });
        
        const json = await res.json();
        
        if (json.success) {
            // שמירת התוצאות במשתנה הגלובלי
            dynamicSpecs = json.data;
            
            // פתיחת השדה הבא (מנוע)
            enableField('engine');
            // פתיחת הפופ-אפ של המנועים אוטומטית כדי להרשים את המשתמש
            openPicker('engine');
        } else {
            alert('לא נמצאו נתונים, נסה לבחור ידנית');
        }

    } catch (err) {
        console.error(err);
        alert('שגיאה בטעינת נתוני רכב');
    } finally {
        loader.style.display = 'none';
    }
}

function resetField(id) {
    document.getElementById(`val-${id.charAt(0)}`).value = '';
    const trigger = document.getElementById(`${id}-trigger`);
    trigger.classList.add('disabled');
    trigger.querySelector('span').innerText = (id === 'engine' ? '🔌 בחר מנוע...' : (id === 'trim' ? '✨ בחר גימור...' : 'בחר...'));
}

function enableField(id) {
    document.getElementById(`${id}-trigger`).classList.remove('disabled');
}

function filterGrid(type, query) {
    const grid = document.getElementById(`${type}-grid`);
    Array.from(grid.children).forEach(item => {
        item.style.display = item.innerText.toLowerCase().includes(query.toLowerCase()) ? 'flex' : 'none';
    });
}

function checkForm() {
    const b = document.getElementById('val-b').value;
    const m = document.getElementById('val-m').value;
    const y = document.getElementById('val-y').value;
    const e = document.getElementById('val-e').value;
    const t = document.getElementById('val-t').value;
    
    document.getElementById('btn-ai').disabled = !(b && m && y && e && t);
}

// ניתוח סופי
async function startAnalysis() {
    const b = document.getElementById('val-b').value;
    const m = document.getElementById('val-m').value;
    const y = document.getElementById('val-y').value;
    const e = document.getElementById('val-e').value;
    const t = document.getElementById('val-t').value;

    document.getElementById('loader-text').innerText = '🤖 המוסכניק מנתח את הנתונים...';
    document.getElementById('loader').style.display = 'flex';

    try {
        const res = await fetch('/analyze-ai', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ brand:b, model:m, year:y, engine:e, trim:t, faults: [] })
        });
        const data = await res.json();
        
        if(data.success) {
            renderAI(data.aiAnalysis);
        }
    } catch(err) {
        alert("שגיאה בניתוח");
    } finally {
        document.getElementById('loader').style.display = 'none';
    }
}

function renderAI(ai) {
    const p = document.getElementById('ai-panel');
    p.style.display = 'block';
    p.innerHTML = `
        <div style="background:var(--card-bg); padding:20px; border-radius:20px; border:1px solid var(--accent); animation: slideUp 0.5s;">
            <div style="text-align:center; font-size:45px; font-weight:900; color:var(--accent);">${ai.reliability_score}</div>
            <p style="text-align:center; font-size:15px; color:var(--text-muted);">${ai.summary}</p>
            <div style="margin-top:15px; text-align:right;">
                <b style="color:var(--danger)">⚠️ תקלות נפוצות:</b>
                <ul style="font-size:13px; color:#cbd5e1; padding-right:20px;">${ai.common_faults.map(f=>`<li>${f}</li>`).join('')}</ul>
                <div style="margin-top:10px; padding:10px; background:rgba(16, 185, 129, 0.1); border-radius:8px;">
                    <b style="color:var(--success)">💰 טיפ למו"מ:</b><br>
                    <span style="font-size:13px;">${ai.negotiation_tip}</span>
                </div>
            </div>
            <button id="btn-continue-check" class="btn-main" style="margin-top:20px;">המשך לבדיקת שטח 🏁</button>
        </div>
    `;
    p.scrollIntoView({behavior:'smooth'});
    document.getElementById('btn-continue-check').addEventListener('click', goToChecklist);
}

function goToChecklist() {
    document.getElementById('screen-input').style.display = 'none';
    document.getElementById('screen-check').style.display = 'block';
    window.scrollTo(0,0);
    
    const container = document.getElementById('checklist-content');
    container.innerHTML = '';
    
    CHECKLIST_CONFIG.forEach((cat, cIdx) => {
        const header = document.createElement('div');
        header.className = 'category-header';
        header.innerHTML = `<span class="category-title">${cat.category}</span>`;
        container.appendChild(header);

        cat.items.forEach((item, iIdx) => {
            const id = `cb-${cIdx}-${iIdx}`;
            container.innerHTML += `
                <div class="check-item">
                    <div class="check-item-header">
                        <div style="display:flex; align-items:center; gap:12px;">
                            <button class="info-btn" onclick="alert('${item.howTo}')">i</button>
                            <span style="font-weight:600;">${item.name}</span>
                        </div>
                        <div id="${id}" class="cb-custom" onclick="toggleCheck('${id}', ${item.weight}, '${item.name}')"></div>
                    </div>
                </div>`;
        });
    });
}

window.toggleCheck = (id, w, name) => {
    const el = document.getElementById(id);
    if(el.classList.contains('bad')) {
        el.classList.remove('bad'); score += 10;
    } else {
        el.classList.add('bad'); score -= 10;
    }
};

window.finishCheck = () => {
    document.getElementById('screen-check').style.display = 'none';
    document.getElementById('screen-result').style.display = 'block';
    const final = Math.max(0, score);
    const gauge = document.getElementById('final-gauge');
    gauge.innerText = final;
    const color = final > 85 ? "var(--success)" : (final > 60 ? "var(--plate-yellow)" : "var(--danger)");
    gauge.style.color = color; gauge.style.borderColor = color;
    document.getElementById('result-status').innerText = final > 85 ? "מצב מצוין ✅" : "דורש תיקון ⚠️";
};
