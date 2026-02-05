import { CAR_DATA, CHECKLIST_CONFIG } from './config.js';

// משתנים לשמירת הנתונים (בין אם הגיעו מקומית ובין אם מה-AI)
let currentEngines = [];
let currentTrims = [];

let score = 100;
let defects = [];

document.addEventListener('DOMContentLoaded', () => {
    setupListeners();
});

function setupListeners() {
    // מאזינים לפתיחת תפריטים
    ['brand', 'model', 'year', 'engine', 'trim'].forEach(type => {
        document.getElementById(`${type}-trigger`).addEventListener('click', () => openPicker(type));
    });

    // חיפוש
    document.getElementById('brand-search').addEventListener('keyup', (e) => filterGrid('brand', e.target.value));
    document.getElementById('model-search').addEventListener('keyup', (e) => filterGrid('model', e.target.value));

    // כפתורים
    document.getElementById('btn-ai').addEventListener('click', startAnalysis);
    document.getElementById('btn-skip').addEventListener('click', goToChecklist);
    document.getElementById('btn-finish').addEventListener('click', finishCheck);
    document.getElementById('btn-restart').addEventListener('click', () => location.reload());

    // סגירה בלחיצה בחוץ
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
    
    // מילוי הנתונים רק אם הגריד ריק
    if (grid.children.length > 0 && type !== 'engine' && type !== 'trim') return;
    
    // ניקוי לפני מילוי (חשוב למנועים וגימורים שמשתנים)
    if(type === 'engine' || type === 'trim') grid.innerHTML = '';

    if (type === 'brand') {
        Object.keys(CAR_DATA).sort().forEach(b => createItem(grid, b, 'brand'));
    }
    else if (type === 'model') {
        const selectedBrand = document.getElementById('val-b').value;
        if(CAR_DATA[selectedBrand]) {
            CAR_DATA[selectedBrand].models.forEach(m => createItem(grid, m, 'model'));
        }
    }
    else if (type === 'year') {
        if (grid.children.length === 0) { 
            for(let y=2026; y>=2008; y--) createItem(grid, y, 'year'); 
        }
    }
    else if (type === 'engine') {
        // משתמשים במשתנה הגלובלי (שכבר מולא או מהמקומי או מה-AI)
        if(currentEngines.length > 0) {
            currentEngines.forEach(e => createItem(grid, e, 'engine'));
        } else {
            grid.innerHTML = '<div style="color:white; grid-column:span 2; text-align:center;">טוען נתונים...</div>';
        }
    }
    else if (type === 'trim') {
        if(currentTrims.length > 0) {
            currentTrims.forEach(t => createItem(grid, t, 'trim'));
        } else {
            grid.innerHTML = '<div style="color:white; grid-column:span 2; text-align:center;">טוען נתונים...</div>';
        }
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

async function selectValue(type, val) {
    document.getElementById(`val-${type.charAt(0)}`).value = val;
    document.getElementById(`${type}-trigger`).querySelector('span').innerText = val;
    document.getElementById(`${type}-popup`).classList.remove('active');

    // לוגיקת השרשרת
    if(type === 'brand') { 
        reset('model'); reset('year'); reset('engine'); reset('trim'); 
        document.getElementById('model-grid').innerHTML=''; 
        enable('model'); 
    }
    else if(type === 'model') { 
        reset('year'); reset('engine'); reset('trim'); 
        enable('year'); 
    }
    else if(type === 'year') { 
        // === כאן הלוגיקה ההיברידית החדשה ===
        reset('engine'); reset('trim');
        await handleEngineDataFetch(); 
    }
    else if(type === 'engine') { 
        reset('trim'); 
        enable('trim'); 
        openPicker('trim'); // פתיחה אוטומטית לגימור
    }
    
    checkForm();
}

// === הפונקציה החכמה: מחליטה אם לקחת מקומית או מה-AI ===
async function handleEngineDataFetch() {
    const brand = document.getElementById('val-b').value;
    
    // בדיקה: האם המידע קיים אצלנו בקובץ?
    const localData = CAR_DATA[brand];

    if (localData && localData.engines && localData.engines.length > 0) {
        console.log("Using LOCAL data 🏠");
        // יש מידע מקומי! משתמשים בו ולא פונים לשרת
        currentEngines = localData.engines;
        currentTrims = localData.trims || ["בסיסי", "מפואר"]; // ברירת מחדל אם אין גימורים
        
        enable('engine');
        openPicker('engine');
    } else {
        console.log("Data missing locally, calling AI 🤖");
        // אין מידע מקומי - פונים ל-AI
        await fetchSpecsFromAI();
    }
}

// פונקציה שפונה לשרת (רק כשאין ברירה)
async function fetchSpecsFromAI() {
    const brand = document.getElementById('val-b').value;
    const model = document.getElementById('val-m').value;
    const year = document.getElementById('val-y').value;

    const loader = document.getElementById('loader');
    const loaderText = document.getElementById('loader-text');
    loaderText.innerText = `🔄 המערכת לומדת את ה-${model}...`; // טקסט מגניב למשתמש
    loader.style.display = 'flex';

    try {
        const res = await fetch('/get-specs', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ brand, model, year })
        });
        const json = await res.json();
        
        if(json.success && json.data) {
            currentEngines = json.data.engines || [];
            currentTrims = json.data.trims || [];
            
            enable('engine');
            openPicker('engine');
        }
    } catch(e) {
        console.error(e);
        // Fallback חירום למקרה שהשרת נפל
        currentEngines = ["בנזין", "היברידי"];
        currentTrims = ["רגיל"];
        enable('engine');
    } finally {
        loader.style.display = 'none';
    }
}

function enable(id) { document.getElementById(`${id}-trigger`).classList.remove('disabled'); }

function reset(id) { 
    document.getElementById(`val-${id.charAt(0)}`).value = '';
    const el = document.getElementById(`${id}-trigger`);
    el.classList.add('disabled');
    
    let text = 'בחר...';
    if(id === 'engine') text = '🔌 בחר מנוע...';
    if(id === 'trim') text = '✨ בחר גימור...';
    
    el.querySelector('span').innerText = text;
}

function filterGrid(type, query) {
    const grid = document.getElementById(`${type}-grid`);
    const items = grid.getElementsByClassName('grid-item');
    for (let item of items) {
        item.style.display = item.innerText.toLowerCase().includes(query.toLowerCase()) ? 'flex' : 'none';
    }
}

function checkForm() {
    const b = document.getElementById('val-b').value;
    const m = document.getElementById('val-m').value;
    const y = document.getElementById('val-y').value;
    const e = document.getElementById('val-e').value;
    const t = document.getElementById('val-t').value;
    document.getElementById('btn-ai').disabled = !(b && m && y && e && t);
}

// ניתוח סופי (תמיד הולך ל-AI כי זה מצריך "חשיבה")
async function startAnalysis() {
    const b = document.getElementById('val-b').value;
    const m = document.getElementById('val-m').value;
    const y = document.getElementById('val-y').value;
    const e = document.getElementById('val-e').value;
    const t = document.getElementById('val-t').value;

    document.getElementById('loader').style.display = 'flex';
    document.getElementById('loader-text').innerText = '🤖 המוסכניק מנתח את הרכב...';
    document.getElementById('btn-ai').disabled = true;

    try {
        const res = await fetch('/analyze-ai', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ brand:b, model:m, year:y, engine:e, trim:t })
        });
        const data = await res.json();
        if(data.success) renderAI(data.aiAnalysis);
    } catch(err) {
        alert("שגיאת תקשורת");
    } finally {
        document.getElementById('loader').style.display = 'none';
        document.getElementById('btn-ai').disabled = false;
    }
}

function renderAI(ai) {
    const p = document.getElementById('ai-panel');
    p.style.display = 'block';
    
    const pros = (ai.pros || []).map(x => `<li>${x}</li>`).join('');
    const faults = (ai.common_faults || []).map(x => `<li>${x}</li>`).join('');

    p.innerHTML = `
        <div style="background:var(--card-bg); padding:20px; border-radius:20px; border:1px solid var(--accent); animation: slideUp 0.5s;">
            <div style="text-align:center; font-size:45px; font-weight:900; color:var(--accent);">${ai.reliability_score}</div>
            <p style="text-align:center; font-size:15px; color:var(--text-muted);">${ai.summary}</p>
            <div style="margin-top:15px; text-align:right;">
                <b style="color:var(--success)">✅ יתרונות:</b>
                <ul style="font-size:13px; color:#cbd5e1; padding-right:20px;">${pros}</ul>
                <b style="color:var(--danger)">❌ תקלות נפוצות:</b>
                <ul style="font-size:13px; color:#cbd5e1; padding-right:20px;">${faults}</ul>
            </div>
            <button id="btn-continue-check" class="btn-main" style="margin-top:20px;">המשך לבדיקת שטח 🏁</button>
        </div>
    `;
    p.scrollIntoView({behavior:'smooth'});
    document.getElementById('btn-continue-check').addEventListener('click', goToChecklist);
}

// === פונקציות הצ'קליסט והבדיקה הסופית ===
// (העתקתי אותן לפה כדי שיהיה לך קובץ אחד שלם ותקין)

function goToChecklist() {
    document.getElementById('screen-input').style.display = 'none';
    document.getElementById('screen-check').style.display = 'block';
    const container = document.getElementById('checklist-content');
    container.innerHTML = '';
    
    CHECKLIST_CONFIG.forEach((cat, cIdx) => {
        const header = document.createElement('div');
        header.className = 'category-header';
        header.innerHTML = `<span class="category-title">${cat.category}</span>`;
        container.appendChild(header);

        cat.items.forEach((item, iIdx) => {
            const id = `cb-${cIdx}-${iIdx}`;
            
            const itemDiv = document.createElement('div');
            itemDiv.className = 'check-item';
            itemDiv.innerHTML = `
                <div class="check-item-header">
                    <div style="display:flex; align-items:center; gap:12px;">
                        <div class="info-btn" id="info-${id}">i</div>
                        <span style="font-weight:600;">${item.name}</span>
                    </div>
                    <div id="${id}" class="cb-custom"></div>
                </div>
                <div id="how-${id}" class="how-to-box">${item.howTo}<br>
                    <span style="color:var(--success)">✅ ${item.ok}</span> | <span style="color:var(--danger)">❌ ${item.notOk}</span>
                </div>`;
            container.appendChild(itemDiv);

            document.getElementById(`info-${id}`).addEventListener('click', () => {
                const h = document.getElementById(`how-${id}`);
                h.style.display = h.style.display === 'block' ? 'none' : 'block';
            });

            document.getElementById(id).addEventListener('click', () => toggleCheck(id, item.weight, item.name));
        });
    });
}

function toggleCheck(id, w, name) {
    const el = document.getElementById(id);
    if(el.classList.contains('bad')) {
        el.classList.remove('bad'); score += w; defects = defects.filter(d => d !== name);
    } else {
        el.classList.add('bad'); score -= w; defects.push(name);
    }
}

function finishCheck() {
    document.getElementById('screen-check').style.display = 'none';
    document.getElementById('screen-result').style.display = 'block';
    
    const final = Math.max(0, score);
    const gauge = document.getElementById('final-gauge');
    gauge.innerText = final;
    
    let color = "var(--danger)";
    let status = "לא לגעת! ❌";
    
    if (final > 85) { color = "var(--success)"; status = "מצב מצוין! ✅"; }
    else if (final > 65) { color = "var(--plate-yellow)"; status = "דורש תיקון ⚠️"; }

    gauge.style.color = color; gauge.style.borderColor = color;
    document.getElementById('result-status').innerText = status;
    document.getElementById('result-status').style.color = color;
    
    const ul = document.getElementById('defects-ul');
    ul.innerHTML = '';
    if(defects.length > 0) {
        document.getElementById('defects-container').style.display = 'block';
        defects.forEach(d => {
            const li = document.createElement('li');
            li.innerText = d;
            ul.appendChild(li);
        });
    }
}

