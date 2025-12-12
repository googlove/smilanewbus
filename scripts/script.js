let allBusData = [];

// -----------------------------------------------------------
// ЗАПУСК ПРИ ЗАВАНТАЖЕННІ СТОРІНКИ (ОНОВЛЕНО)
// -----------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    setupClock();
    setupTheme(); // Запускає логіку тумблера
    
    // Встановлення початкового стану для History API
    // Це потрібно для коректного повернення жестом "Назад"
    history.replaceState({ view: 'main' }, '', window.location.pathname);

    // 🔥 Обробка жесту "Назад" браузера (popstate) 🔥
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

    // Кнопка Назад (ОНОВЛЕНО)
    const backBtn = document.getElementById('back-btn');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            // Замість прямого приховування, імітуємо натискання "Назад" у браузері.
            // Це запустить наш popstate обробник і забезпечить узгодженість.
            history.back();
            window.scrollTo(0, 0);
        });
    }
});

// -----------------------------------------------------------
// НОВІ ФУНКЦІЇ ДЛЯ HISTORY API
// -----------------------------------------------------------

// 🔥 Функція обробки жесту "Назад" 🔥
function setupHistoryListener() {
    window.addEventListener('popstate', (event) => {
        // Якщо стан історії говорить, що ми повертаємося до головного виду,
        // або якщо стану немає (повернення до початкової точки)
        if (event.state && event.state.view === 'main') {
            // Показати головну сторінку
            document.getElementById('schedule-view').classList.add('hidden');
            document.getElementById('main-view').classList.remove('hidden');
        } 
        
        // Якщо state порожній, ми намагаємося повернутися за межі додатка.
        // Ваш браузер обробить це сам.
    });
}

// Функція для зміни відображення між головною та розкладом
function switchView(toView) {
    if (toView === 'main') {
        document.getElementById('schedule-view').classList.add('hidden');
        document.getElementById('main-view').classList.remove('hidden');
    } else if (toView === 'schedule') {
        document.getElementById('main-view').classList.add('hidden');
        document.getElementById('schedule-view').classList.remove('hidden');
    }
}


// 1. Завантаження даних маршрутів (data.json)
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
            if(grid) grid.innerHTML = '<p style="color:red; text-align:center;">Помилка завантаження розкладу. Перевірте data.json.</p>';
        });
}

// 2. Завантаження додаткової інформації (info.json)
function loadInfoData() {
    fetch('database/info.json')
        .then(response => response.json())
        .then(data => {
            renderInfoData(data);
        })
        .catch(err => {
            console.error("Помилка завантаження info.json:", err);
            const accordion = document.getElementById('accordion');
            if(accordion) accordion.innerHTML = '<p style="color:orange; text-align:center;">Інформація про попутку та пільги тимчасово недоступна.</p>';
        });
}

// 3. Рендер додаткової інформації як акордеон (БЕЗ ЗМІН)
function renderInfoData(data) {
    const container = document.getElementById('accordion');
    if (!container) return;
    
    let html = '';

    // Шаблон заголовка акордеона
    const renderHeader = (id, title, icon, isCollapsed = true) => `
        <div class="panel-heading glass-panel-header" role="tab" id="heading${id}">
            <h4 class="panel-title">
                <a role="button" data-toggle="collapse" data-parent="#accordion" href="#collapse${id}" aria-expanded="${isCollapsed ? 'false' : 'true'}" aria-controls="collapse${id}" class="${isCollapsed ? 'collapsed' : ''}">
                    <span class="title-icon">${icon}</span> ${title}
                </a>
            </h4>
        </div>
    `;

    // Шаблон тіла акордеона
    const renderBody = (id, content, isCollapsed = true) => `
        <div id="collapse${id}" class="panel-collapse collapse ${isCollapsed ? '' : 'in'}" role="tabpanel" aria-labelledby="heading${id}">
            <div class="glass-panel info-panel panel-body">${content}</div>
        </div>
    `;

    // --- БЛОК 1: ПОПУТКА ---
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

    // --- БЛОК 2: ЗАГАЛЬНА ІНФОРМАЦІЯ ---
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


// 4. Малювання кнопок (Сітка) (БЕЗ ЗМІН)
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
        card.onclick = () => openSchedule(bus);
        
        card.innerHTML = `
            <span class="bus-num" style="color: ${bus.color}">№${bus.number}</span>
            <div class="bus-title">${bus.title}</div>
        `;
        container.appendChild(card);
    });
}


// Список номерів міських автобусів (ціна 13 грн)
const CITY_ROUTES_IDS = ['3', '4', '5', '17', '30', '34', '39', '40', '41', '48', '49', '32'];

// 4. Малювання кнопок (Сітка) — ОНОВЛЕНО
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
        
        // Визначення ціни
        let priceHtml = '';
        let priceText = '';
        
        // Перевірка: чи це міський автобус зі списку?
        if (CITY_ROUTES_IDS.includes(bus.number.toString())) {
            priceText = '13 грн';
            // Додаємо зелений бейдж
            priceHtml = `<div class="bus-price-badge">${priceText}</div>`;
        } 
        // Якщо ні, перевіряємо чи є ціна в data-price (для приміських)
        else if (bus.price || (card.dataset && card.dataset.price)) {
            // Беремо ціну з JSON або атрибуту
            priceText = bus.price || 'від 30 грн'; 
            // Додаємо золотистий бейдж (клас suburban-price)
            priceHtml = `<div class="bus-price-badge suburban-price">${priceText}</div>`;
        }

        // Зберігаємо ціну в атрибут, щоб передати в розклад при кліку
        card.dataset.routeId = bus.number;
        card.dataset.price = priceText; 

        card.onclick = () => {
            const title = bus.title || card.querySelector('.bus-title').innerText;
            // Передаємо ціну у функцію відкриття
            openSchedule(bus, priceText); 
        };
        
        // HTML Картки
        card.innerHTML = `
            <span class="bus-num" style="color: ${bus.color || 'inherit'}">№${bus.number}</span>
            ${priceHtml} <div class="bus-title">${bus.title}</div>
        `;
        
        container.appendChild(card);
    });
}

// 5. Відкриття розкладу (ОНОВЛЕНО: ДОДАНО history.pushState)
function openSchedule(bus) {
    // 🔥 Додаємо нову точку в історію браузера 🔥
    history.pushState({ view: 'schedule', busId: bus.number }, `Маршрут №${bus.number}`, `#bus=${bus.number}`);
    
    switchView('schedule');
    document.getElementById('route-title-display').innerText = `№${bus.number} ${bus.title}`;
    
    renderRouteDetails(bus);
    window.scrollTo(0, 0);
}

// 6. Генерація розкладу та карти (БЕЗ ЗМІН)
function renderRouteDetails(bus) {
    const container = document.getElementById('schedule-container');
    if (!container) return;
    container.innerHTML = ''; 
    
    // Початок Bootstrap-сітки
    let html = '<div class="row">';

    // 1. Колонка для Карти (з фіксом map-panel)
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


    // 2. Колонка для Розкладу
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
                // Парсинг часу "14:30 (примітка)"
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

// Годинник (БЕЗ ЗМІН)
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

// Функція Теми (БЕЗ ЗМІН)
function setupTheme() {
    const checkbox = document.getElementById('theme-checkbox');
    const body = document.body;
    
    if (!checkbox) return;

    // 1. Перевірка збереженої теми
    const savedTheme = localStorage.getItem('theme');
    
    // 2. Перевірка системної теми
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    // Встановлення початкового стану
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

    // 3. Обробник зміни тумблера
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
        checkbox.checked = true; // Вмикає тумблер
    }

    function disableDarkMode() {
        body.classList.remove('dark-mode');
        checkbox.checked = false; // Вимикає тумблер
    }
}
