import { CAR_DATA, CHECKLIST_CONFIG } from './config.js';

// אלמנטים
const screens = document.querySelectorAll('.step-card');
const brandSelect = document.getElementById('brand-select');
const modelSelect = document.getElementById('model-select');
const engineSelect = document.getElementById('engine-select');
const trimSelect = document.getElementById('trim-select');
const yearSelect = document.getElementById('year-select');
const checklistContent = document.getElementById('checklist-content');

// כפתורים
const btnToChecklist = document.getElementById('to-checklist-btn');
const btnAnalyze = document.getElementById('analyze-ai-btn');

function init() {
    // מילוי יצרנים
    Object.keys(CAR_DATA).forEach(brand => brandSelect.add(new Option(brand, brand)));

    // מילוי שנים
    const currentYear = new Date().getFullYear();
    for(let y = currentYear; y >= 2008; y--) yearSelect.add(new Option(y, y));

    // מאזינים
    brandSelect.addEventListener('change', handleBrandChange);
    modelSelect.addEventListener('change', handleModelChange);
    
    // כפתור מעבר שלב
    btnToChecklist.addEventListener('click', () => {
        if(!brandSelect.value || !modelSelect.value) {
            alert('נא לבחור יצרן ודגם כדי להתקדם');
            return;
        }
        showScreen(1);
    });
    
    // כפתור ניתוח AI
    if(btnAnalyze) btnAnalyze.addEventListener('click', startAiAnalysis);
}

function handleBrandChange() {
    const brand = brandSelect.value;
    modelSelect.innerHTML = '<option value="">בחר דגם...</option>';
    engineSelect.innerHTML = '<option value="">בחר מנוע...</option>';
    trimSelect.innerHTML = '<option value="">בחר גימור...</option>';
    
    modelSelect.disabled = !brand;
    engineSelect.disabled = true;
    trimSelect.disabled = true;

    if (brand && CAR_DATA[brand]) {
        CAR_DATA[brand].models.forEach(m => modelSelect.add(new Option(m, m)));
    }
}

function handleModelChange() {
    const brand = brandSelect.value;
    if (brand && modelSelect.value) {
        engineSelect.innerHTML = '<option value="">בחר מנוע...</option>';
        trimSelect.innerHTML = '<option value="">בחר גימור...</option>';
        
        CAR_DATA[brand].engines.forEach(e => engineSelect.add(new Option(e, e)));
        CAR_DATA[brand].trims.forEach(t => trimSelect.add(new Option(t, t)));
        
        engineSelect.disabled = false;
        trimSelect.disabled = false;
    }
}

function showScreen(index) {
    // הסתרת הכל והצגת המסך הרלוונטי
    screens.forEach(s => s.classList.remove('active'));
    screens[index].classList.add('active');
    
    // אם עברנו למסך הצ'קליסט - בנה אותו
    if (index === 1) generateChecklist();
    
    // גלילה למעלה
    window.scrollTo(0, 0);
}

function generateChecklist() {
    checklistContent.innerHTML = '';
    
    CHECKLIST_CONFIG.forEach(category => {
        // כותרת קטגוריה
        const header = document.createElement('h3');
        header.innerText = category.category; // האימוג'י מגיע מה-config
        header.style.borderBottom = '1px solid #333';
        header.style.paddingBottom = '5px';
        header.style.marginTop = '20px';
        checklistContent.appendChild(header);

        category.items.forEach(item => {
            const row = document.createElement('div');
            row.className = 'check-item';
            // כאן אנחנו מוודאים שהאימוג'י של המידע (ℹ️) מופיע!
            row.innerHTML = `
                <input type="checkbox" id="${item.id}" class="car-check">
                <label for="${item.id}">${item.name}</label>
                <button class="info-btn" onclick="alert('${item.howTo}')">ℹ️</button>
            `;
            checklistContent.appendChild(row);
        });
    });
}

async function startAiAnalysis() {
    const brand = brandSelect.value;
    const model = modelSelect.value;
    const year = yearSelect.value;
    const engine = engineSelect.value || "לא ידוע";
    
    const faults = [];
    document.querySelectorAll('.car-check:checked').forEach(cb => {
        const labelText = cb.nextElementSibling.innerText;
        faults.push(labelText);
    });

    // מעבר למסך תוצאות
    showScreen(2);
    const resultsDiv = document.getElementById('ai-results');
    resultsDiv.innerHTML = '<div class="loading">🤖 המכונאי הדיגיטלי מנתח את הנתונים...<br>זה ייקח כמה שניות.</div>';

    try {
        const response = await fetch('/analyze-ai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ brand, model, year, engine, trim: trimSelect.value, faults })
        });

        const data = await response.json();
        if(data.success) {
            displayResults(data.aiAnalysis);
        } else {
            resultsDiv.innerHTML = '<p style="color:red">שגיאה בקבלת הנתונים. נסה שוב.</p>';
        }
    } catch (e) {
        console.error(e);
        resultsDiv.innerHTML = '<p style="color:red">שגיאה בתקשורת עם השרת.</p>';
    }
}

function displayResults(data) {
    const resultsDiv = document.getElementById('ai-results');
    // צבע הציון
    let color = '#4CAF50'; // ירוק
    if (data.reliability_score < 75) color = '#FFC107'; // צהוב
    if (data.reliability_score < 50) color = '#F44336'; // אדום

    resultsDiv.innerHTML = `
        <div style="text-align: center; margin-bottom: 20px;">
            <div style="font-size: 4rem; font-weight: bold; color: ${color};">${data.reliability_score}</div>
            <div>ציון אמינות משוקלל</div>
        </div>
        <div style="background: #252525; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
            <h3>📝 סיכום</h3>
            <p>${data.summary}</p>
        </div>
        <div style="background: rgba(244, 67, 54, 0.1); padding: 15px; border-radius: 8px; margin-bottom: 15px; border: 1px solid #F44336;">
            <h3 style="color: #F44336; margin-top: 0;">🔧 תקלות ועלויות</h3>
            <ul>
                ${data.common_faults.map(f => `<li>${f}</li>`).join('')}
            </ul>
        </div>
        <div style="background: rgba(76, 175, 80, 0.1); padding: 15px; border-radius: 8px; border: 1px solid #4CAF50;">
            <h3 style="color: #4CAF50; margin-top: 0;">💰 המלצה למו"מ</h3>
            <p><strong>${data.negotiation_tip}</strong></p>
        </div>
        <button onclick="location.reload()" class="primary-btn" style="background: #333; margin-top: 20px;">בדיקה חדשה</button>
    `;
}

// הפעלה
document.addEventListener('DOMContentLoaded', init);
