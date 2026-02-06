import { CAR_DATA, CHECKLIST_CONFIG } from './config.js';

// משתנים גלובליים
let selection = { brand: '', model: '', year: '', engine: '', trim: '' };
let currentEngines = [];
let currentTrims = [];
let score = 100;
let totalCost = 0;
let defects = [];

// משתנים לסליידר
let flatChecklist = [];
let currentTaskIndex = 0;

document.addEventListener('DOMContentLoaded', () => {
    setupListeners();
});

function setupListeners() {
    // 1. פתיחת תפריטים (Popup)
    ['brand', 'model', 'year', 'engine', 'trim'].forEach(type => {
        const trigger = document.getElementById(`${type}-trigger`);
        if (trigger) {
            trigger.addEventListener('click', () => openPicker(type));
        }
    });

    // 2. חיפוש חופשי - עכשיו עובד לכל 4 השדות!
    ['brand', 'model', 'engine', 'trim'].forEach(type => {
        const searchInput = document.getElementById(`${type}-search`);
        if (searchInput) {
            searchInput.addEventListener('keyup', (e) => filterGrid(type, e.target.value));
        }
    });

    // 3. כפתורי פעולה
    const btnAi = document.getElementById('btn-ai');
    if (btnAi) btnAi.addEventListener('click', startAnalysis);
    
    // כפתור דילוג + כפתור המשך אחרי AI - שניהם מפעילים את הסליידר
    const btnSkip = document.getElementById('btn-skip');
    const btnContinueAi = document.getElementById('btn-continue-ai');
    
    if (btnSkip) btnSkip.addEventListener('click', startSliderChecklist);
    if (btnContinueAi) btnContinueAi.addEventListener('click', startSliderChecklist);

    // כפתור סיום (בתוך הסליידר הוא לא קיים, אבל נשאיר ליתר ביטחון)
    // הפיניש האמיתי קורה אוטומטית כשנגמרים הקלפים

    // כפתור שיתוף/נווט
    const btnShare = document.getElementById('btn-share');
    if (btnShare) {
        btnShare.addEventListener('click', () => {
            window.open("https://www.waze.com/ul?q=מכון%20בדיקת%20רכב", "_blank");
        });
    }
    
    // כפתור התחלה מחדש
    const btnRestart = document.getElementById('btn-restart');
    if (btnRestart) {
        btnRestart.addEventListener('click', () => location.reload());
    }

    // סגירת פופאפים בלחיצה בחוץ
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.field-group') && !e.target.closest('.popup-grid')) {
            document.querySelectorAll('.popup-grid').forEach(p => p.classList.remove('active'));
        }
    });
}

// --- לוגיקת בחירת רכב ---
function openPicker(type) {
    if(document.getElementById(`${type}-trigger`).classList.contains('disabled')) return;
    
    // סגירת פופאפים אחרים
    document.querySelectorAll('.popup-grid').forEach(p => p.classList.remove('active'));
    document.getElementById(`${type}-popup`).classList.add('active');
    
    const grid = document.getElementById(`${type}-grid`);
    
    // אם כבר יש תוכן (למשל מנועים), לא צריך לטעון מחדש אלא אם זה דינאמי
    if (grid.children.length > 0 && type !== 'engine' && type !== 'trim') return;
    
    grid.innerHTML = '';
    let items = [];

    // שליפת הנתונים הנכונים
    if (type === 'brand') items = Object.keys(CAR_DATA).sort();
    else if (type === 'model') items = CAR_DATA[selection.brand]?.models || [];
    else if (type === 'year') for(let y=2026; y>=2008; y--) items.push(y);
    else if (type === 'engine') items = currentEngines;
    else if (type === 'trim') items = currentTrims;

    // יצירת הכפתורים בגריד
    items.forEach(val => {
        const d = document.createElement('div');
        d.className = 'grid-item';
        d.innerText = val;
        d.onclick = (e) => { 
            e.stopPropagation(); 
            selectValue(type, val); 
        };
        grid.appendChild(d);
    });
}

function selectValue(type, val) {
    // עדכון המשתנה והתצוגה
    selection[type] = val;
    document.getElementById(`val-${type.charAt(0)}`).value = val;
    
    const triggerSpan = document.getElementById(`${type}-trigger`).querySelector('span');
    if(triggerSpan) triggerSpan.innerText = val;
    
    document.getElementById(`${type}-popup`).classList.remove('active');

    // שרשרת התלות (יצרן -> דגם -> שנה...)
    if(type === 'brand') { 
        reset('model'); reset('year'); reset('engine'); reset('trim'); 
        enable('model'); 
    }
    else if(type === 'model') { 
        reset('year'); reset('engine'); reset('trim'); 
        enable('year'); 
    }
    else if(type === 'year') { 
        reset('engine'); reset('trim');
        // טעינת מנועים וגימורים מהדאטה
        const data = CAR_DATA[selection.brand];
        currentEngines = data.engines || [];
        currentTrims = data.trims || [];
        enable('engine'); 
        openPicker('engine'); // פתיחה אוטומטית לנוחות
    }
    else if(type === 'engine') { 
        reset('trim'); 
        enable('trim'); 
        openPicker('trim'); 
    }
    
    checkForm();
}

function enable(id) { 
    document.getElementById(`${id}-trigger`).classList.remove('disabled'); 
}

function reset(id) { 
    selection[id] = '';
    const el = document.getElementById(`${id}-trigger`);
    el.classList.add('disabled'); 
    el.querySelector('span').innerText = 'בחר...';
}

function filterGrid(type, query) {
    const grid = document.getElementById(`${type}-grid`);
    const items = grid.children;
    for (let item of items) {
        item.style.display = item.innerText.toLowerCase().includes(query.toLowerCase()) ? 'block' : 'none';
    }
}

function checkForm() {
    const ready = Object.values(selection).every(v => v !== '');
    // שחרור כפתור ה-AI רק כשהכל מלא
    document.getElementById('btn-ai').disabled = !ready;
}

// --- AI Logic ---
async function startAnalysis() {
    const loader = document.getElementById('loader');
    const btnAi = document.getElementById('btn-ai');
    
    loader.style.display = 'flex';
    btnAi.disabled = true;

    try {
        const res = await fetch('/analyze-ai', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ ...selection, userNotes: "" }) // אין הערות ב-HTML הזה
        });
        const data = await res.json();
        
        if(data.success) {
            renderAI(data.aiAnalysis);
        } else {
            throw new Error("No success flag");
        }
    } catch(e) {
        console.error(e);
        // Fallback למקרה של תקלה
        renderAI({
            reliability_score: 85,
            summary: "לא ניתן להתחבר לשרת כרגע. הדגם נחשב אמין באופן כללי.",
            pros: ["רכב פופולרי", "חלפים זמינים"],
            common_faults: ["בלאי טבעי"]
        });
    } finally {
        loader.style.display = 'none';
        btnAi.disabled = false;
    }
}

function renderAI(ai) {
    const panel = document.getElementById('ai-panel');
    panel.style.display = 'block';
    
    document.getElementById('ai-content').innerHTML = `
        <div style="font-size:40px; font-weight:900; color:var(--accent); text-align:center;">${ai.reliability_score}</div>
        <p style="text-align:center; color:#cbd5e1;">${ai.summary}</p>
        <div style="margin-top:10px;">
            <strong style="color:var(--success)">✅ יתרונות:</strong> ${ai.pros.join(', ')}<br>
            <strong style="color:var(--danger)">❌ תקלות:</strong> ${ai.common_faults.join(', ')}
        </div>
    `;
    panel.scrollIntoView({behavior:'smooth'});
}


// =========================================================
// לוגיקת הסליידר (טינדר לרכבים)
// =========================================================

function startSliderChecklist() {
    document.getElementById('screen-input').style.display = 'none';
    document.getElementById('screen-check').style.display = 'block';
    window.scrollTo(0,0);

    // הופכים את הקטגוריות לרשימה שטוחה
    flatChecklist = [];
    CHECKLIST_CONFIG.forEach(cat => {
        cat.items.forEach(item => {
            flatChecklist.push({ ...item, category: cat.category });
        });
    });

    currentTaskIndex = 0;
    renderCard();
}

function renderCard() {
    const container = document.getElementById('checklist-content');
    container.innerHTML = ''; // ניקוי

    // אם סיימנו את כל הכרטיסים -> מסך תוצאות
    if (currentTaskIndex >= flatChecklist.length) {
        finishCheck();
        return;
    }

    const item = flatChecklist[currentTaskIndex];
    const progress = Math.round(((currentTaskIndex + 1) / flatChecklist.length) * 100);

    // יצירת ה-HTML של הכרטיס
    const html = `
        <div class="progress-bar-container">
            <div class="progress-text">בדיקה ${currentTaskIndex + 1} מתוך ${flatChecklist.length}</div>
            <div class="progress-bar"><div class="fill" style="width:${progress}%"></div></div>
        </div>

        <div id="active-card" class="task-card slide-in-animation">
            <div class="category-label" style="background:rgba(255,255,255,0.1); align-self:flex-start; padding:4px 8px; border-radius:4px; font-size:12px; margin-bottom:10px;">${item.category}</div>
            
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

    container.innerHTML = html;
}

// פונקציית ההחלקה (חובה להצמיד ל-window)
window.handleSwipe = (isGood) => {
    const card = document.getElementById('active-card');
    const item = flatChecklist[currentTaskIndex];

    if (isGood) {
        card.classList.add('slide-out-right'); // אנימציה ימינה
    } else {
        card.classList.add('slide-out-left'); // אנימציה שמאלה
        
        // חישוב נזק
        score -= item.weight;
        totalCost += item.cost;
        defects.push({ name: item.name, cost: item.cost });
    }

    // המתנה לאנימציה ואז טעינת הבא
    setTimeout(() => {
        currentTaskIndex++;
        renderCard();
    }, 300);
};

// --- מסך תוצאות ---
function finishCheck() {
    document.getElementById('screen-check').style.display = 'none';
    document.getElementById('screen-result').style.display = 'block';

    const final = Math.max(0, score);
    const gauge = document.getElementById('final-gauge');
    gauge.innerText = final;
    
    // צבע הציון
    let color = final > 85 ? "var(--success)" : (final > 65 ? "var(--plate-yellow)" : "var(--danger)");
    gauge.style.color = color; 
    gauge.style.borderColor = color;
    
    // סטטוס מילולי
    document.getElementById('result-status').innerText = final > 85 ? "רכב במצב טוב! ✅" : "יש ליקויים ⚠️";

    // רשימת תקלות
    const container = document.getElementById('defects-container');
    const ul = document.getElementById('defects-ul');
    ul.innerHTML = '';
    
    if(defects.length > 0) {
        container.style.display = 'block';
        defects.forEach(d => {
            ul.innerHTML += `<li>${d.name} <span style="float:left; color:#facc15">₪${d.cost}</span></li>`;
        });
        // שורת סיכום
        ul.innerHTML += `<div style="margin-top:15px; border-top:1px solid #555; padding-top:10px; font-weight:bold; font-size:18px;">
            סה"כ יישור קו: <span style="float:left; color:#ef4444">₪${totalCost.toLocaleString()}</span>
        </div>`;
    } else {
        container.style.display = 'none';
    }
}
