import { CAR_DATA, CHECKLIST_CONFIG } from './config.js';

// --- משתנים גלובליים ---
let selection = { brand: '', model: '', year: '', engine: '', trim: '' };
let currentEngines = [];
let currentTrims = [];
let score = 100;
let totalCost = 0;
let defects = [];

// משתנים ייחודיים לסליידר החדש
let flatChecklist = [];
let currentTaskIndex = 0;

// --- אתחול ---
document.addEventListener('DOMContentLoaded', () => {
    setupListeners();
});

function setupListeners() {
    // פתיחת תפריטים
    ['brand', 'model', 'year', 'engine', 'trim'].forEach(type => {
        document.getElementById(`${type}-trigger`).addEventListener('click', () => openPicker(type));
    });

    // חיפוש
   // חיפוש - עדכנו את הרשימה לכלול גם מנוע וגימור
    ['brand', 'model', 'engine', 'trim'].forEach(type => {
        const el = document.getElementById(`${type}-search`);
        if (el) {
            el.addEventListener('keyup', (e) => filterGrid(type, e.target.value));
        }
    });

    // כפתורים
    document.getElementById('btn-ai').addEventListener('click', startAnalysis);
    document.getElementById('btn-skip').addEventListener('click', goToChecklist); // זה מפעיל את הסליידר
    // אם יש לך כפתור "המשך" בפאנל AI:
    const btnContinue = document.getElementById('btn-continue');
    if(btnContinue) btnContinue.addEventListener('click', goToChecklist);

    document.getElementById('btn-finish').addEventListener('click', finishCheck);
    
    // כפתור Waze
    document.getElementById('btn-share').addEventListener('click', () => {
        window.open("https://www.waze.com/ul?q=מכון%20בדיקת%20רכב", "_blank");
    });

    document.getElementById('btn-restart').addEventListener('click', () => {
        location.reload();
    });

    // סגירת פופאפים
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.field-group') && !e.target.closest('.popup-grid')) {
            document.querySelectorAll('.popup-grid').forEach(p => p.classList.remove('active'));
        }
    });
}

// --- (כאן שים את כל פונקציות ה-Picker: openPicker, selectValue וכו' - הן לא השתנו) ---
// ... (אני מדלג עליהן כדי לא להעמיס, תשאיר אותן כמו שהן) ...

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

async function selectValue(type, val) {
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

// --- AI (נשאר אותו דבר) ---
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
    // וודא שכפתור ההמשך מחובר לפונקציה החדשה
    document.getElementById('btn-continue').onclick = goToChecklist; 
}


// ============================================================
// כאן נמצא הקוד החדש של הסליידר (במקום הלוגיקה הישנה)
// ============================================================

function goToChecklist() {
    document.getElementById('screen-input').style.display = 'none';
    document.getElementById('screen-check').style.display = 'block';
    window.scrollTo(0,0);
    
    // 1. הופכים את הקטגוריות לרשימה שטוחה אחת ארוכה
    flatChecklist = [];
    CHECKLIST_CONFIG.forEach(cat => {
        cat.items.forEach(item => {
            flatChecklist.push({ ...item, category: cat.category });
        });
    });

    // מתחילים מהקלף הראשון
    currentTaskIndex = 0;
    renderCurrentTask();
}

function renderCurrentTask() {
    const container = document.getElementById('checklist-content');
    container.innerHTML = ''; // מנקה את הקלף הקודם

    // אם סיימנו את כל הקלפים
    if (currentTaskIndex >= flatChecklist.length) {
        finishCheck();
        return;
    }

    const item = flatChecklist[currentTaskIndex];
    const progress = Math.round(((currentTaskIndex + 1) / flatChecklist.length) * 100);

    // יצירת ה-HTML של הקלף הבודד
    const cardHTML = `
        <div class="progress-bar-container">
            <div class="progress-text">בדיקה ${currentTaskIndex + 1} מתוך ${flatChecklist.length}</div>
            <div class="progress-bar"><div class="fill" style="width:${progress}%"></div></div>
        </div>

        <div id="active-card" class="task-card slide-in-animation">
            <div class="category-label" style="background:rgba(255,255,255,0.1); padding:2px 8px; border-radius:4px; font-size:12px; margin-bottom:5px;">${item.category}</div>
            <div class="task-header">
                <h4 class="task-title" style="font-size:22px; margin-top:5px;">${item.name}</h4>
            </div>
            
            <div class="task-details" style="min-height: 100px;">
                <div class="detail-row" style="margin-bottom:15px; font-size:16px;"><span class="icon">📍</span> ${item.location}</div>
                <div class="detail-row" style="font-size:16px;"><span class="icon">🖐️</span> ${item.action}</div>
            </div>

            <div class="buttons-row" style="margin-top:25px;">
                <button class="btn-decision btn-good" onclick="window.handleSwipe(true)">
                    <div style="font-size:20px;">✅ תקין</div>
                </button>
                <button class="btn-decision btn-bad" onclick="window.handleSwipe(false)">
                    <div style="font-size:20px;">❌ תקלה</div>
                </button>
            </div>
        </div>
    `;

    container.innerHTML = cardHTML;
}

// הפונקציה שמטפלת בהחלקה (במקום handleDecision הישנה)
window.handleSwipe = (isGood) => {
    const card = document.getElementById('active-card');
    const item = flatChecklist[currentTaskIndex];

    // 1. אנימציית יציאה
    if (isGood) {
        card.classList.add('slide-out-right'); // עף ימינה (חיובי)
    } else {
        card.classList.add('slide-out-left'); // עף שמאלה (שלילי)
        // חישוב נזק
        score -= item.weight;
        totalCost += item.cost;
        defects.push({ name: item.name, cost: item.cost });
    }

    // 2. המתנה קצרה לאנימציה ואז טעינת הקלף הבא
    setTimeout(() => {
        currentTaskIndex++;
        renderCurrentTask();
    }, 300);
};

// --- מסך תוצאות ---
function finishCheck() {
    document.getElementById('screen-check').style.display = 'none';
    document.getElementById('screen-result').style.display = 'block';
    
    const final = Math.max(0, score);
    const gauge = document.getElementById('final-gauge');
    gauge.innerText = final;
    
    let color = final > 85 ? "var(--success)" : (final > 65 ? "var(--plate-yellow)" : "var(--danger)");
    gauge.style.color = color; gauge.style.borderColor = color;
    document.getElementById('result-status').innerText = final > 85 ? "רכב במצב טוב! ✅" : "יש ליקויים משמעותיים ⚠️";

    const ul = document.getElementById('defects-ul');
    ul.innerHTML = '';
    
    if(defects.length > 0) {
        document.getElementById('defects-container').style.display = 'block';
        defects.forEach(d => {
            ul.innerHTML += `<li>${d.name} <span style="float:left; color:#facc15;">₪${d.cost}</span></li>`;
        });
        ul.innerHTML += `<div style="margin-top:15px; border-top:1px solid #555; padding-top:10px; font-weight:bold; font-size:18px;">
            סה"כ תיקונים: <span style="float:left; color:#ef4444;">₪${totalCost.toLocaleString()}</span>
        </div>`;
    } else {
        document.getElementById('defects-container').style.display = 'none';
    }
}
