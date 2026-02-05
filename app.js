import { CAR_DATA, CHECKLIST_CONFIG } from './config.js';

// אלמנטים של ה-UI
const screens = document.querySelectorAll('.step-card');
const brandSelect = document.getElementById('brand-select');
const modelSelect = document.getElementById('model-select');
const engineSelect = document.getElementById('engine-select');
const trimSelect = document.getElementById('trim-select');
const checklistContent = document.getElementById('checklist-content');

// משתנה לשמירת הנתונים שנבחרו
let currentSelection = {};

// 1. אתחול האפליקציה
function init() {
    // מילוי יצרנים
    Object.keys(CAR_DATA).forEach(brand => {
        brandSelect.add(new Option(brand, brand));
    });

    // מאזינים לשינויים בבחירה
    brandSelect.addEventListener('change', handleBrandChange);
    modelSelect.addEventListener('change', handleModelChange);
    
    // כפתור מעבר לצ'קליסט
    document.getElementById('to-checklist-btn').addEventListener('click', () => showScreen(1));
    
    // כפתור שליחה ל-AI
    document.getElementById('analyze-ai-btn').addEventListener('click', startAiAnalysis);
}

// 2. פתרון באג "הדגמים שנתקעים" - ניקוי ועדכון
function handleBrandChange() {
    const brand = brandSelect.value;
    
    // איפוס מוחלט של כל הסלקטורים הבאים
    modelSelect.innerHTML = '<option value="">בחר דגם...</option>';
    engineSelect.innerHTML = '<option value="">בחר מנוע...</option>';
    trimSelect.innerHTML = '<option value="">בחר גימור...</option>';
    
    modelSelect.disabled = !brand;
    engineSelect.disabled = true;
    trimSelect.disabled = true;

    if (brand) {
        CAR_DATA[brand].models.forEach(m => modelSelect.add(new Option(m, m)));
    }
}

function handleModelChange() {
    const brand = brandSelect.value;
    const model = modelSelect.value;

    if (brand && model) {
        // מילוי מנועים וגימורים לפי היצרן (מה-config)
        engineSelect.innerHTML = '<option value="">בחר מנוע...</option>';
        trimSelect.innerHTML = '<option value="">בחר גימור...</option>';
        
        CAR_DATA[brand].engines.forEach(e => engineSelect.add(new Option(e, e)));
        CAR_DATA[brand].trims.forEach(t => trimSelect.add(new Option(t, t)));
        
        engineSelect.disabled = false;
        trimSelect.disabled = false;
    }
}

// 3. ניהול מעבר בין מסכים
function showScreen(index) {
    screens.forEach(s => s.classList.remove('active'));
    screens[index].classList.add('active');
    
    if (index === 1) generateChecklist();
}

// 4. יצירת צ'קליסט דינמי עם הסברים (הדימויים שסיכמנו)
function generateChecklist() {
    checklistContent.innerHTML = ''; // ניקוי
    
    CHECKLIST_CONFIG.forEach(category => {
        const catHeader = document.createElement('h3');
        catHeader.innerText = category.category;
        catHeader.style.margin = "20px 0 10px 0";
        checklistContent.appendChild(catHeader);

        category.items.forEach(item => {
            const div = document.createElement('div');
            div.className = `check-item ${item.severity}`;
            div.innerHTML = `
                <input type="checkbox" id="${item.id}" class="car-check">
                <label for="${item.id}" style="flex:1; margin-right:10px;">${item.name}</label>
                <button class="info-btn" onclick="alert('${item.howTo}')">ℹ️</button>
            `;
            checklistContent.appendChild(div);
        });
    });
}

// 5. איסוף נתונים ושליחה לשרת (AI)
async function startAiAnalysis() {
    const brand = brandSelect.value;
    const model = modelSelect.value;
    const year = document.getElementById('year-select').value;
    
    // איסוף ליקויים שסומנו
    const faults = [];
    document.querySelectorAll('.car-check:checked').forEach(cb => {
        const label = cb.nextElementSibling.innerText;
        faults.push(label);
    });

    const resultsDiv = document.getElementById('ai-results');
    resultsDiv.innerHTML = '<p class="loading">המכונאי הדיגיטלי בודק את הנתונים... ⏳</p>';
    showScreen(2);

    try {
        const response = await fetch('/analyze-ai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ brand, model, year, engine: engineSelect.value, trim: trimSelect.value, faults })
        });

        const data = await response.json();
        displayResults(data.aiAnalysis);
    } catch (err) {
        resultsDiv.innerHTML = '<p>שגיאה בחיבור לשרת. נסה שוב.</p>';
    }
}

function displayResults(analysis) {
    const resultsDiv = document.getElementById('ai-results');
    resultsDiv.innerHTML = `
        <div style="text-align:center;">
            <div style="font-size: 3rem; font-weight: bold; color: var(--primary);">${analysis.reliability_score}</div>
            <p>ציון אמינות משוקלל</p>
        </div>
        <hr style="border-color: #334155; margin: 20px 0;">
        <h3>📋 סיכום המומחה:</h3>
        <p>${analysis.summary}</p>
        <div style="background: rgba(244, 63, 94, 0.1); padding: 15px; border-radius: 10px; margin-top: 15px;">
            <h4 style="color: var(--accent); margin-top:0;">⚠️ תקלות ועלויות תיקון:</h4>
            <ul id="faults-list">
                ${analysis.common_faults.map(f => `<li>${f}</li>`).join('')}
            </ul>
        </div>
    `;
}

init();
