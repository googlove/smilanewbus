// ===========================================================
// SmilaBusTime — головний скрипт
// ===========================================================

let allBusData = [];
let currentBus = null; // обраний маршрут, який зараз показується на екрані розкладу

// Дата останнього оновлення розкладу — змінюйте тут одне місце
const APP_UPDATED = 'Травень 2026';

// ===========================================================
// 🛠️ КОНФІГУРАЦІЯ ЦІН ТА МАРШРУТІВ
// ===========================================================

// 1. Список номерів міських автобусів (Ціна фіксована: 13 грн)
const CITY_ROUTES_IDS = ['3', '4', '5', '17', '30', '32', '34', '39', '40', '41', '48', '49'];

// 2. Детальна інформація для приміських маршрутів (Ціна + Примітки)
const SUBURBAN_DATA = {
    "309": { price: "30 ₴" },
    "155": { price: "30 ₴" },
    "154": { price: "від 40 ₴" },
    "153": { price: "від 47,5 ₴", note: "Перевізник: МЕРКУЛОВ В.Л. ФОП" },
    "152": { price: "від 25 ₴", note: "Ціна по Смілі: 13 грн" },
    "151": { price: "від 20 ₴" },
    "150": { price: "від 25-30 ₴", note: "До кінцевої: 30 грн.<br>По Смілі: 13 грн." },
    "141": { price: "від 25 ₴" },
    "140": { price: "від 45 ₴" },
    "139": { price: "від 25 ₴", note: "ч/з с. Холоднянське, М. Смілянка, Тернівка, Попівка.<br>До с. Санжариха: 25 грн.<br>По місту: 13 грн." },
    "137": { price: "від 30 ₴" },
    "136": { price: "від 45 ₴" },
    "129": { price: "від 50 ₴" },
    "126": { price: "від 82 ₴", note: "ч/з с. Ротмістрівка, с. Ташлик, с. Самгородок" },
    "123": { price: "від 50 ₴", note: "ч/з с. Ротмістрівка" },
    "302": { price: "до Черкас: 110 ₴", note: "По Смілі: 13 грн | По Черкасам: 20 грн" }
};

// -----------------------------------------------------------
// ⭐ ОБРАНЕ (FAVORITES)
// -----------------------------------------------------------
let favoriteRoutes = [];
try {
    favoriteRoutes = JSON.parse(localStorage.getItem('favoriteRoutes') || '[]');
} catch (_) { favoriteRoutes = []; }

function isFavorite(num) {
    return favoriteRoutes.includes(num.toString());
}

function toggleFavorite(num) {
    const id = num.toString();
    const idx = favoriteRoutes.indexOf(id);
    if (idx === -1) favoriteRoutes.push(id);
    else favoriteRoutes.splice(idx, 1);
    localStorage.setItem('favoriteRoutes', JSON.stringify(favoriteRoutes));
}

function sortByFavorites(buses) {
    return [...buses].sort((a, b) => {
        const af = isFavorite(a.number);
        const bf = isFavorite(b.number);
        if (af && !bf) return -1;
        if (!af && bf) return 1;
        return 0;
    });
}

// -----------------------------------------------------------
// ⏱️ ХЕЛПЕРИ ДЛЯ ЧАСУ
// -----------------------------------------------------------
function getCurrentMinutes() {
    const n = new Date();
    return n.getHours() * 60 + n.getMinutes();
}

function parseTimeStr(timeStr) {
    if (!timeStr) return null;
    const clean = String(timeStr).split(' ')[0];
    const parts = clean.split(':');
    if (parts.length < 2) return null;
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (isNaN(h) || isNaN(m)) return null;
    return h * 60 + m;
}

// Знаходить найближчий рейс для маршруту (відносно зараз)
function findNextDeparture(bus) {
    const cur = getCurrentMinutes();
    let best = null;
    bus.routes.forEach(route => {
        route.stops.forEach(stop => {
            stop.times.forEach(timeStr => {
                const t = parseTimeStr(timeStr);
                if (t === null) return;
                if (t >= cur && (best === null || t < best.minutes)) {
                    best = {
                        minutes: t,
                        time: String(timeStr).split(' ')[0],
                        stop: stop.name,
                        direction: route.direction,
                        diff: t - cur
                    };
                }
            });
        });
    });
    return best;
}

function formatDiffMinutes(diff) {
    if (diff <= 0) return 'зараз';
    if (diff < 60) return `через ${diff} хв`;
    const h = Math.floor(diff / 60);
    const m = diff % 60;
    return m === 0 ? `через ${h} год` : `через ${h} год ${m} хв`;
}

// -----------------------------------------------------------
// ЗАПУСК ПРИ ЗАВАНТАЖЕННІ СТОРІНКИ
// -----------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    setupClock();
    setupTheme();
    setupFooterDate();
    registerServiceWorker();

    // History API
    history.replaceState({ view: 'main' }, '', window.location.pathname + window.location.hash);
    setupHistoryListener();

    // Завантаження
    loadBusData();
    loadInfoData();

    // Пошук
    setupSearch();

    // Кнопка Назад
    const backBtn = document.getElementById('back-btn');
    if (backBtn) {
        backBtn.addEventListener('click', () => history.back());
    }

    // Запуск регулярного оновлення (наближення часу — оновлюємо беджі та банер)
    setInterval(tickEveryMinute, 30000); // кожні 30 секунд
});

// -----------------------------------------------------------
// 🔄 РЕГУЛЯРНЕ ОНОВЛЕННЯ ЧАСУ
// -----------------------------------------------------------
function tickEveryMinute() {
    const mainHidden = document.getElementById('main-view').classList.contains('hidden');
    const scheduleHidden = document.getElementById('schedule-view').classList.contains('hidden');

    if (!mainHidden) {
        updateCardCountdowns();
    }
    if (!scheduleHidden && currentBus) {
        refreshScheduleBadges();
        updateNextBanner();
        refreshDirectionStops(); // 🆕 оновлення списку зупинок
    }
}

// -----------------------------------------------------------
// ФУНКЦІЇ HISTORY API
// -----------------------------------------------------------
function setupHistoryListener() {
    window.addEventListener('popstate', (event) => {
        if (!event.state || event.state.view === 'main') {
            switchView('main');
            currentBus = null;
            if (window.location.hash) {
                history.replaceState({ view: 'main' }, '', window.location.pathname);
            }
            window.scrollTo(0, 0);
        } else if (event.state.view === 'schedule' && event.state.busId) {
            const bus = allBusData.find(b => b.number.toString() === event.state.busId.toString());
            if (bus) openSchedule(bus, bus.number.toString(), { skipPush: true });
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
            // Якщо в URL був #bus=..., відкриваємо одразу
            handleHashRoute();
        })
        .catch(err => {
            console.error("Помилка завантаження data.json:", err);
            const grid = document.getElementById('bus-grid');
            if (grid) grid.innerHTML = '<p style="color:red; text-align:center;">Помилка завантаження розкладу.</p>';
        });
}

function loadInfoData() {
    fetch('database/info.json')
        .then(response => response.json())
        .then(data => renderInfoData(data))
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
// 🔎 ПОШУК (з підтримкою назв зупинок)
// -----------------------------------------------------------
function setupSearch() {
    const searchInput = document.getElementById('search-input');
    const clearBtn = document.getElementById('search-clear');
    if (!searchInput) return;

    const applyFilter = () => {
        const raw = searchInput.value.trim();
        const term = raw.toLowerCase();
        if (clearBtn) clearBtn.style.display = raw ? 'flex' : 'none';

        if (!term) {
            renderBusGrid(allBusData);
            return;
        }

        const filtered = allBusData.filter(bus => {
            if (bus.number.toString().toLowerCase().includes(term)) return true;
            if (bus.title && bus.title.toLowerCase().includes(term)) return true;
            return bus.routes.some(r =>
                (r.direction && r.direction.toLowerCase().includes(term)) ||
                r.stops.some(s => s.name && s.name.toLowerCase().includes(term))
            );
        });
        renderBusGrid(filtered);
    };

    searchInput.addEventListener('input', applyFilter);

    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            searchInput.value = '';
            applyFilter();
            searchInput.focus();
        });
    }
}

// -----------------------------------------------------------
// 4. РЕНДЕР СІТКИ (картки з ⭐ обраним та ⏱️ countdown)
// -----------------------------------------------------------
// Маршрут вважається МІСЬКИМ, якщо його номер одно- або двозначний (1–2 цифри),
// і ПРИМІСЬКИМ, якщо тризначний (3+ цифри). Список CITY_ROUTES_IDS лишається
// як надійний фолбек для нетипових номерів.
function isUrbanRoute(routeIdStr) {
    const digits = routeIdStr.replace(/\D/g, '');
    if (digits.length > 0) return digits.length <= 2;
    return CITY_ROUTES_IDS.includes(routeIdStr);
}

function buildBusCard(bus) {
    const card = document.createElement('div');
    card.className = 'bus-card';
    const routeIdStr = bus.number.toString();
    card.dataset.busNumber = routeIdStr;

    const fav = isFavorite(routeIdStr);
    if (fav) card.classList.add('is-favorite');

    const urban = isUrbanRoute(routeIdStr);
    card.classList.add(urban ? 'bus-card--urban' : 'bus-card--suburban');

    let priceHtml = '';
    if (!urban) {
        if (SUBURBAN_DATA[routeIdStr]) {
            priceHtml = `<div class="bus-price-badge suburban-price">${SUBURBAN_DATA[routeIdStr].price}</div>`;
        } else if (bus.price) {
            priceHtml = `<div class="bus-price-badge suburban-price">${bus.price}</div>`;
        }
    }

    card.onclick = (e) => {
        if (e.target.closest('.fav-btn')) return;
        openSchedule(bus, routeIdStr);
    };

    card.innerHTML = `
        <button class="fav-btn ${fav ? 'active' : ''}" aria-label="${fav ? 'Прибрати з обраного' : 'Додати в обране'}" title="${fav ? 'Прибрати з обраного' : 'Додати в обране'}">
            <span class="star-icon">${fav ? '★' : '☆'}</span>
        </button>
        <span class="bus-kind-emoji" aria-hidden="true">${urban ? '🏙️' : '🌄'}</span>
        <span class="bus-num" style="color: ${bus.color || 'inherit'}">№${bus.number}</span>
        ${priceHtml}
        <div class="bus-title">${bus.title}</div>
        <div class="bus-countdown" data-bus="${routeIdStr}"></div>
    `;

    const favBtn = card.querySelector('.fav-btn');
    favBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleFavorite(routeIdStr);
        const searchInput = document.getElementById('search-input');
        const term = searchInput ? searchInput.value.trim().toLowerCase() : '';
        if (term) {
            searchInput.dispatchEvent(new Event('input'));
        } else {
            renderBusGrid(allBusData);
        }
    });

    return { card, urban };
}

function renderBusGrid(buses) {
    const urbanContainer = document.querySelector('.bus-grid-urban');
    const suburbanContainer = document.querySelector('.bus-grid-suburban');
    const generalContainer = document.getElementById('bus-grid');
    const emptyState = document.getElementById('empty-state');
    const urbanSection = document.getElementById('urban-section');
    const suburbanSection = document.getElementById('suburban-section');
    const urbanCountEl = document.getElementById('urban-count');
    const suburbanCountEl = document.getElementById('suburban-count');

    if (urbanContainer) urbanContainer.innerHTML = '';
    if (suburbanContainer) suburbanContainer.innerHTML = '';
    if (generalContainer) {
        generalContainer.innerHTML = '';
        generalContainer.style.display = 'none';
    }

    const useSections = urbanContainer && suburbanContainer;
    const sorted = sortByFavorites(buses || []);

    let urbanCount = 0;
    let suburbanCount = 0;

    sorted.forEach(bus => {
        const { card, urban } = buildBusCard(bus);
        if (useSections) {
            if (urban) { urbanContainer.appendChild(card); urbanCount++; }
            else { suburbanContainer.appendChild(card); suburbanCount++; }
        } else if (generalContainer) {
            generalContainer.appendChild(card);
            generalContainer.style.display = '';
        }
    });

    if (useSections) {
        // Лічильники маршрутів у заголовках секцій
        if (urbanCountEl) urbanCountEl.textContent = urbanCount;
        if (suburbanCountEl) suburbanCountEl.textContent = suburbanCount;
        // Ховаємо секцію цілком, якщо в ній нічого немає (наприклад, під час пошуку)
        if (urbanSection) urbanSection.style.display = urbanCount ? '' : 'none';
        if (suburbanSection) suburbanSection.style.display = suburbanCount ? '' : 'none';
    }

    const total = useSections ? (urbanCount + suburbanCount) : sorted.length;
    if (emptyState) emptyState.style.display = total === 0 ? 'flex' : 'none';

    updateCardCountdowns();
}

// Оновлення countdown-бейджа на картках
function updateCardCountdowns() {
    document.querySelectorAll('.bus-countdown').forEach(el => {
        const num = el.dataset.bus;
        const bus = allBusData.find(b => b.number.toString() === num);
        if (!bus) { el.innerHTML = ''; return; }
        const nxt = findNextDeparture(bus);
        if (!nxt) {
            el.innerHTML = `<span class="countdown-pill done">⏹ на сьогодні все</span>`;
            return;
        }
        const isSoon = nxt.diff <= 15;
        el.innerHTML = `<span class="countdown-pill ${isSoon ? 'soon' : ''}">🚌 ${formatDiffMinutes(nxt.diff)} (${nxt.time})</span>`;
    });
}

// -----------------------------------------------------------
// 5. ВІДКРИТТЯ РОЗКЛАДУ
// -----------------------------------------------------------
function openSchedule(bus, routeId, options) {
    options = options || {};
    currentBus = bus;

    const url = `${window.location.pathname}#bus=${bus.number}`;
    if (options.skipPush) {
        // popstate-режим
    } else if (options.replace) {
        history.replaceState({ view: 'schedule', busId: bus.number }, `Маршрут №${bus.number}`, url);
    } else {
        history.pushState({ view: 'schedule', busId: bus.number }, `Маршрут №${bus.number}`, url);
    }
    switchView('schedule');

    const titleEl = document.getElementById('route-title-display');
    titleEl.innerHTML = `№${bus.number} ${bus.title}`;

    // Тулбар (поширення + сповіщення)
    renderRouteToolbar(bus);

    // 🆕 Вкладки прямий/зворотній зі списком зупинок (якщо є directionRoutes)
    renderDirectionView(bus);

    // Банер з найближчим рейсом
    updateNextBanner();

    // Ціна
    const priceDisplay = document.getElementById('route-price-display');
    if (priceDisplay) {
        if (SUBURBAN_DATA[routeId]) {
            const info = SUBURBAN_DATA[routeId];
            let html = `Вартість проїзду: <span style="color:var(--primary); font-weight:800;">${info.price}</span>`;
            if (info.note) html += `<br><span style="font-size:0.9em; opacity:0.8; font-weight:400;">${info.note}</span>`;
            priceDisplay.innerHTML = html;
        } else if (CITY_ROUTES_IDS.includes(routeId)) {
            priceDisplay.innerHTML = `Вартість проїзду: <span style="color:var(--fares-color-light); font-weight:800;">13 грн</span>`;
        } else {
            priceDisplay.innerHTML = '';
        }
    }

    renderRouteDetails(bus);
    window.scrollTo(0, 0);

    // Прокрутити .times-row так, щоб видно було наступний рейс
    setTimeout(scrollNextIntoView, 150);
}

// Прокрутка горизонтальної смужки часів до .next-беджа
function scrollNextIntoView() {
    document.querySelectorAll('#schedule-container .times-row').forEach(row => {
        const next = row.querySelector('.time-badge.next');
        if (next && typeof next.scrollIntoView === 'function') {
            try {
                next.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
            } catch (_) { /* старі браузери */ }
        }
    });
}

// -----------------------------------------------------------
// 🛎️ ТУЛБАР: SHARE + NOTIFY
// -----------------------------------------------------------
function renderRouteToolbar(bus) {
    const toolbar = document.getElementById('route-toolbar');
    if (!toolbar) return;

    const subscribed = subscribedRoutes.includes(bus.number.toString());
    const notifyLabel = subscribed
        ? '<span class="bell-icon">🔕</span> Вимкнути сповіщення'
        : '<span class="bell-icon">🔔</span> Нагадати про автобус';
    const notifyClass = subscribed ? 'notification-btn active' : 'notification-btn';

    toolbar.innerHTML = `
        <div class="toolbar-row toolbar-share-row">
            <span class="toolbar-label">📤 Поділитись:</span>
            <div class="share-buttons">
                <button class="share-btn share-tg" data-platform="telegram" aria-label="Поділитись у Telegram">
                    <i class="fa-brands fa-telegram"></i>
                </button>
                <button class="share-btn share-viber" data-platform="viber" aria-label="Поділитись у Viber">
                    <i class="fa-brands fa-viber"></i>
                </button>
                <button class="share-btn share-wa" data-platform="whatsapp" aria-label="Поділитись у WhatsApp">
                    <i class="fa-brands fa-whatsapp"></i>
                </button>
                <button class="share-btn share-copy" data-platform="copy" aria-label="Скопіювати посилання">
                    <i class="fa-regular fa-copy"></i>
                </button>
            </div>
        </div>
        <div class="toolbar-row toolbar-notify-row">
            <button id="notify-btn" class="${notifyClass}">${notifyLabel}</button>
        </div>
    `;

    toolbar.querySelectorAll('.share-btn').forEach(btn => {
        btn.addEventListener('click', () => shareRoute(btn.dataset.platform, bus));
    });

    const notifyBtn = document.getElementById('notify-btn');
    if (notifyBtn) notifyBtn.addEventListener('click', () => toggleSubscription(bus.number));
}

// -----------------------------------------------------------
// 📤 SHARE — Telegram / Viber / WhatsApp / Copy link
// -----------------------------------------------------------
function buildShareData(bus) {
    const baseUrl = `${window.location.origin}${window.location.pathname}#bus=${bus.number}`;
    const text = `🚌 Розклад маршруту №${bus.number} ${bus.title} — SmilaBusTime`;
    return { url: baseUrl, text, full: `${text}\n${baseUrl}` };
}

function shareRoute(platform, bus) {
    const data = buildShareData(bus);

    switch (platform) {
        case 'telegram': {
            const url = `https://t.me/share/url?url=${encodeURIComponent(data.url)}&text=${encodeURIComponent(data.text)}`;
            window.open(url, '_blank', 'noopener,noreferrer');
            break;
        }
        case 'viber': {
            // viber://forward — мобільний додаток Viber.
            // На desktop спрацює, якщо встановлений Viber Desktop.
            const vbUrl = `viber://forward?text=${encodeURIComponent(data.full)}`;
            window.location.href = vbUrl;
            break;
        }
        case 'whatsapp': {
            const url = `https://wa.me/?text=${encodeURIComponent(data.full)}`;
            window.open(url, '_blank', 'noopener,noreferrer');
            break;
        }
        case 'copy': {
            const fallbackCopy = (txt) => {
                const ta = document.createElement('textarea');
                ta.value = txt;
                ta.style.position = 'fixed';
                ta.style.opacity = '0';
                document.body.appendChild(ta);
                ta.select();
                try { document.execCommand('copy'); } catch (_) { /* nothing */ }
                document.body.removeChild(ta);
            };
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(data.full)
                    .then(() => showToast('🔗 Посилання скопійовано!'))
                    .catch(() => { fallbackCopy(data.full); showToast('🔗 Посилання скопійовано!'); });
            } else {
                fallbackCopy(data.full);
                showToast('🔗 Посилання скопійовано!');
            }
            break;
        }
        case 'native': {
            if (navigator.share) {
                navigator.share({ title: data.text, text: data.text, url: data.url }).catch(() => {});
            }
            break;
        }
    }
}

function showToast(msg) {
    let t = document.getElementById('sbt-toast');
    if (!t) {
        t = document.createElement('div');
        t.id = 'sbt-toast';
        t.className = 'sbt-toast';
        document.body.appendChild(t);
    }
    t.textContent = msg;
    requestAnimationFrame(() => t.classList.add('show'));
    clearTimeout(showToast._h);
    showToast._h = setTimeout(() => t.classList.remove('show'), 2200);
}

// -----------------------------------------------------------
// 🔗 DEEP LINK — відкрити маршрут із URL #bus=NN
// -----------------------------------------------------------
function handleHashRoute() {
    const m = window.location.hash.match(/^#bus=(.+)$/);
    if (!m) return;
    const num = decodeURIComponent(m[1]).trim();
    const bus = allBusData.find(b => b.number.toString() === num);
    if (bus) {
        openSchedule(bus, bus.number.toString(), { replace: true });
    }
}

// -----------------------------------------------------------
// 📁 ЗГОРТАННЯ СЕКЦІЙ (direction view + schedule blocks)
// -----------------------------------------------------------
function getCollapsedState() {
    try { return JSON.parse(localStorage.getItem('collapsedSections') || '{}'); }
    catch (e) { return {}; }
}
function setCollapsedState(state) {
    try { localStorage.setItem('collapsedSections', JSON.stringify(state)); }
    catch (e) {}
}

// Згортання за іменованим ключем (для schedule route-block)
function toggleSectionByKey(key) {
    const state = getCollapsedState();
    state[key] = !state[key];
    setCollapsedState(state);
    applyCollapsedStateByKey(key);
}
function applyCollapsedStateByKey(key, defaultCollapsed) {
    const state = getCollapsedState();
    // Якщо в localStorage немає явного значення — використовуємо default
    let isCollapsed;
    if (key in state) {
        isCollapsed = state[key];
    } else {
        isCollapsed = !!defaultCollapsed;
    }
    const block = document.querySelector(`.route-block[data-section-key="${key}"]`);
    if (!block) return;
    block.classList.toggle('is-collapsed', isCollapsed);
    const btn = block.querySelector('.route-collapse-btn');
    if (btn) btn.setAttribute('aria-expanded', String(!isCollapsed));
}

// Згортання для direction view (per-bus)
function toggleSection(section, busNumber) {
    const key = `${section}_${busNumber}`;
    const state = getCollapsedState();
    state[key] = !state[key];
    setCollapsedState(state);
    applyCollapsedState(section, busNumber);
}
function applyCollapsedState(section, busNumber) {
    const key = `${section}_${busNumber}`;
    const state = getCollapsedState();
    const isCollapsed = !!state[key];

    if (section === 'direction') {
        const wrap = document.getElementById('direction-view-container');
        const body = document.getElementById('direction-body');
        const btn  = document.getElementById('direction-collapse-btn');
        const label = btn ? btn.querySelector('.collapse-label') : null;
        if (wrap) wrap.classList.toggle('is-collapsed', isCollapsed);
        if (body) body.style.display = isCollapsed ? 'none' : '';
        if (label) label.textContent = isCollapsed ? 'Показати зупинки' : 'Згорнути зупинки';
        if (btn) btn.setAttribute('aria-expanded', String(!isCollapsed));
    }
}

// -----------------------------------------------------------
// 🔀 ВКЛАДКИ "ПРЯМИЙ / ЗВОРОТНІЙ" + СПИСОК ЗУПИНОК З ВІДЛІКОМ
// -----------------------------------------------------------
let currentDirection = 'forward'; // 'forward' або 'backward'

function computeStopArrival(dir, stop, nowMin) {
    const offset = stop.offsetMin || 0;
    for (let i = 0; i < dir.departureTimes.length; i++) {
        const depMin = parseTimeStr(dir.departureTimes[i]);
        if (depMin === null) continue;
        const arrMin = depMin + offset;
        if (arrMin >= nowMin) {
            return { arrMin, depMin, diff: arrMin - nowMin };
        }
    }
    return null;
}

function formatStopArrival(arr) {
    if (!arr) return { text: '—', cls: 'done' };
    if (arr.diff < 1)  return { text: 'Зараз', cls: 'now' };
    if (arr.diff <= 60) return { text: `${arr.diff} хв`, cls: 'soon' };
    const h = Math.floor(arr.diff / 60);
    const m = arr.diff % 60;
    return { text: m === 0 ? `${h} год` : `${h} год ${m} хв`, cls: 'later' };
}

function renderDirectionView(bus) {
    const wrap = document.getElementById('direction-view-container');
    if (!wrap) return;
    wrap.innerHTML = '';

    if (!bus.directionRoutes || !bus.directionRoutes.forward || !bus.directionRoutes.backward) {
        wrap.style.display = 'none';
        return;
    }
    wrap.style.display = 'block';

    wrap.innerHTML = `
        <div class="direction-tabs glass-panel" id="direction-tabs">
            <button class="dir-tab" data-dir="forward">Прямий</button>
            <button class="dir-tab" data-dir="backward">Зворотній</button>
            <span class="dir-tab-indicator"></span>
        </div>
        <button class="section-collapse-btn" id="direction-collapse-btn" aria-label="Згорнути/розгорнути">
            <span class="collapse-label">Згорнути зупинки</span>
            <span class="collapse-chevron">⌃</span>
        </button>
        <div class="section-body" id="direction-body">
            <div class="direction-meta">
                <span class="direction-name" id="direction-name"></span>
                <span class="direction-workdays" id="direction-workdays"></span>
            </div>
            <div class="direction-list" id="direction-list"></div>
        </div>
    `;

    wrap.querySelectorAll('.dir-tab').forEach(btn => {
        btn.addEventListener('click', () => setDirection(btn.dataset.dir));
    });

    // Кнопка згортання
    const collapseBtn = document.getElementById('direction-collapse-btn');
    if (collapseBtn) {
        collapseBtn.addEventListener('click', () => toggleSection('direction', bus.number));
    }
    applyCollapsedState('direction', bus.number);

    setDirection(currentDirection || 'forward');
}

function setDirection(dir) {
    currentDirection = dir;
    const wrap = document.getElementById('direction-view-container');
    if (!wrap) return;

    wrap.querySelectorAll('.dir-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.dir === dir);
    });
    const tabs = wrap.querySelector('.direction-tabs');
    if (tabs) tabs.classList.toggle('backward', dir === 'backward');

    renderStopList();
}

function renderStopList() {
    if (!currentBus || !currentBus.directionRoutes) return;
    const dirData = currentBus.directionRoutes[currentDirection];
    if (!dirData) return;

    const nameEl = document.getElementById('direction-name');
    const wdEl   = document.getElementById('direction-workdays');
    const list   = document.getElementById('direction-list');
    if (!list) return;

    if (nameEl) nameEl.textContent = '➡️ ' + (dirData.name || '');
    if (wdEl)   wdEl.textContent   = dirData.workDays ? '📅 ' + dirData.workDays : '';

    const nowMin = getCurrentMinutes();
    let html = '';

    dirData.stops.forEach((stop, idx) => {
        const arr = computeStopArrival(dirData, stop, nowMin);
        const fmt = formatStopArrival(arr);

        const isFirst = idx === 0;
        const isLast  = idx === dirData.stops.length - 1;
        const markerCls = isFirst ? 'first' : (isLast ? 'last' : 'middle');
        const letterFirst = currentDirection === 'forward' ? 'A' : 'B';
        const letterLast  = currentDirection === 'forward' ? 'B' : 'A';

        let markerInner = '<span class="stop-dot"></span>';
        if (isFirst)      markerInner = `<span class="stop-terminal">${letterFirst}</span>`;
        else if (isLast)  markerInner = `<span class="stop-terminal">${letterLast}</span>`;

        html += `
            <div class="stop-row ${arr && arr.diff < 1 ? 'is-now' : ''}" data-idx="${idx}">
                <div class="stop-line stop-line-${markerCls}">
                    ${markerInner}
                </div>
                <div class="stop-label">${stop.name}</div>
                <div class="stop-time stop-time-${fmt.cls}">${fmt.text}</div>
            </div>
        `;
    });

    list.innerHTML = html;
}

function refreshDirectionStops() {
    if (!currentBus || !currentBus.directionRoutes) return;
    renderStopList();
}

// -----------------------------------------------------------
// 🚌 БАНЕР: Наступний автобус
// -----------------------------------------------------------
function updateNextBanner() {
    const banner = document.getElementById('next-banner');
    if (!banner || !currentBus) return;
    const nxt = findNextDeparture(currentBus);
    if (!nxt) {
        banner.style.display = 'flex';
        banner.innerHTML = `<span class="nb-icon">⏹</span><span class="nb-text">На сьогодні рейсів більше немає</span>`;
        banner.classList.remove('soon');
        return;
    }
    const soon = nxt.diff <= 10;
    banner.classList.toggle('soon', soon);
    banner.style.display = 'flex';
    banner.innerHTML = `
        <span class="nb-icon">🚌</span>
        <div class="nb-content">
            <div class="nb-main">Наступний ${formatDiffMinutes(nxt.diff)}</div>
            <div class="nb-sub">${nxt.time} · ${nxt.stop}</div>
        </div>
    `;
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
                <iframe frameborder="0" src="${mapSrc}" width="100%" height="303" loading="lazy"></iframe>
            </div>
        </div>
    `;

    html += '<div class="col-xs-12 col-md-6 schedule-column">';
    html += `<h4 class="schedule-title">Розклад руху (Маршрут №${bus.number})</h4>`;

    const currentMinutes = getCurrentMinutes();

    bus.routes.forEach((route, routeIdx) => {
        // Скільки всього часів у цьому напрямку (для авто-згортання)
        let totalTimes = 0;
        route.stops.forEach(s => { totalTimes += (s.times || []).length; });
        const isLongRoute = totalTimes >= 20;

        let stopsHTML = '';
        route.stops.forEach(stop => {
            let timesHTML = '';
            let foundNext = false;
            stop.times.forEach(timeStr => {
                const busMinutes = parseTimeStr(timeStr);
                let className = 'time-badge';
                if (busMinutes !== null) {
                    if (busMinutes < currentMinutes) { className += ' past'; }
                    else if (!foundNext) { className += ' next'; foundNext = true; }
                }
                timesHTML += `<span class="${className}" data-min="${busMinutes !== null ? busMinutes : ''}">${timeStr}</span>`;
            });
            stopsHTML += `<div class="stop-item"><span class="stop-name">🚏 ${stop.name}</span><div class="times-row">${timesHTML}</div></div>`;
        });

        const sectionKey = `schedule_${bus.number}_${routeIdx}`;
        html += `
            <div class="route-block" data-section-key="${sectionKey}" data-long="${isLongRoute ? '1' : '0'}">
                <h3 class="route-direction route-direction-collapsible">
                    <span class="route-direction-text">
                        ➡️ ${route.direction}
                        <br><small style="font-size:0.7em; color:#666">📅 ${route.workDays}</small>
                    </span>
                    <button class="route-collapse-btn" data-section-key="${sectionKey}" aria-label="Згорнути/розгорнути">
                        <span class="collapse-chevron">⌃</span>
                    </button>
                </h3>
                <div class="route-block-body">${stopsHTML}</div>
            </div>
        `;
    });

    html += '</div></div>';
    container.innerHTML = html;

    // Вішаємо обробники + застосовуємо збережений стан
    container.querySelectorAll('.route-collapse-btn').forEach(btn => {
        const key = btn.dataset.sectionKey;
        btn.addEventListener('click', () => toggleSectionByKey(key));
    });
    // Застосовуємо стани: для довгих графіків — згорнути за замовчуванням
    container.querySelectorAll('.route-block').forEach(block => {
        const key = block.dataset.sectionKey;
        const isLong = block.dataset.long === '1';
        applyCollapsedStateByKey(key, isLong); // isLong = default-collapsed
    });
}

// Оновлення past/next без перерендеру
function refreshScheduleBadges() {
    const current = getCurrentMinutes();
    document.querySelectorAll('#schedule-container .times-row').forEach(row => {
        let foundNext = false;
        row.querySelectorAll('.time-badge').forEach(badge => {
            const min = parseInt(badge.dataset.min, 10);
            badge.classList.remove('past', 'next');
            if (isNaN(min)) return;
            if (min < current) {
                badge.classList.add('past');
            } else if (!foundNext) {
                badge.classList.add('next');
                foundNext = true;
            }
        });
    });
}

// -----------------------------------------------------------
// ДОДАТКОВІ (ГОДИННИК, ТЕМА, ДАТА У ФУТЕРІ, SW)
// -----------------------------------------------------------
function setupClock() {
    const clockEl = document.getElementById('clock');
    if (!clockEl) return;
    const update = () => {
        const now = new Date();
        clockEl.innerText = now.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
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

function setupFooterDate() {
    const el = document.getElementById('footer-date');
    if (el) el.textContent = `Оновлено: ${APP_UPDATED}`;
}

function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    if (window.location.protocol !== 'http:' && window.location.protocol !== 'https:') return;
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .catch(err => console.warn('[SW] Реєстрація не вдалася:', err));
    });
}

// ===========================================================
// 🔔 СИСТЕМА СПОВІЩЕНЬ (NOTIFICATIONS)
// ===========================================================

let subscribedRoutes = [];
try {
    subscribedRoutes = JSON.parse(localStorage.getItem('subscribedRoutes') || '[]');
} catch (_) { subscribedRoutes = []; }

setInterval(checkBusNotifications, 60000);

// Запобігаємо повторним сповіщенням про той самий рейс
const _notifiedKeys = new Set();

function toggleSubscription(busNumber) {
    if (typeof Notification === 'undefined') {
        showToast('⚠️ Браузер не підтримує сповіщення');
        return;
    }
    if (Notification.permission !== "granted") {
        Notification.requestPermission().then(permission => {
            if (permission === "granted") {
                toggleSubscriptionLogic(busNumber);
            } else {
                showToast('Дозвольте сповіщення в налаштуваннях');
            }
        });
    } else {
        toggleSubscriptionLogic(busNumber);
    }
}

function toggleSubscriptionLogic(busNumber) {
    const idStr = busNumber.toString();
    const index = subscribedRoutes.indexOf(idStr);
    const btn = document.getElementById('notify-btn');

    if (index === -1) {
        subscribedRoutes.push(idStr);
        if (btn) {
            btn.classList.add('active');
            btn.innerHTML = '<span class="bell-icon">🔕</span> Вимкнути сповіщення';
        }
        sendLocalNotification("Сповіщення увімкнено!", `Ми попередимо вас про маршрут №${busNumber}.`);
    } else {
        subscribedRoutes.splice(index, 1);
        if (btn) {
            btn.classList.remove('active');
            btn.innerHTML = '<span class="bell-icon">🔔</span> Нагадати про автобус';
        }
    }

    localStorage.setItem('subscribedRoutes', JSON.stringify(subscribedRoutes));
}

function sendLocalNotification(title, body) {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission === "granted") {
        try {
            new Notification(title, {
                body: body,
                icon: 'img/com.googlove.smilabus_0.0_3_icon.png',
                badge: 'img/favicon.ico',
                vibrate: [200, 100, 200]
            });
        } catch (e) {
            console.log("Browser does not support standard Notification API");
        }
    }
}

function checkBusNotifications() {
    if (subscribedRoutes.length === 0) return;

    const currentMinutes = getCurrentMinutes();
    const today = new Date().toDateString();

    allBusData.forEach(bus => {
        if (!subscribedRoutes.includes(bus.number.toString())) return;
        bus.routes.forEach(route => {
            route.stops.forEach(stop => {
                stop.times.forEach(timeStr => {
                    const busMinutes = parseTimeStr(timeStr);
                    if (busMinutes === null) return;
                    const diff = busMinutes - currentMinutes;
                    if (diff === 15 || diff === 10 || diff === 5) {
                        const key = `${today}|${bus.number}|${stop.name}|${busMinutes}|${diff}`;
                        if (_notifiedKeys.has(key)) return;
                        _notifiedKeys.add(key);
                        const cleanTime = String(timeStr).split(' ')[0];
                        sendLocalNotification(
                            `🚌 Маршрут №${bus.number}`,
                            `Автобус буде на "${stop.name}" через ${diff} хв (${cleanTime})`
                        );
                    }
                });
            });
        });
    });
}
