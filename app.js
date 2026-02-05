// נתונים בסיסיים להתחלה
const carData = {
    "טויוטה": ["קורולה", "יאריס", "RAV4", "לנד קרוזר", "C-HR", "פריוס", "קאמרי", "היילקס"],
    "יונדאי": ["i10", "i20", "טוסון", "איוניק 5", "איוניק 6", "אלנטרה", "קונה", "סנטה פה"],
    "קיה": ["פיקנטו", "ספורטאז'", "נירו", "סטוניק", "סלטוס", "סורנטו", "EV6"],
    "מאזדה": ["2", "3", "CX-5", "CX-30", "6", "CX-9"],
    "סקודה": ["אוקטביה", "קודיאק", "קאמיק", "קארוק", "סופרב", "פאביה"],
    "טסלה": ["Model 3", "Model Y", "Model S", "Model X"],
    "BYD": ["Atto 3", "Dolphin", "Seal", "Tang"],
    "סוזוקי": ["סוויפט", "ויטארה", "ג'ימני", "קרוסאובר", "איגניס"]
};

const checklistData = [
    { 
        category: "🔩 מנוע ותא מנוע (קריטי)", 
        items: [
            { name: "🛢️ פקק שמן (טחינה)", weight: 25, howTo: "פתחו את פקק השמן. חפשו קצף לבן דמוי חומוס.", ok: "נקי", notOk: "קצף לבן (חשד לראש מנוע)" },
            { name: "🫧 בועות במיכל עיבוי", weight: 25, howTo: "מנוע עובד - יש בועות אוויר במים?", ok: "שקט", notOk: "בועות (בריחת קומפרסיה)" },
            { name: "🌬️ נשימת מנוע", weight: 20, howTo: "פתחו פקק שמן בזמן עבודה. האם יוצא לחץ חזק?", ok: "תקין", notOk: "לחץ חזק מאוד (בלאי מנוע)" },
            { name: "💧 נזילות טריות", weight: 15, howTo: "חפשו רטיבות שמן או מים סביב המנוע.", ok: "יבש", notOk: "נזילה פעילה" }
        ]
    },
    { 
        category: "⚙️ גיר ומערכת הנעה", 
        items: [
            { name: "🥊 מכות בשילוב", weight: 20, howTo: "העבירו P-D-R. האם יש מכה?", ok: "חלק", notOk: "מכה חזקה" },
            { name: "⛸️ החלקת הילוכים", weight: 25, howTo: "בנסיעה - גז חזק. הטורים קופצים ללא האצה?", ok: "מאיץ", notOk: "מחליק" }
        ]
    }
];

let aiEngines = [];
let aiTrims = [];
let score = 100;
let defects = [];

// אתחול בעליית הדף
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
    document.getElementById('btn-ai').addEventListener('click', startAI);
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
    // אם הכפתור כבוי לא עושים כלום
    if(document.getElementById(`${type}-trigger`).classList.contains('disabled')) return;

    document.querySelectorAll('.popup-grid').forEach(p => p.classList.remove('active'));
    document.getElementById(type + '-popup').classList.add('active');
    
    const grid = document.getElementById(type + '-grid');
    
    // מילוי הנתונים
    if (type === 'brand' && grid.children.length === 0) {
        Object.keys(carData).sort().forEach(b => createItem(grid, b, 'brand'));
    }
    else if (type === 'model' && grid.children.length === 0) {
        const selectedBrand = document.getElementById('val-b').value;
        if(carData[selectedBrand]) {
            carData[selectedBrand].forEach(m => createItem(grid, m, 'model'));
        }
    }
    else if (type === 'year' && grid.children.length === 0) {
        for(let y=2026; y>=2008; y--) createItem(grid, y, 'year');
    }
    else if (type === 'engine') {
        grid.innerHTML = '';
        if(aiEngines.length > 0) aiEngines.forEach(e => createItem(grid, e, 'engine'));
        else grid.innerHTML = '<div style="color:white; grid-column:span 2; text-align:center;">טוען נתונים...</div>';
    }
    else if (type === 'trim') {
        grid.innerHTML = '';
        if(aiTrims.length > 0) aiTrims.forEach(t => createItem(grid, t, 'trim'));
        else grid.innerHTML = '<div style="color:white; grid-column:span 2; text-align:center;">טוען נתונים...</div>';
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
    document.getElementById('val-' + type.charAt(0)).value = val;
    document.getElementById(type + '-trigger').querySelector('span').innerText = val;
    document.getElementById(type + '-popup').classList.remove('active');

    if(type === 'brand') { reset('model'); reset('year'); reset('engine'); reset('trim'); document.getElementById('model-grid').innerHTML=''; enable('model'); }
    else if(type === 'model') { reset('year'); reset('engine'); reset('trim'); enable('year'); }
    else if(type === 'year') { 
        // שליחה לשרת להביא מנועים
        reset('engine'); reset('trim'); 
        await fetchSpecs(); 
    }
    else if(type === 'engine') { reset('trim'); enable('trim'); }
    
    checkForm();
}

async function fetchSpecs() {
    const b = document.getElementById('val-b').value;
    const m = document.getElementById('val-m').value;
    const y = document.getElementById('val-y').value;

    const loader = document.getElementById('loader');
    const loaderText = document.getElementById('loader-text');
    loaderText.innerText = `🔄 מאתר מפרטים ל-${m}...`;
    loader.style.display = 'flex';

    try {
        const res = await fetch('/get-specs', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ brand:b, model:m, year:y })
        });
        const json = await res.json();
        
        if(json.success && json.data) {
            aiEngines = json.data.engines || [];
            aiTrims = json.data.trims || [];
            enable('engine');
            // פתיחה אוטומטית למנוע
            openPicker('engine');
        }
    } catch(e) {
        console.error(e);
        aiEngines = ["בנזין", "היברידי"];
        aiTrims = ["רגיל", "מפואר"];
        enable('engine');
    } finally {
        loader.style.display = 'none';
    }
}

function enable(id) { document.getElementById(id + '-trigger').classList.remove('disabled'); }
function reset(id) { 
    document.getElementById('val-' + id.charAt(0)).value = '';
    const el = document.getElementById(id + '-trigger');
    el.classList.add('disabled');
    el.querySelector('span').innerText = (id==='engine'?'🔌 בחר מנוע...':(id==='trim'?'✨ בחר גימור...':'בחר...'));
}

function filterGrid(type, query) {
    const grid = document.getElementById(type + '-grid');
    grid.innerHTML = '';
    
    let items = [];
    if(type === 'brand') items = Object.keys(carData);
    else if(type === 'model') items = carData[document.getElementById('val-b').value] || [];

    items.filter(i => i.toLowerCase().includes(query.toLowerCase())).forEach(i => createItem(grid, i, type));
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
async function startAI() {
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
    p.innerHTML = `
        <div style="background:var(--card-bg); padding:20px; border-radius:20px; border:1px solid var(--accent); animation: slideUp 0.5s;">
            <div style="text-align:center; font-size:45px; font-weight:900; color:var(--accent);">${ai.reliability_score}</div>
            <p style="text-align:center; font-size:15px; color:var(--text-muted);">${ai.summary}</p>
            <div style="margin-top:15px; text-align:right;">
                <b style="color:var(--success)">✅ יתרונות:</b>
                <ul style="font-size:13px; color:#cbd5e1; padding-right:20px;">${(ai.pros || []).map(x=>`<li>${x}</li>`).join('')}</ul>
                <b style="color:var(--danger)">❌ תקלות נפוצות:</b>
                <ul style="font-size:13px; color:#cbd5e1; padding-right:20px;">${(ai.common_faults || []).map(x=>`<li>${x}</li>`).join('')}</ul>
            </div>
            <button id="btn-continue" class="btn-main" style="margin-top:20px;">המשך לבדיקת שטח 🏁</button>
        </div>
    `;
    p.scrollIntoView({behavior:'smooth'});
    document.getElementById('btn-continue').addEventListener('click', goToChecklist);
}

function goToChecklist() {
    document.getElementById('screen-input').style.display = 'none';
    document.getElementById('screen-check').style.display = 'block';
    const container = document.getElementById('checklist-content');
    container.innerHTML = '';
    
    checklistData.forEach((cat, cIdx) => {
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

            // אירועים לצ'קליסט
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
    
    const color = final > 85 ? "var(--success)" : (final > 65 ? "var(--plate-yellow)" : "var(--danger)");
    gauge.style.color = color; gauge.style.borderColor = color;

    document.getElementById('result-status').innerText = final > 85 ? "רכב במצב מעולה! ✅" : (final > 65 ? "מצב סביר, דורש תיקון ⚠️" : "לא לגעת! סכנה ❌");
    
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
