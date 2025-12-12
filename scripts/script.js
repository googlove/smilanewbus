let allBusData = [];

// Список номерів міських автобусів (ціна 13 грн)
const CITY_ROUTES_IDS = ['3', '4', '5', '17', '30', '34', '39', '40', '41', '48', '49', '32'];

// -----------------------------------------------------------
// ЗАПУСК ПРИ ЗАВАНТАЖЕННІ СТОРІНКИ
// -----------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    setupClock();
    setupTheme(); // Запускає логіку тумблера
    
    // Встановлення початкового стану для History API
    history.replaceState({ view: 'main' }, '', window.location.pathname);

    // Обробка жесту "Назад" браузера (popstate)
    setupHistoryListener();

    // Завантаження даних
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

    // Кнопка Назад (в інтерфейсі)
    const backBtn = document.getElementById('back-btn');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            history.back(); // Імітуємо натискання "Назад" у браузері
        });
    }
});

// -----------------------------------------------------------
// ФУНКЦІЇ HISTORY API & НАВІГАЦІЯ
// -----------------------------------------------------------

function setupHistoryListener() {
    window.addEventListener('popstate', (event) => {
        // Якщо повертаємося на головну (view: 'main') або стан пустий
        if (!event.state || event.state.view === 'main') {
            document.getElementById('schedule-view').classList.add('hidden');
            document.getElementById('main-view').classList.remove('hidden');
            window.scrollTo(0, 0);
        } 
        // Якщо повертаємося на розклад (view: 'schedule') - це обробляється автоматично,
        // бо ми вже там, але якщо потрібно, можна додати логіку тут.
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

// 1. Завантаження маршрутів
function loadBusData() {
    fetch('database/data.json')
        .then(response => response.json())
        .then(data => {
            allBusData = data;
            renderBusGrid(data);
        })
        .catch(err => {
            console.error("Помилка завантаження data.json:", err);
            const grid = document.getElementById('bus-grid');
            if(grid) grid.innerHTML = '<p style="color:red; text-align:center;">Помилка завантаження розкладу.</p>';
        });
}

// 2. Завантаження інфо
function loadInfoData() {
    fetch('database/info.json')
        .then(response => response.json())
        .then(data => {
            renderInfoData(data);
        })
        .catch(err => {
            console.error("Помилка завантаження info.json:", err);
        });
}

// 3. Рендер акордеона (Інфо)
function renderInfoData(data) {
    const container = document.getElementById('accordion');
    if (!container) return;
    
    let html = '';

    // Шаблони
    const renderHeader = (id, title, icon, isCollapsed = true) => `
        <div class="panel-heading glass-panel-header" role="tab" id="heading${id}">
            <h4 class="panel-title">
                <a role="button" data-toggle="collapse" data-parent="#accordion" href="#collapse${id}" aria-expanded="${isCollapsed ? 'false' : 'true'}" aria-controls="collapse${id}" class="${isCollapsed ? 'collapsed' : ''}">
                    <span class="title-icon">${icon}</span> ${title}
                </a>
            </h4>
        </div>
    `;

    const renderBody = (id, content, isCollapsed = true) => `
        <div id="collapse${id}" class="panel-collapse collapse ${isCollapsed ? '' : 'in'}" role="tabpanel" aria-labelledby="heading${id}">
            <div class="glass-panel info-panel panel-body">${content}</div>
        </div>
    `;

    // --- ПОПУТКА ---
    const p = data.poputka;
    let routesHtml = p.routes.map(route => `
        <div class="poputka-route">
            <span class="route-city">${route.city}:</span>
            <div class="route-points">
                Початкова: <strong>${route.start}</strong><br>
                Кінцевий: <strong>${route.end}</strong>
            </div>
        </div>
    `).join('');
    
    let linksHtml = p.links.map(link => `
        <a href="${link.url}" target="_blank" class="poputka-link">
            <span class="link-icon">${link.icon}</span> ${link.name}
        </a>
    `).join('');

    const poputkaContent = `
        <h4 class="poputka-price">Ціна: ${p.price}</h4>
        <div class="poputka-routes-list">${routesHtml}</div>
        <div class="poputka-links-list">${linksHtml}</div>
    `;

    html += `
        <div class="panel panel-default poputka-panel-wrapper">
            ${renderHeader('One', p.title, '🚗', true)}
            ${renderBody('One', poputkaContent, true)}
        </div>
    `;

    // --- ЗАГАЛЬНА ІНФО ---
    const g = data.generalInfo;
    const renderList = (items) => items.map(item => `
        <h4><span class="item-icon">${item.icon}</span> ${item.text}</h4>
    `).join('');

    const generalContent = `
        <div class="info-list">
            ${renderList(g.busFares)}
        </div>
        <hr class="info-separator">
        <div class="info-list privileges-list">
            ${renderList(g.privileges)}
        </div>
    `;

    html += `
        <div class="panel panel-default general-info-panel-wrapper">
            ${renderHeader('Two', g.title, '📜', true)}
            ${renderBody('Two', generalContent, true)}
        </div>
    `;

    container.innerHTML = html;
}

// -----------------------------------------------------------
// 4. РЕНДЕР СІТКИ (З ЦІНАМИ) - ОНОВЛЕНО
// -----------------------------------------------------------
function renderBusGrid(buses) {
    const container = document.getElementById('bus-grid');
    if (!container) return;
    
    container.innerHTML = '';

    if (buses.length === 0) {
        container.innerHTML = '<p style="text-align:center; width:100%">Маршрутів не знайдено</p>';
        return;
    }

    buses.forEach(bus => {
        const card = document.createElement('div');
        card.className = 'bus-card';
        
        // --- ЛОГІКА ЦІНИ ---
        let priceHtml = '';
        let priceText = '';
        
        // 1. Перевірка на міський автобус (13 грн)
        if (CITY_ROUTES_IDS.includes(bus.number.toString())) {
            priceText = '13 грн';
            priceHtml = `<div class="bus-price-badge">${priceText}</div>`;
        } 
        // 2. Перевірка на приміський (з data.json або dataset)
        else if (bus.price || (card.dataset && card.dataset.price)) {
            priceText = bus.price || 'від 30 грн'; 
            priceHtml = `<div class="bus-price-badge suburban-price">${priceText}</div>`;
        }

        // Зберігаємо для передачі
        card.dataset.routeId = bus.number;
        card.dataset.price = priceText;

        // Клік
        card.onclick = () => {
            // Якщо title не прийшов з JSON, беремо з DOM (рідкісний випадок)
            const title = bus.title || card.querySelector('.bus-title').innerText;
            openSchedule(bus, priceText);
        };
        
        // HTML картки
        card.innerHTML = `
            <span class="bus-num" style="color: ${bus.color || 'inherit'}">№${bus.number}</span>
            ${priceHtml} 
            <div class="bus-title">${bus.title}</div>
        `;
        
        container.appendChild(card);
    });
}

// -----------------------------------------------------------
// 5. ВІДКРИТТЯ РОЗКЛАДУ - ОНОВЛЕНО
// -----------------------------------------------------------
function openSchedule(bus, priceText) {
    // 1. Додаємо точку в історію
    history.pushState(
        { view: 'schedule', busId: bus.number }, 
        `Маршрут №${bus.number}`, 
        `#bus=${bus.number}`
    );
    
    // 2. Перемикаємо екран
    switchView('schedule');
    
    // 3. Заповнюємо заголовок
    document.getElementById('route-title-display').innerText = `№${bus.number} ${bus.title}`;
    
    // 4. Заповнюємо ціну (якщо елемент існує в HTML)
    const priceDisplay = document.getElementById('route-price-display');
    if (priceDisplay) {
        if (priceText) {
            // Можна додати красивий колір або жирність
            priceDisplay.innerHTML = `Вартість проїзду: <span style="color:var(--primary); font-weight:800;">${priceText}</span>`;
        } else {
            priceDisplay.innerHTML = '';
        }
    }
    
    // 5. Рендеримо деталі
    renderRouteDetails(bus);
    window.scrollTo(0, 0);
}

// -----------------------------------------------------------
// 6. РЕНДЕР ДЕТАЛЕЙ РОЗКЛАДУ (БЕЗ ЗМІН, ТІЛЬКИ FIX MAP)
// -----------------------------------------------------------
function renderRouteDetails(bus) {
    const container = document.getElementById('schedule-container');
    if (!container) return;
    container.innerHTML = ''; 
    
    let html = '<div class="row">';

    // 1. Карта (З ФІКСОМ .map-panel)
    const mapSrc = bus.mapIframeSrc || 'about:blank'; 

    html += `
        <div class="col-xs-12 col-md-6">
            <h4 class="map-title">Маршрут на карті</h4>
            
            <div class="map-panel">
                <iframe 
                    frameborder="0" 
                    src="${mapSrc}" 
                    width="100%" 
                    height="303">
                </iframe>
            </div>
        </div>
    `;

    // 2. Розклад
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
                
                if (busMinutes < currentMinutes) {
                    className += ' past';
                } else if (!foundNext && busMinutes >= currentMinutes) {
                    className += ' next';
                    foundNext = true; 
                }

                timesHTML += `<span class="${className}">${timeStr}</span>`;
            });

            stopsHTML += `
                <div class="stop-item">
                    <span class="stop-name">🚏 ${stop.name}</span>
                    <div class="times-row">${timesHTML}</div>
                </div>
            `;
        });

        html += `
            <div class="route-block">
                <h3 class="route-direction">➡️ ${route.direction} <br><small style="font-size:0.7em; color:#666">📅 ${route.workDays}</small></h3>
                ${stopsHTML}
            </div>
        `;
    });

    html += '</div></div>'; 
    container.innerHTML = html;
}

// -----------------------------------------------------------
// ДОДАТКОВІ ФУНКЦІЇ (ГОДИННИК, ТЕМА)
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

    if (savedTheme === 'dark') {
        enableDarkMode();
    } else if (savedTheme === 'light') {
        disableDarkMode();
    } else {
        if (systemPrefersDark) {
            enableDarkMode();
        } else {
            disableDarkMode();
        }
    }

    checkbox.addEventListener('change', () => {
        if (checkbox.checked) {
            enableDarkMode();
            localStorage.setItem('theme', 'dark');
        } else {
            disableDarkMode();
            localStorage.setItem('theme', 'light');
        }
    });

    function enableDarkMode() {
        body.classList.add('dark-mode');
        checkbox.checked = true;
    }

    function disableDarkMode() {
        body.classList.remove('dark-mode');
        checkbox.checked = false;
    }
}