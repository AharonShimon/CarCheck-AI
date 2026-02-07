import { CAR_DATA, CHECKLIST_CONFIG } from './config.js';

// --- משתנים גלובליים ---
let selection = { brand: '', model: '', year: '', engine: '', trim: '' };
let currentEngines = [];
let currentTrims = [];
let score = 100;
let totalCost = 0;
let defects = [];

// משתנים לסליידר (Tinder Mode) והיסטוריה לביצוע Undo
let flatChecklist = [];
let currentTaskIndex = 0;
let checkHistory = []; 

document.addEventListener('DOMContentLoaded', () => {
    setupListeners();
});

function setupListeners() {
    // 1. פתיחת תפריטים
    ['brand', 'model', 'year', 'engine', 'trim'].forEach(type => {
        const trigger = document.getElementById(`${type}-trigger`);
        if (trigger) {
            trigger.addEventListener('click', () => openPicker(type));
        }
    });

    // 2. חיפוש חופשי וסינון
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

// --- לוגיקת בחירת רכב (כולל הקלדה חופשית) ---
function openPicker(type) {
    const trigger = document.getElementById(`${type}-trigger`);
    if (!trigger || trigger.classList.contains('disabled')) return;
    
    document.querySelectorAll('.popup-grid').forEach(p => p.classList.remove('active'));
    
    const popup = document.getElementById(`${type}-popup`);
    if (popup) popup.classList.add('active');
    
    const grid = document.getElementById(`${type}-grid`);
    if (!grid) return;

    grid.innerHTML = '';
    let items = [];

    if (type === 'brand') items = Object.keys(CAR_DATA).sort();
    else if (type === 'model') items = CAR_DATA[selection.brand]?.models || [];
    else if (type === 'year') for(let y = 2026; y >= 2008; y--) items.push(y.toString());
    else if (type === 'engine') items = currentEngines;
    else if (type === 'trim') items = currentTrims;

    // אם אין דאטה מובנה, עדיין ננקה את הגריד כדי לאפשר הקלדה חופשית
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
    const trigger = document.getElementById(`${type}-trigger`);
    if (trigger) {
        const span = trigger.querySelector('span');
        if (span) span.innerText = val;
    }
    
    const popup = document.getElementById(`${type}-popup`);
    if (popup) popup.classList.remove('active');

    // Cascade (הפעלה מדורגת) - מעודכן לתמיכה בערכים שאינם בדאטה
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
        
        // טוען רשימות אם קיימות, אחרת משאיר ריק להקלדה חופשית
        currentEngines = brandData?.engines || [];
        currentTrims = brandData?.trims || [];
        
        enableField('engine'); 
        setTimeout(() => openPicker('engine'), 100);
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
    const trigger = document.getElementById(`${id}-trigger`);
    if (trigger) {
        if (id !== 'engine' && id !== 'trim') trigger.classList.add('disabled');
        const span = trigger.querySelector('span');
        if (span) span.innerText = id === 'engine' ? '🔌 לשיפור הדיוק...' : id === 'trim' ? '✨ לשיפור הדיוק...' : 'בחר...';
    }
}

// פונקציית חיפוש המאפשרת הקלדה חופשית (Add Custom Item)
function filterGrid(type, query) {
    const grid = document.getElementById(`${type}-grid`);
    if (!grid) return;
    
    const items = grid.children;
    let matchFound = false;
    const cleanQuery = query.trim();

    // ניקוי כפתורי "הוסף" קודמים
    const oldAddBtn = grid.querySelector('.add-custom-item');
    if (oldAddBtn) oldAddBtn.remove();

    for (let item of items) {
        if (item.classList.contains('no-results-msg')) {
            item.remove();
            continue;
        }
        const isMatch = item.innerText.toLowerCase().includes(cleanQuery.toLowerCase());
        item.style.display = isMatch ? 'block' : 'none';
        if (isMatch) matchFound = true;
    }

    // אם אין התאמה - הצגת כפתור "הוסף"
    if (!matchFound && cleanQuery !== "") {
        const addBtn = document.createElement('div');
        addBtn.className = 'add-custom-item'; // העיצוב נמצא ב-CSS שלך
        addBtn.innerHTML = `הוסף: "${cleanQuery}" <br> <span style="font-size:10px; opacity:0.7;">לחץ כאן לשימוש בערך זה</span>`;
        addBtn.onclick = (e) => {
            e.stopPropagation();
            selectValue(type, cleanQuery);
        };
        grid.appendChild(addBtn);
    }
}

function checkForm() {
    const hasBrand = selection.brand !== '';
    const hasModel = selection.model !== '';
    const btnAi = document.getElementById('btn-ai');
    const statusMsg = document.getElementById('ai-status-msg');

    if (hasBrand && hasModel) {
        btnAi.disabled = false;
        if (statusMsg) statusMsg.style.display = 'none';
    } else {
        btnAi.disabled = true;
        if (statusMsg) statusMsg.style.display = 'block';
    }
}

async function startAnalysis() {
    const loader = document.getElementById('loader');
    const loaderText = document.getElementById('loader-text');
    const isPrecise = selection.year !== '';
    
    if (loader) loader.style.display = 'flex';
    if (loaderText) loaderText.innerText = isPrecise ? `מפיק ניתוח מדויק לשנת ${selection.year}...` : "מפיק ניתוח כללי לדגם...";

    try {
        const res = await fetch('/analyze-ai', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ ...selection, isPrecise })
        });
        const data = await res.json();
        if(data.success) renderAI(data.aiAnalysis);
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
    }
}

function renderAI(ai) {
    const panel = document.getElementById('ai-panel');
    const badgeContainer = document.getElementById('ai-badge-container');
    const content = document.getElementById('ai-content');
    if (!panel || !badgeContainer || !content) return;

    const isPrecise = selection.year !== '';
    panel.style.display = 'block';

    badgeContainer.innerHTML = isPrecise 
        ? `<div class="ai-badge badge-precise">🧠 ניתוח AI מדויק – לשנת ${selection.year}</div>`
        : `<div class="ai-badge badge-general">🧠 ניתוח AI כללי – כל הגרסאות</div>`;

    content.innerHTML = `
        <div style="font-size:40px; font-weight:900; color:var(--accent); text-align:center; margin-bottom:10px;">${ai.reliability_score}</div>
        <p style="text-align:center; color:#cbd5e1; line-height:1.5; margin-bottom:20px;">${ai.summary}</p>
        
        ${!isPrecise ? `
            <div class="ai-warning-box">
                <p>המידע מתייחס למגוון שנות ייצור ומנועים. ייתכנו הבדלים בין גרסאות.</p>
                <button onclick="window.scrollToField('year')" class="btn-text-link">רוצה ניתוח מדויק יותר? בחר שנת ייצור</button>
            </div>
        ` : ''}

        <div style="margin-top:20px; border-top:1px solid rgba(255,255,255,0.1); padding-top:15px;">
            <strong style="color:var(--success)">✅ יתרונות:</strong> ${ai.pros.join(', ')}<br>
            <strong style="color:var(--danger); margin-top:8px; display:inline-block;">❌ תקלות נפוצות:</strong> ${ai.common_faults.join(', ')}
        </div>
    `;
    panel.scrollIntoView({behavior:'smooth'});
}

window.scrollToField = (id) => {
    const trigger = document.getElementById(`${id}-trigger`);
    if (trigger) {
        trigger.scrollIntoView({ behavior: 'smooth', block: 'center' });
        trigger.classList.add('highlight-pulse');
        setTimeout(() => trigger.classList.remove('highlight-pulse'), 2500);
    }
};

// =========================================================
// לוגיקת הסליידר (Tinder Mode)
// =========================================================

function startSliderChecklist() {
    document.getElementById('screen-input').style.display = 'none';
    document.getElementById('screen-check').style.display = 'block';
    window.scrollTo(0,0);
    
    flatChecklist = [];
    checkHistory = []; // איפוס היסטוריה
    
    CHECKLIST_CONFIG.forEach(cat => {
        cat.items.forEach(item => flatChecklist.push({ ...item, category: cat.category }));
    });
    
    currentTaskIndex = 0;
    score = 100;
    totalCost = 0;
    defects = [];
    renderCard();
}

function renderCard() {
    const container = document.getElementById('checklist-content');
    if (!container) return;
    
    if (currentTaskIndex >= flatChecklist.length) {
        finishCheck();
        return;
    }

    const item = flatChecklist[currentTaskIndex];
    const progress = Math.round(((currentTaskIndex + 1) / flatChecklist.length) * 100);
    const actionSteps = item.action.split(/(?=🔎|⚠️|🖐️)/g); 

    container.innerHTML = `
        <div class="progress-bar-container">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <div class="progress-text">בדיקה ${currentTaskIndex + 1} מתוך ${flatChecklist.length}</div>
                ${currentTaskIndex > 0 ? `<button class="btn-undo" onclick="window.undoLastStep()" style="background:rgba(255,255,255,0.05); border:1px solid var(--card-border); color:var(--text-muted); padding:5px 12px; border-radius:10px; font-size:12px; cursor:pointer;">↩️ חזור</button>` : '<div></div>'}
            </div>
            <div class="progress-track"><div class="progress-fill" style="width:${progress}%"></div></div>
        </div>

        <div id="active-card" class="task-card slide-in" style="position:relative;">
            <div style="position:absolute; top:20px; left:20px; background:rgba(239,68,68,0.1); color:var(--danger); padding:4px 10px; border-radius:8px; font-size:11px; font-weight:800; border:1px solid rgba(239,68,68,0.2);">
                ליקוי: ~₪${item.cost.toLocaleString()}
            </div>

            <div>
                <span class="category-label">${item.category}</span>
                <h4 style="font-size: 22px; margin: 10px 0 20px 0;">${item.name}</h4>
                
                <div class="instruction-box">
                    <div style="display:flex; gap:12px; margin-bottom:12px;">
                        <div style="font-size:20px; background:var(--bg-deep); width:32px; height:32px; display:flex; align-items:center; justify-content:center; border-radius:10px;">📍</div>
                        <div style="font-size:15px; color:#e2e8f0;"><strong style="color:var(--accent); display:block; font-size:13px;">איפה בודקים?</strong> ${item.location}</div>
                    </div>
                    
                    <div style="border-top: 1px solid rgba(255,255,255,0.05); padding-top: 15px;">
                        <strong style="color:var(--accent); display:block; margin-bottom:8px; font-size:13px;">📋 איך בודקים?</strong>
                        <div style="font-size:14px; line-height:1.6; color:#e2e8f0;">
                            ${actionSteps.map(step => `<div style="margin-bottom:8px; padding:8px; background:rgba(255,255,255,0.02); border-radius:8px;">${step.trim()}</div>`).join('')}
                        </div>
                    </div>
                </div>
            </div>

            <div class="buttons-row" style="display:flex; gap:12px; margin-top:20px;">
                <button class="btn-decision btn-good" style="flex:1;" onclick="window.handleSwipe(true)">✅ תקין</button>
                <button class="btn-decision btn-bad" style="flex:1;" onclick="window.handleSwipe(false)">❌ תקלה</button>
            </div>
        </div>
    `;
}

window.handleSwipe = (isGood) => {
    const item = flatChecklist[currentTaskIndex];
    
    // שמירת המצב הנוכחי להיסטוריה לפני השינוי
    checkHistory.push({
        scoreBefore: score,
        costBefore: totalCost,
        defectsBefore: [...defects],
        index: currentTaskIndex
    });

    if (!isGood) {
        score -= item.weight;
        totalCost += item.cost;
        defects.push({ name: item.name, cost: item.cost });
    }

    const card = document.getElementById('active-card');
    card.classList.add(isGood ? 'slide-out-right' : 'slide-out-left');

    setTimeout(() => {
        currentTaskIndex++;
        renderCard();
    }, 300);
};

// פונקציית ביטול צעד אחרון (Undo)
window.undoLastStep = () => {
    if (checkHistory.length === 0) return;
    
    const lastState = checkHistory.pop();
    score = lastState.scoreBefore;
    totalCost = lastState.costBefore;
    defects = lastState.defectsBefore;
    currentTaskIndex = lastState.index;
    
    renderCard();
};

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
                    <span style="color:var(--plate-yellow); font-weight:bold;">₪${d.cost.toLocaleString()}</span>
                </li>`;
            });
            ul.innerHTML += `<div style="margin-top:20px; border-top:2px solid var(--card-border); padding-top:15px; font-weight:900; font-size:20px; display:flex; justify-content:space-between;">
                <span>סה"כ ליישור קו:</span>
                <span id="total-cost-display" style="color:var(--danger)">₪${totalCost.toLocaleString()}</span>
            </div>`;
        } else {
            container.style.display = 'none';
        }
    }
}
