import { CAR_DATA, CHECKLIST_CONFIG } from './config.js';

// משתנים גלובליים לניהול מצב
let score = 100;
let defects = [];

// אתחול האפליקציה
document.addEventListener('DOMContentLoaded', () => {
    setupListeners();
});

function setupListeners() {
    // פתיחת פופ-אפים
    document.getElementById('brand-trigger').addEventListener('click', () => openPicker('brand'));
    document.getElementById('model-trigger').addEventListener('click', () => openPicker('model'));
    document.getElementById('year-trigger').addEventListener('click', () => openPicker('year'));
    document.getElementById('engine-trigger').addEventListener('click', () => openPicker('engine'));

    // חיפוש ברשימות
    document.getElementById('brand-search').addEventListener('keyup', (e) => filterGrid('brand', e.target.value));
    document.getElementById('model-search').addEventListener('keyup', (e) => filterGrid('model', e.target.value));

    // בדיקת תקינות טופס (להפעלת כפתור AI)
    document.getElementById('trim-input').addEventListener('input', checkForm);

    // כפתורים ראשיים
    document.getElementById('btn-ai').addEventListener('click', startAI);
    document.getElementById('btn-skip').addEventListener('click', goToChecklist);
    document.getElementById('btn-finish').addEventListener('click', finishCheck);

    // סגירת פופ-אפ בלחיצה בחוץ
    document.addEventListener('click', (e) => {
        if(!e.target.closest('.field-group')) {
            document.querySelectorAll('.popup-grid').forEach(p => p.classList.remove('active'));
        }
    });
}

// --- לוגיקת הפופ-אפים והנתונים ---

function openPicker(type) {
    // סגור את כל האחרים
    document.querySelectorAll('.popup-grid').forEach(p => p.classList.remove('active'));
    
    // אם השדה נעול - אל תפתח
    if(document.getElementById(`${type}-trigger`).classList.contains('disabled')) return;

    const popup = document.getElementById(`${type}-popup`);
    popup.classList.add('active');
    
    const grid = document.getElementById(`${type}-grid`);
    
    // מניעת טעינה כפולה (למעט מודלים שמשתנים)
    if (grid.children.length > 0 && type !== 'model' && type !== 'engine') return;

    grid.innerHTML = ''; // ניקוי לפני מילוי

    if (type === 'brand') {
        Object.keys(CAR_DATA).sort().forEach(b => createItem(grid, b, 'brand'));
    } 
    else if (type === 'model') {
        const selectedBrand = document.getElementById('val-b').value;
        if(selectedBrand && CAR_DATA[selectedBrand]) {
            CAR_DATA[selectedBrand].models.forEach(m => createItem(grid, m, 'model'));
        }
    } 
    else if (type === 'year') {
        for(let y = 2026; y >= 2008; y--) createItem(grid, y, 'year');
    }
    else if (type === 'engine') {
        const selectedBrand = document.getElementById('val-b').value;
        if(selectedBrand && CAR_DATA[selectedBrand]) {
            CAR_DATA[selectedBrand].engines.forEach(e => createItem(grid, e, 'engine'));
        }
    }
}

function createItem(grid, val, type) {
    const d = document.createElement('div');
    d.className = 'grid-item';
    d.innerText = val;
    d.addEventListener('click', (e) => {
        e.stopPropagation(); // מונע סגירה מיידית
        selectValue(type, val);
    });
    grid.appendChild(d);
}

function selectValue(type, val) {
    // שמירת הערך
    document.getElementById(`val-${type.charAt(0)}`).value = val;
    // עדכון התצוגה
    document.getElementById(`${type}-trigger`).querySelector('span').innerText = val;
    // סגירת הפופ-אפ
    document.getElementById(`${type}-popup`).classList.remove('active');

    // לוגיקת שרשרת (reset למה שתלוי בבחירה הזו)
    if(type === 'brand') {
        resetField('model');
        resetField('year');
        resetField('engine');
        enableField('model');
    }
    if(type === 'model') {
        resetField('year');
        resetField('engine');
        enableField('year');
    }
    if(type === 'year') {
        resetField('engine');
        enableField('engine');
    }

    checkForm();
}

function resetField(id) {
    document.getElementById(`val-${id.charAt(0)}`).value = '';
    document.getElementById(`${id}-trigger`).classList.add('disabled');
    document.getElementById(`${id}-trigger`).querySelector('span').innerText = 'בחר...';
}

function enableField(id) {
    document.getElementById(`${id}-trigger`).classList.remove('disabled');
}

function filterGrid(type, query) {
    const grid = document.getElementById(`${type}-grid`);
    const items = Array.from(grid.children);
    items.forEach(item => {
        const text = item.innerText.toLowerCase();
        item.style.display = text.includes(query.toLowerCase()) ? 'flex' : 'none';
    });
}

function checkForm() {
    const b = document.getElementById('val-b').value;
    const m = document.getElementById('val-m').value;
    const y = document.getElementById('val-y').value;
    const e = document.getElementById('val-e').value;
    
    // מפעיל את כפתור ה-AI רק אם הכל נבחר
    document.getElementById('btn-ai').disabled = !(b && m && y && e);
}

// --- לוגיקת AI ---
async function startAI() {
    const b = document.getElementById('val-b').value;
    const m = document.getElementById('val-m').value;
    const y = document.getElementById('val-y').value;
    const e = document.getElementById('val-e').value;
    const t = document.getElementById('trim-input').value;

    document.getElementById('loader').style.display = 'flex';
    document.getElementById('btn-ai').disabled = true;

    try {
        const res = await fetch('/analyze-ai', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ brand:b, model:m, year:y, engine:e, trim:t, faults: [] }) // שולח רשימת תקלות ריקה בשלב זה
        });
        const data = await res.json();
        
        if(data.success) {
            renderAI(data.aiAnalysis);
        } else {
            alert("שגיאה בניתוח הנתונים");
        }
    } catch(err) {
        alert("שגיאת תקשורת עם השרת");
        console.error(err);
    } finally {
        document.getElementById('loader').style.display = 'none';
        document.getElementById('btn-ai').disabled = false;
    }
}

function renderAI(ai) {
    const p = document.getElementById('ai-panel');
    p.style.display = 'block';
    
    // בניית ה-HTML של התוצאה בתוך הבועה
    let faultsHtml = ai.common_faults.map(f => `<li>${f}</li>`).join('');
    
    p.innerHTML = `
        <div style="background:var(--card-bg); padding:20px; border-radius:20px; border:1px solid var(--accent); animation: slideUp 0.5s;">
            <div style="text-align:center; font-size:45px; font-weight:900; color:var(--accent);">${ai.reliability_score}</div>
            <p style="text-align:center; font-size:15px; color:var(--text-muted);">${ai.summary}</p>
            <div style="margin-top:15px; text-align:right;">
                <b style="color:var(--danger)">⚠️ תקלות נפוצות ועלויות:</b>
                <ul style="font-size:13px; color:#cbd5e1; padding-right: 20px;">${faultsHtml}</ul>
                <div style="margin-top:10px; padding:10px; background:rgba(16, 185, 129, 0.1); border-radius:8px;">
                    <b style="color:var(--success)">💰 טיפ למו"מ:</b><br>
                    <span style="font-size:13px;">${ai.negotiation_tip}</span>
                </div>
            </div>
            <button id="btn-continue-check" class="btn-main" style="margin-top:20px;">המשך לבדיקת שטח 🏁</button>
        </div>
    `;
    
    // גלילה לתוצאה
    p.scrollIntoView({behavior:'smooth'});
    
    // חיבור הכפתור שנוצר דינמית
    document.getElementById('btn-continue-check').addEventListener('click', goToChecklist);
}

// --- צ'קליסט ---
function goToChecklist() {
    document.getElementById('screen-input').style.display = 'none';
    document.getElementById('screen-check').style.display = 'block';
    window.scrollTo(0, 0);

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
                <div id="how-${id}" class="how-to-box">
                    ${item.howTo}<br>
                    <span style="color:var(--danger)">חומרה: ${item.severity === 'critical' ? 'קריטית 🛑' : 'רגילה ⚠️'}</span>
                </div>`;
            
            container.appendChild(itemDiv);

            // אירועים
            itemDiv.querySelector(`#info-${id}`).addEventListener('click', () => toggleHow(id));
            itemDiv.querySelector(`#${id}`).addEventListener('click', () => toggleCheck(id, item));
        });
    });
}

function toggleHow(id) {
    const el = document.getElementById('how-' + id);
    el.style.display = el.style.display === 'block' ? 'none' : 'block';
}

function toggleCheck(id, item) {
    const el = document.getElementById(id);
    const isBad = el.classList.contains('bad');
    
    if(isBad) {
        // ביטול סימון
        el.classList.remove('bad');
        score += (item.severity === 'critical' ? 25 : 10); // החזרת ניקוד
        defects = defects.filter(d => d !== item.name);
    } else {
        // סימון תקלה
        el.classList.add('bad');
        score -= (item.severity === 'critical' ? 25 : 10); // הורדת ניקוד
        defects.push(item.name);
    }
}

function finishCheck() {
    document.getElementById('screen-check').style.display = 'none';
    document.getElementById('screen-result').style.display = 'block';
    
    const finalScore = Math.max(0, score);
    const gauge = document.getElementById('final-gauge');
    
    // אנימציית ספירה
    let current = 0;
    const timer = setInterval(() => {
        current += 2;
        if(current >= finalScore) {
            current = finalScore;
            clearInterval(timer);
        }
        gauge.innerText = current;
        
        // צבעים
        const color = current > 85 ? "var(--success)" : (current > 60 ? "var(--plate-yellow)" : "var(--danger)");
        gauge.style.color = color; 
        gauge.style.borderColor = color;
    }, 20);

    const statusText = finalScore > 85 ? "רכב במצב מעולה! ✅" : (finalScore > 60 ? "מצב סביר, דורש תיקון ⚠️" : "לא לגעת! סכנה ❌");
    document.getElementById('result-status').innerText = statusText;
    
    if(defects.length > 0) {
        document.getElementById('defects-container').style.display = 'block';
        document.getElementById('defects-ul').innerHTML = defects.map(d => `<li>${d}</li>`).join('');
    }
}
