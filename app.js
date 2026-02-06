import { CAR_DATA, CHECKLIST_CONFIG } from './config.js';

// --- משתנים גלובליים ---
let selection = { brand: '', model: '', year: '', engine: '', trim: '' };
let currentEngines = [];
let currentTrims = [];
let score = 100;
let totalCost = 0;
let defects = [];

// משתנים לסליידר (טינדר)
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

    // 2. חיפוש חופשי - עובד ליצרן, דגם, מנוע וגימור
    ['brand', 'model', 'engine', 'trim'].forEach(type => {
        const searchInput = document.getElementById(`${type}-search`);
        if (searchInput) {
            searchInput.addEventListener('keyup', (e) => filterGrid(type, e.target.value));
        }
    });

    // 3. כפתורי פעולה במסך הראשון
    const btnAi = document.getElementById('btn-ai');
    if (btnAi) btnAi.addEventListener('click', startAnalysis);
    
    const btnSkip = document.getElementById('btn-skip');
    const btnContinueAi = document.getElementById('btn-continue-ai');
    
    if (btnSkip) btnSkip.addEventListener('click', startSliderChecklist);
    if (btnContinueAi) btnContinueAi.addEventListener('click', startSliderChecklist);

    // 4. כפתורי מסך תוצאות
    const btnShare = document.getElementById('btn-share');
    if (btnShare) {
        btnShare.addEventListener('click', () => {
            window.open("https://www.waze.com/ul?q=מכון%20בדיקת%20רכב", "_blank");
        });
    }
    
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
    const trigger = document.getElementById(`${type}-trigger`);
    if (!trigger || trigger.classList.contains('disabled')) return;
    
    // סגירת פופאפים פתוחים
    document.querySelectorAll('.popup-grid').forEach(p => p.classList.remove('active'));
    
    const popup = document.getElementById(`${type}-popup`);
    if (popup) popup.classList.add('active');
    
    const grid = document.getElementById(`${type}-grid`);
    if (!grid) return;

    // ניקוי ומילוי מחדש כדי להבטיח נתונים מעודכנים
    grid.innerHTML = '';
    let items = [];

    if (type === 'brand') {
        items = Object.keys(CAR_DATA).sort();
    } 
    else if (type === 'model') {
        items = CAR_DATA[selection.brand]?.models || [];
    } 
    else if (type === 'year') {
        for(let y = 2026; y >= 2008; y--) items.push(y.toString());
    } 
    else if (type === 'engine') {
        items = currentEngines;
    } 
    else if (type === 'trim') {
        items = currentTrims;
    }

    if (items.length === 0) {
        grid.innerHTML = '<div style="color:var(--text-muted); grid-column:span 2; padding:20px; text-align:center;">טוען נתונים...</div>';
        return;
    }

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
    selection[type] = val;
    
    // עדכון שדה נסתר
    const hiddenInput = document.getElementById(`val-${type.charAt(0)}`);
    if (hiddenInput) hiddenInput.value = val;
    
    // עדכון טקסט הכפתור
    const trigger = document.getElementById(`${type}-trigger`);
    if (trigger) {
        const span = trigger.querySelector('span');
        if (span) span.innerText = val;
    }
    
    // סגירת הפופאפ
    const popup = document.getElementById(`${type}-popup`);
    if (popup) popup.classList.remove('active');

    // --- שרשרת הניקוי והפתיחה (Cascade) ---
    if (type === 'brand') { 
        resetField('model'); resetField('year'); resetField('engine'); resetField('trim'); 
        enableField('model'); 
    }
    else if (type === 'model') { 
        resetField('year'); resetField('engine'); resetField('trim'); 
        enableField('year'); 
    }
    else if (type === 'year') { 
        resetField('engine'); resetField('trim');
        const brandData = CAR_DATA[selection.brand];
        if (brandData) {
            currentEngines = brandData.engines || [];
            currentTrims = brandData.trims || [];
            enableField('engine'); 
            // פתיחה אוטומטית של השלב הבא
            setTimeout(() => openPicker('engine'), 100);
        }
    }
    else if (type === 'engine') { 
        resetField('trim'); 
        enableField('trim'); 
        setTimeout(() => openPicker('trim'), 100);
    }
    
    checkForm();
}

function enableField(id) {
    const el = document.getElementById(`${id}-trigger`);
    if (el) el.classList.remove('disabled');
}

function resetField(id) {
    selection[id] = '';
    const hidden = document.getElementById(`val-${id.charAt(0)}`);
    if (hidden) hidden.value = '';
    
    const trigger = document.getElementById(`${id}-trigger`);
    if (trigger) {
        trigger.classList.add('disabled');
        const span = trigger.querySelector('span');
        if (span) span.innerText = id === 'engine' ? '🔌 בחר מנוע...' : id === 'trim' ? '✨ בחר גימור...' : 'בחר...';
    }
    
    const grid = document.getElementById(`${id}-grid`);
    if (grid) grid.innerHTML = '';
}

function filterGrid(type, query) {
    const grid = document.getElementById(`${type}-grid`);
    if (!grid) return;
    const items = grid.children;
    for (let item of items) {
        item.style.display = item.innerText.toLowerCase().includes(query.toLowerCase()) ? 'block' : 'none';
    }
}

function checkForm() {
    const ready = Object.values(selection).every(v => v !== '');
    const btnAi = document.getElementById('btn-ai');
    if (btnAi) btnAi.disabled = !ready;
}

// --- AI Logic ---
async function startAnalysis() {
    const loader = document.getElementById('loader');
    const btnAi = document.getElementById('btn-ai');
    
    if (loader) loader.style.display = 'flex';
    if (btnAi) btnAi.disabled = true;

    try {
        const res = await fetch('/analyze-ai', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ ...selection, userNotes: "" })
        });
        const data = await res.json();
        
        if(data.success) {
            renderAI(data.aiAnalysis); // תוקן מ-AI ל-renderAI כדי להתאים לשם הפונקציה
        } else {
            throw new Error("AI request failed");
        }
    } catch(e) {
        console.error("AI Error:", e);
        renderAI({
            reliability_score: 85,
            summary: "לא ניתן להתחבר לשרת ה-AI כרגע. על פי נתוני עבר, מדובר בדגם אמין יחסית.",
            pros: ["שוק חלפים זמין", "אמינות מכאנית טובה"],
            common_faults: ["בלאי טבעי של מערכת הבלמים"]
        });
    } finally {
        if (loader) loader.style.display = 'none';
        if (btnAi) btnAi.disabled = false;
    }
}

function renderAI(ai) {
    const panel = document.getElementById('ai-panel');
    if (!panel) return;
    panel.style.display = 'block';
    
    document.getElementById('ai-content').innerHTML = `
        <div style="font-size:40px; font-weight:900; color:var(--accent); text-align:center;">${ai.reliability_score}</div>
        <p style="text-align:center; color:#cbd5e1; line-height:1.5;">${ai.summary}</p>
        <div style="margin-top:10px;">
            <strong style="color:var(--success)">✅ יתרונות:</strong> ${ai.pros.join(', ')}<br>
            <strong style="color:var(--danger); margin-top:5px; display:inline-block;">❌ תקלות נפוצות:</strong> ${ai.common_faults.join(', ')}
        </div>
    `;
    panel.scrollIntoView({behavior:'smooth'});
}

// =========================================================
// לוגיקת הסליידר (Tinder Mode)
// =========================================================

function startSliderChecklist() {
    document.getElementById('screen-input').style.display = 'none';
    document.getElementById('screen-check').style.display = 'block';
    window.scrollTo(0,0);

    // הופכים את ה-Config לרשימה אחת שטוחה של משימות
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
    if (!container) return;
    container.innerHTML = ''; 

    if (currentTaskIndex >= flatChecklist.length) {
        finishCheck();
        return;
    }

    const item = flatChecklist[currentTaskIndex];
    const progress = Math.round(((currentTaskIndex + 1) / flatChecklist.length) * 100);

    const html = `
        <div class="progress-bar-container">
            <div class="progress-text">בדיקה ${currentTaskIndex + 1} מתוך ${flatChecklist.length}</div>
            <div class="progress-track"><div class="progress-fill" style="width:${progress}%"></div></div>
        </div>

        <div id="active-card" class="task-card slide-in">
            <div>
                <span class="category-label">${item.category}</span>
                <div class="task-header">
                    <h4>${item.name}</h4>
                </div>
                
                <div class="instruction-box">
                    <div class="instruction-item">
                        <div class="icon">📍</div>
                        <div class="instruction-text">
                            <strong>איפה בודקים?</strong>
                            ${item.location}
                        </div>
                    </div>
                    <div class="instruction-item">
                        <div class="icon">🖐️</div>
                        <div class="instruction-text">
                            <strong>מה עושים?</strong>
                            ${item.action}
                        </div>
                    </div>
                </div>
            </div>

            <div class="buttons-row">
                <button class="btn-decision btn-good" onclick="window.handleSwipe(true)">
                    <span>✅ תקין</span>
                    <small style="font-size:10px; font-weight:normal; opacity:0.8;">נראה טוב</small>
                </button>
                <button class="btn-decision btn-bad" onclick="window.handleSwipe(false)">
                    <span>❌ תקלה</span>
                    <small style="font-size:10px; font-weight:normal; opacity:0.8;">דווח ליקוי</small>
                </button>
            </div>
        </div>
    `;

    container.innerHTML = `
        <div id="active-card" class="task-card slide-in">
            <div>
                <span class="category-label">${item.category}</span>
                <h4>${item.name}</h4>
                
                <div class="instruction-box">
                    <div class="instruction-item">
                        <div class="icon">📍</div>
                        <div class="instruction-text"><strong>איפה?</strong> ${item.location}</div>
                    </div>
                    
                    <div class="instruction-item">
                        <div class="icon">📋</div>
                        <div class="instruction-text">
                            <strong>צעדי בדיקה:</strong>
                            <ul style="margin:5px 0; padding-right:15px; font-size:14px; color:#e2e8f0;">
                                ${actionSteps.map(step => `<li style="margin-bottom:8px;">${step.trim()}</li>`).join('')}
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
            </div>
    `;
}

window.handleSwipe = (isGood) => {
    const card = document.getElementById('active-card');
    const item = flatChecklist[currentTaskIndex];

    if (isGood) {
        card.classList.add('slide-out-right');
    } else {
        card.classList.add('slide-out-left');
        // חישוב נזק ורישום תקלה
        score -= item.weight;
        totalCost += item.cost;
        defects.push({ name: item.name, cost: item.cost });
    }

    // המתנה לסיום האנימציה וטעינת הכרטיס הבא
    setTimeout(() => {
        currentTaskIndex++;
        renderCard();
    }, 300);
};

// --- מסך תוצאות סופי ---
function finishCheck() {
    document.getElementById('screen-check').style.display = 'none';
    document.getElementById('screen-result').style.display = 'block';
    window.scrollTo(0,0);

    const finalScore = Math.max(0, score);
    const gauge = document.getElementById('final-gauge');
    if (gauge) {
        gauge.innerText = finalScore;
        let color = finalScore > 85 ? "var(--success)" : (finalScore > 65 ? "var(--plate-yellow)" : "var(--danger)");
        gauge.style.color = color; 
        gauge.style.borderColor = color;
    }
    
    const statusEl = document.getElementById('result-status');
    if (statusEl) {
        statusEl.innerText = finalScore > 85 ? "רכב במצב מצוין! ✅" : (finalScore > 65 ? "יש ליקויים, דורש בדיקה מעמיקה ⚠️" : "לא לגעת! סכנה ❌");
    }

    const ul = document.getElementById('defects-ul');
    const container = document.getElementById('defects-container');
    if (ul && container) {
        ul.innerHTML = '';
        if(defects.length > 0) {
            container.style.display = 'block';
            defects.forEach(d => {
                ul.innerHTML += `<li style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid rgba(255,255,255,0.05);">
                    <span>${d.name}</span>
                    <span style="color:var(--plate-yellow); font-weight:bold;">₪${d.cost}</span>
                </li>`;
            });
            ul.innerHTML += `<div style="margin-top:20px; border-top:2px solid var(--card-border); padding-top:15px; font-weight:900; font-size:20px; display:flex; justify-content:space-between;">
                <span>סה"כ ליישור קו:</span>
                <span style="color:var(--danger)">₪${totalCost.toLocaleString()}</span>
            </div>`;
        } else {
            container.style.display = 'none';
        }
    }
}
