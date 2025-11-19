let allBusData = [];

// Запуск при завантаженні сторінки
document.addEventListener('DOMContentLoaded', () => {
    setupClock();
    setupTheme();
    loadData();

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

// 1. Завантаження даних
function loadData() {
    fetch('data.json')
        .then(response => response.json())
        .then(data => {
            allBusData = data;
            renderBusGrid(data);
        })
        .catch(err => {
            console.error(err);
            document.getElementById('bus-grid').innerHTML = '<p style="color:red; text-align:center;">Помилка завантаження даних data.json. Якщо ви відкрили файл локально, використовуйте локальний сервер.</p>';
        });
}

// 2. Малювання кнопок
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

// 3. Відкриття розкладу
function openSchedule(bus) {
    document.getElementById('main-view').classList.add('hidden');
    document.getElementById('schedule-view').classList.remove('hidden');
    document.getElementById('route-title-display').innerText = `№${bus.number} ${bus.title}`;
    
    renderRouteDetails(bus);
    window.scrollTo(0, 0);
}

// 4. Генерація часу
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
                // Парсинг часу "14:30" або "14:30 (прим)"
                const cleanTime = timeStr.split(' ')[0]; 
                const [h, m] = cleanTime.split(':').map(Number);
                const busMinutes = h * 60 + m;

                let className = 'time-badge';
                
                // Логіка підсвітки
                if (busMinutes < currentMinutes) {
                    className += ' past';
                } else if (!foundNext && busMinutes >= currentMinutes) {
                    className += ' next';
                    foundNext = true; // Тільки один "наступний"
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