let allBusData = [];

// Запуск при завантаженні сторінки
document.addEventListener('DOMContentLoaded', () => {
    setupClock();
    setupTheme();
    
    // Завантаження ОСНОВНИХ ДАНИХ (маршрути)
    loadBusData(); 

    // Завантаження ДОДАТКОВОЇ ІНФОРМАЦІЇ (попутка, пільги)
    loadInfoData();

    // Пошук
    document.getElementById('search-input').addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = allBusData.filter(bus => 
            bus.number.toLowerCase().includes(term) || 
            bus.title.toLowerCase().includes(term)
        );
        renderBusGrid(filtered);
    });

    // Кнопка Назад
    document.getElementById('back-btn').addEventListener('click', () => {
        document.getElementById('schedule-view').classList.add('hidden');
        document.getElementById('main-view').classList.remove('hidden');
        window.scrollTo(0, 0);
    });
});

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
            document.getElementById('bus-grid').innerHTML = '<p style="color:red; text-align:center;">Помилка завантаження розкладу. Перевірте data.json.</p>';
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
            // ВИПРАВЛЕНО: Використовуємо новий ID 'accordion'
            document.getElementById('accordion').innerHTML = '<p style="color:orange; text-align:center;">Інформація про попутку та пільги тимчасово недоступна.</p>';
        });
}

// 3. Рендер додаткової інформації як акордеон (Використовує info.json)
function renderInfoData(data) {
    const container = document.getElementById('accordion'); // Контейнер-аккордеон
    let html = '';

    // Функція-шаблон для створення заголовка акордеона
    const renderHeader = (id, title, icon, isCollapsed = true) => `
        <div class="panel-heading glass-panel-header" role="tab" id="heading${id}">
            <h4 class="panel-title">
                <a role="button" data-toggle="collapse" data-parent="#accordion" href="#collapse${id}" aria-expanded="${isCollapsed ? 'false' : 'true'}" aria-controls="collapse${id}" class="${isCollapsed ? 'collapsed' : ''}">
                    <span class="title-icon">${icon}</span> ${title}
                </a>
            </h4>
        </div>
    `;

    // Функція-шаблон для створення тіла акордеона
    const renderBody = (id, content, isCollapsed = true) => `
        <div id="collapse${id}" class="panel-collapse collapse ${isCollapsed ? '' : 'in'}" role="tabpanel" aria-labelledby="heading${id}">
            <div class="glass-panel info-panel panel-body">${content}</div>
        </div>
    `;

    // --- БЛОК 1: ПОПУТКА (ID: One) ---
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


    // --- БЛОК 2: ЗАГАЛЬНА ІНФОРМАЦІЯ / ПІЛЬГИ (ID: Two) ---
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


// 4. Малювання кнопок (Не змінено)
function renderBusGrid(buses) {
    const container = document.getElementById('bus-grid');
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

// 5. Відкриття розкладу (Оновлено: прибрано виклик renderMap)
function openSchedule(bus) {
    document.getElementById('main-view').classList.add('hidden');
    document.getElementById('schedule-view').classList.remove('hidden');
    document.getElementById('route-title-display').innerText = `№${bus.number} ${bus.title}`;
    
    // Оновлена логіка:
    renderRouteDetails(bus); // Ця функція тепер рендерить і розклад, і карту в сітці
    window.scrollTo(0, 0);
}

// 6. ФУНКЦІЯ renderMap ВИДАЛЕНА

// 7. Генерація розкладу та карти (Оновлено: додано сітку Bootstrap та iframe карти)
function renderRouteDetails(bus) {
    const container = document.getElementById('schedule-container');
    container.innerHTML = ''; // Очищаємо контейнер
    
    // Початок Bootstrap-сітки
    let html = '<div class="row">';

    // 1. Колонка для Карти (займає 6/12 на великих екранах)
    const mapSrc = bus.mapIframeSrc || 'about:blank'; // Посилання на карту з JSON
    
    html += `
        <div class="col-xs-12 col-md-6 map-column">
            <h4 class="map-title">Маршрут на карті</h4>
            <iframe 
                frameborder="0" 
                style="-moz-box-shadow: 0 2px 3px rgba(0, 0, 0, 0.5); -webkit-box-shadow: 0 2px 3px rgba(0, 0, 0, 0.5); box-shadow: 0 2px 3px rgba(0, 0, 0, 0.5); border: 0; width: 100%; height: 303px;" 
                src="${mapSrc}" 
                width="300" 
                height="303">
            </iframe>
        </div>
    `;

    // 2. Колонка для Розкладу (займає 6/12 на великих екранах)
    html += '<div class="col-xs-12 col-md-6 schedule-column">';
    html += `<h4 class="schedule-title">Розклад руху (Маршрут №${bus.number})</h4>`; // Новий заголовок для розкладу

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

    // Закриття колонки розкладу та рядка
    html += '</div></div>';
    
    // Встановлення фінального HTML
    container.innerHTML = html;
}

// Годинник
function setupClock() {
    const update = () => {
        const now = new Date();
        document.getElementById('clock').innerText = now.toLocaleTimeString('uk-UA', {hour: '2-digit', minute:'2-digit'});
    };
    setInterval(update, 1000);
    update();
}

// Темна тема
function setupTheme() {
    const btn = document.getElementById('theme-toggle');
    const isDark = localStorage.getItem('theme') === 'dark';
    
    if (isDark) document.body.classList.add('dark-mode');
    btn.innerText = isDark ? '☀️' : '🌙';

    btn.onclick = () => {
        document.body.classList.toggle('dark-mode');
        const theme = document.body.classList.contains('dark-mode') ? 'dark' : 'light';
        btn.innerText = theme === 'dark' ? '☀️' : '🌙';
        localStorage.setItem('theme', theme);
    };
}
