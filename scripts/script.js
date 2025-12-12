let allBusData = [];

// ===========================================================
// 🛠️ КОНФІГУРАЦІЯ ЦІН ТА МАРШРУТІВ
// ===========================================================

// 1. Список номерів міських автобусів (Ціна фіксована: 13 грн)
const CITY_ROUTES_IDS = ['1', '2', '3', '4', '5', '6', '7', '8', '10', '11', '12', '14', '17', '30', '32', '34', '39', '40', '41', '48', '49'];

// 2. Детальна інформація для приміських маршрутів (Ціна + Примітки)
const SUBURBAN_DATA = {
    "309": { price: "від 30 ₴" },
    "155": { price: "від 30 ₴" },
    "154": { price: "від 40 ₴" },
    "153": { price: "від 47,5 ₴", note: "Перевізник: МЕРКУЛОВ В.Л. ФОП" },
    "152": { price: "від 25 ₴", note: "Ціна по Смілі: 13 грн" },
    "151": { price: "від 20 ₴" },
    "150": { price: "від 30 грн", note: "До кінцевої: 30 грн.<br>По Смілі: 13 грн." },
    "141": { price: "від 25 ₴" },
    "140": { price: "від 25-30 ₴" },
    "139": { price: "від 25 ₴", note: "ч/з с. Холоднянське, М. Смілянка, Тернівка, Попівка.<br>До с. Санжариха: 25 грн.<br>По місту: 13 грн." },
    "137": { price: "від 30 ₴" },
    "136": { price: "від 45 ₴" },
    "129": { price: "від 50 ₴" },
    "126": { price: "від 82 ₴", note: "ч/з с. Ротмістрівка, с. Ташлик, с. Самгородок" },
    "123": { price: "від 50 ₴", note: "ч/з с. Ротмістрівка" },
    "302": { price: "до Черкас: 87 ₴", note: "По Смілі: 13 грн | По Черкасам: 16 грн" }
};

// -----------------------------------------------------------
// ЗАПУСК ПРИ ЗАВАНТАЖЕННІ СТОРІНКИ
// -----------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    setupClock();
    setupTheme(); 
    
    // History API
    history.replaceState({ view: 'main' }, '', window.location.pathname);
    setupHistoryListener();

    // Завантаження
    loadBusData(); 
    loadInfoData();

    // Пошук
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const filtered = allBusData.filter(bus => 
                bus.number.toLowerCase().includes(term) || 
                bus.title.toLowerCase().includes(term)
            );
            renderBusGrid(filtered);
        });
    }

    // Кнопка Назад
    const backBtn = document.getElementById('back-btn');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            history.back(); 
        });
    }
});

// -----------------------------------------------------------
// ФУНКЦІЇ HISTORY API
// -----------------------------------------------------------
function setupHistoryListener() {
    window.addEventListener('popstate', (event) => {
        if (!event.state || event.state.view === 'main') {
            document.getElementById('schedule-view').classList.add('hidden');
            document.getElementById('main-view').classList.remove('hidden');
            window.scrollTo(0, 0);
        }
    });
}

function switchView(toView) {
    if (toView === 'main') {
        document.getElementById('schedule-view').classList.add('hidden');
        document.getElementById('main-view').classList.remove('hidden');
    } else if (toView === 'schedule') {
        document.getElementById('main-view').classList.add('hidden');
        document.getElementById('schedule-view').classList.remove('hidden');
    }
}

// -----------------------------------------------------------
// ЗАВАНТАЖЕННЯ ДАНИХ
// -----------------------------------------------------------
function loadBusData() {
    fetch('database/data.json')
        .then(response => response.json())
        .then(data => {
            allBusData = data;
            renderBusGrid(data);
        })
        .catch(err => {
            console.error("Помилка завантаження data.json:", err);
            const grid = document.getElementById('bus-grid'); // Якщо є загальний грід
            if(grid) grid.innerHTML = '<p style="color:red; text-align:center;">Помилка.</p>';
        });
}

function loadInfoData() {
    fetch('database/info.json')
        .then(response => response.json())
        .then(data => {
            renderInfoData(data);
        })
        .catch(err => console.error("Помилка інфо:", err));
}

// 3. Рендер акордеона (Інфо) - Стандартний
function renderInfoData(data) {
    const container = document.getElementById('accordion');
    if (!container) return;
    
    let html = '';
    const renderHeader = (id, title, icon, isCollapsed = true) => `
        <div class="panel-heading glass-panel-header" role="tab" id="heading${id}">
            <h4 class="panel-title">
                <a role="button" data-toggle="collapse" data-parent="#accordion" href="#collapse${id}" aria-expanded="${isCollapsed ? 'false' : 'true'}" aria-controls="collapse${id}" class="${isCollapsed ? 'collapsed' : ''}">
                    <span class="title-icon">${icon}</span> ${title}
                </a>
            </h4>
        </div>`;
    const renderBody = (id, content, isCollapsed = true) => `
        <div id="collapse${id}" class="panel-collapse collapse ${isCollapsed ? '' : 'in'}" role="tabpanel" aria-labelledby="heading${id}">
            <div class="glass-panel info-panel panel-body">${content}</div>
        </div>`;

    // Попутка
    const p = data.poputka;
    let routesHtml = p.routes.map(r => `<div class="poputka-route"><span class="route-city">${r.city}:</span><div class="route-points">Початкова: <strong>${r.start}</strong><br>Кінцевий: <strong>${r.end}</strong></div></div>`).join('');
    let linksHtml = p.links.map(l => `<a href="${l.url}" target="_blank" class="poputka-link"><span class="link-icon">${l.icon}</span> ${l.name}</a>`).join('');
    
    html += `<div class="panel panel-default poputka-panel-wrapper">${renderHeader('One', p.title, '🚗', true)}${renderBody('One', `<h4 class="poputka-price">Ціна: ${p.price}</h4><div class="poputka-routes-list">${routesHtml}</div><div class="poputka-links-list">${linksHtml}</div>`, true)}</div>`;

    // Загальна інфо
    const g = data.generalInfo;
    const renderList = (items) => items.map(i => `<h4><span class="item-icon">${i.icon}</span> ${i.text}</h4>`).join('');
    html += `<div class="panel panel-default general-info-panel-wrapper">${renderHeader('Two', g.title, '📜', true)}${renderBody('Two', `<div class="info-list">${renderList(g.busFares)}</div><hr class="info-separator"><div class="info-list privileges-list">${renderList(g.privileges)}</div>`, true)}</div>`;

    container.innerHTML = html;
}

// -----------------------------------------------------------
// 4. РЕНДЕР СІТКИ (З НОВИМИ ЦІНАМИ)
// -----------------------------------------------------------
function renderBusGrid(buses) {
    // Шукаємо обидві сітки
    const urbanContainer = document.querySelector('.bus-grid-urban');
    const suburbanContainer = document.querySelector('.bus-grid-suburban');
    
    // Якщо сіток немає (наприклад, стара верстка), шукаємо загальну
    const generalContainer = document.getElementById('bus-grid');

    // Очищення
    if (urbanContainer) urbanContainer.innerHTML = '';
    if (suburbanContainer) suburbanContainer.innerHTML = '';
    if (generalContainer) generalContainer.innerHTML = '';

    buses.forEach(bus => {
        const card = document.createElement('div');
        card.className = 'bus-card';
        const routeIdStr = bus.number.toString();
        
        let priceHtml = '';
        let isUrban = false;

        // 1. Перевірка: Міський (13 грн)
        if (CITY_ROUTES_IDS.includes(routeIdStr)) {
            isUrban = true;
            // Для міських ціну на картці зазвичай не пишемо (вона стандартна), 
            // але можна розкоментувати рядок нижче, якщо хочете бейдж "13 грн"
            // priceHtml = `<div class="bus-price-badge">13 грн</div>`;
        } 
        // 2. Перевірка: Приміський (з SUBURBAN_DATA)
        else if (SUBURBAN_DATA[routeIdStr]) {
            const info = SUBURBAN_DATA[routeIdStr];
            priceHtml = `<div class="bus-price-badge suburban-price">${info.price}</div>`;
        }
        // 3. Fallback (якщо немає в списку, беремо з JSON)
        else if (bus.price) {
            priceHtml = `<div class="bus-price-badge suburban-price">${bus.price}</div>`;
        }

        // Клік по картці
        card.onclick = () => {
            const title = bus.title || card.querySelector('.bus-title').innerText;
            openSchedule(bus, routeIdStr);
        };
        
        // HTML Картки
        card.innerHTML = `
            <span class="bus-num" style="color: ${bus.color || 'inherit'}">№${bus.number}</span>
            ${priceHtml} 
            <div class="bus-title">${bus.title}</div>
        `;
        
        // Розподіл по контейнерах
        if (urbanContainer && suburbanContainer) {
            if (isUrban) urbanContainer.appendChild(card);
            else suburbanContainer.appendChild(card);
        } else if (generalContainer) {
            generalContainer.appendChild(card);
        }
    });
}

// -----------------------------------------------------------
// 5. ВІДКРИТТЯ РОЗКЛАДУ (З ДЕТАЛЬНОЮ ЦІНОЮ ТА ПРИМІТКАМИ)
// -----------------------------------------------------------
function openSchedule(bus, routeId) {
    history.pushState({ view: 'schedule', busId: bus.number }, `Маршрут №${bus.number}`, `#bus=${bus.number}`);
    switchView('schedule');
    
    // Заголовок
    document.getElementById('route-title-display').innerText = `№${bus.number} ${bus.title}`;
    
    // --- БЛОК ВІДОБРАЖЕННЯ ЦІНИ ТА ІНФО ---
    const priceDisplay = document.getElementById('route-price-display');
    
    if (priceDisplay) {
        // 1. Перевірка на спеціальні дані з SUBURBAN_DATA
        if (SUBURBAN_DATA[routeId]) {
            const info = SUBURBAN_DATA[routeId];
            let html = `Вартість проїзду: <span style="color:var(--primary); font-weight:800;">${info.price}</span>`;
            
            if (info.note) {
                html += `<br><span style="font-size:0.9em; opacity:0.8; font-weight:400;">${info.note}</span>`;
            }
            priceDisplay.innerHTML = html;
        } 
        // 2. Перевірка на міський
        else if (CITY_ROUTES_IDS.includes(routeId)) {
            priceDisplay.innerHTML = `Вартість проїзду: <span style="color:var(--fares-color-light); font-weight:800;">13 грн</span>`;
        } 
        // 3. Стандартний варіант
        else {
            priceDisplay.innerHTML = '';
        }
    }
    
    renderRouteDetails(bus);
    window.scrollTo(0, 0);
}

// -----------------------------------------------------------
// 6. РЕНДЕР ДЕТАЛЕЙ
// -----------------------------------------------------------
function renderRouteDetails(bus) {
    const container = document.getElementById('schedule-container');
    if (!container) return;
    container.innerHTML = ''; 
    
    let html = '<div class="row">';

    const mapSrc = bus.mapIframeSrc || 'about:blank'; 

    html += `
        <div class="col-xs-12 col-md-6">
            <h4 class="map-title">Маршрут на карті</h4>
            <div class="map-panel">
                <iframe frameborder="0" src="${mapSrc}" width="100%" height="303"></iframe>
            </div>
        </div>
    `;

    html += '<div class="col-xs-12 col-md-6 schedule-column">';
    html += `<h4 class="schedule-title">Розклад руху (Маршрут №${bus.number})</h4>`;

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    bus.routes.forEach(route => {
        let stopsHTML = '';
        route.stops.forEach(stop => {
            let timesHTML = '';
            let foundNext = false;
            stop.times.forEach(timeStr => {
                const cleanTime = timeStr.split(' ')[0]; 
                const [h, m] = cleanTime.split(':').map(Number);
                const busMinutes = h * 60 + m;
                let className = 'time-badge';
                if (busMinutes < currentMinutes) { className += ' past'; } 
                else if (!foundNext && busMinutes >= currentMinutes) { className += ' next'; foundNext = true; }
                timesHTML += `<span class="${className}">${timeStr}</span>`;
            });
            stopsHTML += `<div class="stop-item"><span class="stop-name">🚏 ${stop.name}</span><div class="times-row">${timesHTML}</div></div>`;
        });
        html += `<div class="route-block"><h3 class="route-direction">➡️ ${route.direction} <br><small style="font-size:0.7em; color:#666">📅 ${route.workDays}</small></h3>${stopsHTML}</div>`;
    });

    html += '</div></div>'; 
    container.innerHTML = html;
}

// -----------------------------------------------------------
// ДОДАТКОВІ (ГОДИННИК, ТЕМА)
// -----------------------------------------------------------
function setupClock() {
    const clockEl = document.getElementById('clock');
    if (!clockEl) return;
    const update = () => {
        const now = new Date();
        clockEl.innerText = now.toLocaleTimeString('uk-UA', {hour: '2-digit', minute:'2-digit'});
    };
    setInterval(update, 1000);
    update();
}

function setupTheme() {
    const checkbox = document.getElementById('theme-checkbox');
    const body = document.body;
    if (!checkbox) return;
    const savedTheme = localStorage.getItem('theme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (savedTheme === 'dark') { enableDarkMode(); } 
    else if (savedTheme === 'light') { disableDarkMode(); } 
    else { if (systemPrefersDark) enableDarkMode(); else disableDarkMode(); }

    checkbox.addEventListener('change', () => {
        if (checkbox.checked) { enableDarkMode(); localStorage.setItem('theme', 'dark'); } 
        else { disableDarkMode(); localStorage.setItem('theme', 'light'); }
    });
    function enableDarkMode() { body.classList.add('dark-mode'); checkbox.checked = true; }
    function disableDarkMode() { body.classList.remove('dark-mode'); checkbox.checked = false; }
}