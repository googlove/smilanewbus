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
            // Відображаємо помилку в контейнері
            document.getElementById('info-section-container').innerHTML = '<p style="color:orange; text-align:center;">Інформація про попутку та пільги тимчасово недоступна.</p>';
        });
}

// 3. Рендер додаткової інформації (Не змінено, використовує info.json)
function renderInfoData(data) {
    const container = document.getElementById('info-section-container');
    let html = '';

    // --- БЛОК 1: ПОПУТКА ---
    const p = data.poputka;
    let routesHtml = p.routes.map(route => `
        <div class="poputka-route">
            <span class="route-city">${route.city}:</span>
            <div class="route-points">
                Початкова: **${route.start}**<br>
                Кінцевий: **${route.end}**
            </div>
        </div>
    `).join('');
    
    let linksHtml = p.links.map(link => `
        <a href="${link.url}" target="_blank" class="poputka-link">
            <span class="link-icon">${link.icon}</span> ${link.name}
        </a>
    `).join('');

    html += `
        <div class="glass-panel info-panel poputka-panel">
            <strong class="panel-title poputka-title">
                <span class="title-icon">🚗</span> ${p.title}
            </strong>
            <h4 class="poputka-price">Ціна: ${p.price}</h4>
            <div class="poputka-routes-list">${routesHtml}</div>
            <div class="poputka-links-list">${linksHtml}</div>
        </div>
    `;


    // --- БЛОК 2: ЗАГАЛЬНА ІНФОРМАЦІЯ / ПІЛЬГИ ---
    const g = data.generalInfo;

    // Секція пільг та цін (динамічна генерація списку)
    const renderList = (items) => items.map(item => `
        <h4><span class="item-icon">${item.icon}</span> ${item.text}</h4>
    `).join('');

    html += `
        <div class="glass-panel info-panel general-info-panel">
            <strong class="panel-title general-title">
                <span class="title-icon">📜</span> ${g.title}
            </strong>
            
            <div class="info-list">
                ${renderList(g.busFares)}
            </div>

            <hr class="info-separator">

            <div class="info-list privileges-list">
                ${renderList(g.privileges)}
            </div>
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

// 5. Відкриття розкладу (Додано відображення карти)
function openSchedule(bus) {
    document.getElementById('main-view').classList.add('hidden');
    document.getElementById('schedule-view').classList.remove('hidden');
    document.getElementById('route-title-display').innerText = `№${bus.number} ${bus.title}`;
    
    // Оновлена логіка:
    renderMap(bus);
    renderRouteDetails(bus);
    window.scrollTo(0, 0);
}

// 6. Рендер Карти
function renderMap(bus) {
    const mapContainer = document.getElementById('route-map-container');
    mapContainer.innerHTML = ''; // Очищаємо контейнер
    
    if (bus.mapIframe) {
        mapContainer.innerHTML = bus.mapIframe;
        mapContainer.style.display = 'block';
    } else {
        // Якщо карти немає, приховуємо контейнер, щоб не було порожнього "скла"
        mapContainer.style.display = 'none';
    }
}


// 7. Генерація часу (Не змінено)
function renderRouteDetails(bus) {
    const container = document.getElementById('schedule-container');
    container.innerHTML = '';

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    bus.routes.forEach(route => {
        const block = document.createElement('div');
        block.className = 'route-block';
        
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

        block.innerHTML = `
            <h3 class="route-direction">➡️ ${route.direction} <br><small style="font-size:0.7em; color:#666">📅 ${route.workDays}</small></h3>
            ${stopsHTML}
        `;
        container.appendChild(block);
    });
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
