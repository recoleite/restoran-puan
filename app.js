const API = '';
const LOGIN_URL = '/login.html';
const TAG_PRESETS = ['İlk buluşma', 'Doğum günü', 'Yıldönümü', 'Özel gün', 'Kutlama'];
const SPECIAL_TAGS = new Set(TAG_PRESETS);
const DEFAULT_SORT = 'date';
const CATEGORY_LABELS = { food: 'Yemek', service: 'Servis', atmosphere: 'Atmosfer', price: 'Fiyat' };

let cachedNames = [];
let allRestaurants = [];
let allWishlist = [];
let appSettings = { coupleName1: '', coupleName2: '', theme: 'rose' };
let addPhotoData = [];
let addCoverPhoto = null;
let visitPhotoData = [];
let visitCoverPhoto = null;
let namePickerTarget = 'add';
let currentView = 'list';
let mapInstance = null;
let markerCluster = null;
let visitRestaurantId = null;
let selectedAddTags = [];
let selectedVisitTags = [];
let rouletteSpinning = false;
let roulettePool = [];
let rouletteRotation = 0;
let rouletteFromWishlist = false;
const ROULETTE_COLORS = ['#f43f5e', '#fbbf24', '#10b981', '#8b5cf6', '#3b82f6', '#ec4899', '#14b8a6', '#f97316'];
const photoGalleries = {};
let lightboxPhotos = [];
let lightboxIndex = 0;
let currentUser = null;
let subtitleTimer = null;

const FUN_TOASTS = {
    add: [
        'Yeni lezzet durağı kaydedildi!',
        'Listeye bir mekân daha eklendi.',
        'Damak hafızası güncellendi.',
        'Bir sonraki anı için hazır.'
    ],
    first: [
        'İlk restoran! Macera resmen başladı.',
        'Lezzet günlüğünün ilk sayfası açıldı.'
    ],
    milestone: [
        '{n} restoran — artık seçenek bolluğu var!',
        '{n} mekân! Gurme çift modu aktif.'
    ],
    perfect: [
        '5 yıldız! Bu mekân altın listede.',
        'Mükemmel puan — tekrar gidilir.',
        'İkiniz de bayıldınız demek ki.'
    ],
    favorite: [
        'Favorilere eklendi.',
        'Kalbe kaydedildi.',
        'Bu mekân artık özel listede.'
    ],
    visit: [
        'Yeni anı eklendi!',
        'Bir ziyaret daha, bir hikâye daha.',
        'Günlüğe bir sayfa daha.'
    ],
    roulette: [
        'Kader konuştu — bugün burası!',
        'Çark karar verdi, şapkayı takın.',
        'Bu akşamın adresi belli oldu.'
    ]
};

const FUN_SUBTITLES = [
    'Birlikte keşfettiğimiz lezzetler',
    'Kararsız mı kaldınız? Çarkı çevirin',
    'Her ziyaret küçük bir anı',
    'Favoriler kalpte, gerisi listede',
    'Bugün nereye açız?'
];

function pickOne(list) {
    return list[Math.floor(Math.random() * list.length)];
}

function funMessage(category, vars = {}) {
    let pool = FUN_TOASTS[category] || FUN_TOASTS.add;
    let msg = pickOne(pool);
    Object.entries(vars).forEach(([key, val]) => {
        msg = msg.replace(new RegExp(`\\{${key}\\}`, 'g'), val);
    });
    return msg;
}

function burstConfetti({ count = 24, x, y } = {}) {
    const root = document.getElementById('confetti-root');
    if (!root) return;
    const colors = ['var(--accent)', 'var(--accent-2)', 'var(--gold)', '#fbbf24', '#fb7185', '#a78bfa'];
    const originX = x ?? window.innerWidth / 2;
    const originY = y ?? window.innerHeight * 0.38;
    for (let i = 0; i < count; i++) {
        const piece = document.createElement('span');
        piece.className = 'confetti-piece';
        piece.style.left = `${originX}px`;
        piece.style.top = `${originY}px`;
        piece.style.background = colors[i % colors.length];
        piece.style.setProperty('--dx', `${(Math.random() - 0.5) * 300}px`);
        piece.style.setProperty('--dy', `${Math.random() * -340 - 60}px`);
        piece.style.setProperty('--rot', `${Math.random() * 720 - 360}deg`);
        piece.style.animationDelay = `${Math.random() * 0.12}s`;
        root.appendChild(piece);
        piece.addEventListener('animationend', () => piece.remove());
    }
}

function flashToast(msg, { confetti = false, fun = false } = {}) {
    sessionStorage.setItem('toast', JSON.stringify({ msg, confetti, fun }));
}

function buildSubtitleLines() {
    const { coupleName1, coupleName2 } = appSettings;
    const lines = [...FUN_SUBTITLES];
    if (coupleName1 && coupleName2) {
        lines.unshift(`${coupleName1} & ${coupleName2}'nin lezzet haritası`);
    }
    return lines;
}

function rotateSubtitle(reset = false) {
    const el = document.getElementById('app-subtitle');
    if (!el) return;
    const lines = buildSubtitleLines();
    let idx = reset ? 0 : Math.floor(Math.random() * lines.length);
    clearInterval(subtitleTimer);
    el.textContent = lines[idx];
    el.style.transition = 'opacity 0.35s ease';
    subtitleTimer = setInterval(() => {
        el.classList.add('subtitle-fade');
        setTimeout(() => {
            idx = (idx + 1) % lines.length;
            el.textContent = lines[idx];
            el.classList.remove('subtitle-fade');
        }, 350);
    }, 9000);
}

const nativeFetch = window.fetch.bind(window);
window.fetch = async (url, options = {}) => {
    const headers = new Headers(options.headers || {});
    const token = localStorage.getItem('authToken');
    if (typeof url === 'string' && !url.startsWith('http') && token) {
        headers.set('Authorization', `Bearer ${token}`);
    }
    const res = await nativeFetch(url, { ...options, headers, credentials: 'same-origin' });
    if (
        res.status === 401 &&
        typeof url === 'string' &&
        !url.startsWith('http') &&
        !url.startsWith('/auth/')
    ) {
        redirectToLogin();
    }
    return res;
};

// --- AUTH ---
function redirectToLogin() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('restoranAuth');
    window.location.replace(LOGIN_URL);
}

function bootApp() {
    document.body.classList.remove('auth-pending');
    setupUI();
    initMascot();
    loadRestaurants();
    loadStats();
    loadWishlist();
    const flash = sessionStorage.getItem('toast');
    if (flash) {
        sessionStorage.removeItem('toast');
        try {
            const data = JSON.parse(flash);
            showToast(data.msg, { confetti: data.confetti, fun: data.fun });
        } catch {
            showToast(flash);
        }
    }
}

async function initApp() {
    const meRes = await fetch(`${API}/auth/me`);
    if (!meRes.ok) {
        redirectToLogin();
        return;
    }

    const me = await meRes.json();
    currentUser = me.user;
    appSettings = { ...appSettings, ...me.settings };
    applySettings();
    bootApp();
}

async function logout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('restoranAuth');
    try {
        await fetch(`${API}/auth/logout`, { method: 'POST' });
    } catch { /* yönlendirme yine de yapılır */ }
    window.location.replace(LOGIN_URL);
}

// --- SETTINGS ---
async function loadSettings() {
    const res = await fetch(`${API}/settings`);
    appSettings = await res.json();
    applySettings();
}

const APP_THEMES = [
    { id: 'rose', label: 'Gül', swatch: 'theme-swatch-rose', group: 'light' },
    { id: 'cherry', label: 'Kiraz', swatch: 'theme-swatch-cherry', group: 'light' },
    { id: 'sunset', label: 'Gün batımı', swatch: 'theme-swatch-sunset', group: 'light' },
    { id: 'cream', label: 'Krem', swatch: 'theme-swatch-cream', group: 'light' },
    { id: 'lavender', label: 'Lila', swatch: 'theme-swatch-lavender', group: 'light' },
    { id: 'ocean', label: 'Turkuaz', swatch: 'theme-swatch-ocean', group: 'light' },
    { id: 'sky', label: 'Gökyüzü', swatch: 'theme-swatch-sky', group: 'light' },
    { id: 'forest', label: 'Orman', swatch: 'theme-swatch-forest', group: 'light' },
    { id: 'dark', label: 'Gül koyu', swatch: 'theme-swatch-dark', group: 'dark' },
    { id: 'cherry-dark', label: 'Kiraz koyu', swatch: 'theme-swatch-cherry-dark', group: 'dark' },
    { id: 'sunset-dark', label: 'Gün batımı koyu', swatch: 'theme-swatch-sunset-dark', group: 'dark' },
    { id: 'cream-dark', label: 'Krem koyu', swatch: 'theme-swatch-cream-dark', group: 'dark' },
    { id: 'lavender-dark', label: 'Lila koyu', swatch: 'theme-swatch-lavender-dark', group: 'dark' },
    { id: 'ocean-dark', label: 'Turkuaz koyu', swatch: 'theme-swatch-ocean-dark', group: 'dark' },
    { id: 'sky-dark', label: 'Gökyüzü koyu', swatch: 'theme-swatch-sky-dark', group: 'dark' },
    { id: 'forest-dark', label: 'Orman koyu', swatch: 'theme-swatch-forest-dark', group: 'dark' }
];
const ALLOWED_THEMES = APP_THEMES.map(t => t.id);
const THEME_STORAGE_KEY = 'restoranTheme';

function persistTheme(theme) {
    const safe = ALLOWED_THEMES.includes(theme) ? theme : 'rose';
    try { localStorage.setItem(THEME_STORAGE_KEY, safe); } catch { /* ignore */ }
}

function applyTheme(theme) {
    const safe = ALLOWED_THEMES.includes(theme) ? theme : 'rose';
    document.documentElement.setAttribute('data-theme', safe);
    persistTheme(safe);
}

function applySettings() {
    const { coupleName1, coupleName2, theme } = appSettings;
    applyTheme(theme);

    const titleText = coupleName1 && coupleName2
        ? `${coupleName1} & ${coupleName2}`
        : coupleName1 ? `${coupleName1}'in Restoranları` : 'Bizim Restoranlarımız';
    const subtitleText = 'Birlikte keşfettiğimiz lezzetler';

    const titleEl = document.getElementById('app-title');
    if (titleEl) titleEl.textContent = titleText;
    const subtitleEl = document.getElementById('app-subtitle');
    if (subtitleEl) subtitleEl.textContent = subtitleText;
    updateRatingLabels();
    rotateSubtitle(true);
}

let selectedTheme = 'rose';

function pickTheme(theme) {
    selectedTheme = theme;
    document.querySelectorAll('.theme-option').forEach(el => {
        el.classList.toggle('active', el.dataset.theme === theme);
    });
}

function openSettingsModal() {
    selectedTheme = appSettings.theme || 'rose';
    const modal = document.getElementById('settings-modal');
    modal.classList.remove('hidden');
    const themes = APP_THEMES;
    modal.innerHTML = `<div class="modal-box">
        <div class="flex justify-between mb-4">
            <h2 class="font-display font-semibold theme-text">Kişiselleştir</h2>
            <button onclick="closeModal('settings-modal')" class="text-2xl opacity-40">×</button>
        </div>
        <div class="space-y-4">
            <div><label class="label">Senin Adın</label>
            <input type="text" id="settings-name1" class="input" value="${escapeHtml(appSettings.coupleName1)}" placeholder="Ayşe"></div>
            <div><label class="label">Sevgilinin Adı</label>
            <input type="text" id="settings-name2" class="input" value="${escapeHtml(appSettings.coupleName2)}" placeholder="Mehmet"></div>
            <div><label class="label">Tema</label>
            ${['light', 'dark'].map(group => {
                const label = group === 'light' ? 'Açık temalar' : 'Koyu temalar';
                const items = themes.filter(t => t.group === group);
                return `<div class="theme-section">
                    <p class="theme-section-label">${label}</p>
                    <div class="theme-picker">${items.map(t => `
                        <button type="button" class="theme-option ${selectedTheme === t.id ? 'active' : ''}" data-theme="${t.id}" onclick="pickTheme('${t.id}')">
                            <div class="theme-swatch ${t.swatch}"></div>${t.label}
                        </button>`).join('')}
                    </div>
                </div>`;
            }).join('')}
            </div>
            <div class="settings-divider"></div>
            <div>
                <p class="settings-section-title">Yedekleme</p>
                <p class="settings-hint">Tüm restoranları, anıları ve ayarları indir veya geri yükle.</p>
                <div class="flex gap-2 mt-2">
                    <button type="button" onclick="exportBackup()" class="btn-secondary flex-1">Yedek İndir</button>
                    <button type="button" onclick="triggerBackupImport()" class="btn-secondary flex-1">Yedek Yükle</button>
                </div>
            </div>
            <button onclick="saveSettings()" class="btn-primary w-full">Kaydet</button>
            <div class="settings-divider"></div>
            <div class="text-center">
                ${currentUser?.email ? `<p class="settings-hint mb-2">${escapeHtml(currentUser.email)}</p>` : ''}
                <button type="button" onclick="closeModal('settings-modal');logout()" class="btn-logout w-full">Çıkış Yap</button>
            </div>
        </div>
    </div>`;
    modal.onclick = e => { if (e.target === modal) closeModal('settings-modal'); };
}

async function saveSettings() {
    const body = {
        coupleName1: document.getElementById('settings-name1').value,
        coupleName2: document.getElementById('settings-name2').value,
        theme: selectedTheme
    };
    const res = await fetch(`${API}/settings`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    appSettings = await res.json();
    applySettings();
    closeModal('settings-modal');
    showToast('Ayarlar kaydedildi!');
}

// --- YEDEKLEME ---
function triggerBackupImport() {
    document.getElementById('backup-file-input')?.click();
}

async function exportBackup() {
    try {
        const res = await fetch(`${API}/backup/export`);
        if (!res.ok) throw new Error('Yedek alınamadı');
        const data = await res.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `restoran-puan-yedek-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(a.href);
        showToast('Yedek indirildi!');
    } catch {
        showToast('Yedek indirilemedi');
    }
}

async function importBackup(ev) {
    const file = ev.target.files?.[0];
    if (!file) return;
    try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (!Array.isArray(data.restaurants)) throw new Error('Geçersiz yedek dosyası');
        const count = data.restaurants.length;
        if (!confirm(`${count} restoran içeren yedek yüklenecek. Mevcut verilerin üzerine yazılır. Devam?`)) return;
        const res = await fetch(`${API}/backup/import`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: text
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Yükleme başarısız');
        showToast(`${result.restaurantCount} restoran geri yüklendi!`);
        setTimeout(() => location.reload(), 800);
    } catch (e) {
        showToast(e.message || 'Yedek yüklenemedi');
    } finally {
        ev.target.value = '';
    }
}

// --- PAYLAŞILABİLİR KART ---
let shareCardMeta = { type: 'summary', filename: '', shareText: '' };
const SHARE_CARD_SIZE = { w: 1080, h: 1920 }; // Instagram Story 9:16

const SHARE_CARD_THEMES = {
    rose: { bg: ['#fff5f5', '#fecdd3'], primary: '#e11d48', light: '#fff1f2', text: '#1f2937', muted: '#6b7280' },
    cherry: { bg: ['#fdf2f8', '#fbcfe8'], primary: '#db2777', light: '#fce7f3', text: '#831843', muted: '#9d174d' },
    sunset: { bg: ['#fff7ed', '#fecdd3'], primary: '#e11d48', light: '#ffedd5', text: '#7c2d12', muted: '#c2410c' },
    dark: { bg: ['#1a1015', '#251820'], primary: '#fb7185', light: '#2a1520', text: '#f3f4f6', muted: '#d1d5db' },
    cream: { bg: ['#fffdf7', '#fde68a'], primary: '#b45309', light: '#fffbeb', text: '#292524', muted: '#78716c' },
    lavender: { bg: ['#faf5ff', '#e9d5ff'], primary: '#8b5cf6', light: '#f5f3ff', text: '#1f2937', muted: '#6b7280' },
    ocean: { bg: ['#f0fdfa', '#99f6e4'], primary: '#0d9488', light: '#ccfbf1', text: '#134e4a', muted: '#0f766e' },
    sky: { bg: ['#eff6ff', '#93c5fd'], primary: '#2563eb', light: '#dbeafe', text: '#1e3a8a', muted: '#1d4ed8' },
    forest: { bg: ['#f0fdf4', '#86efac'], primary: '#059669', light: '#dcfce7', text: '#14532d', muted: '#15803d' },
    'cherry-dark': { bg: ['#140810', '#2a1024'], primary: '#f472b6', light: '#2a1830', text: '#fdf2f8', muted: '#f9a8d4' },
    'sunset-dark': { bg: ['#140808', '#2a1410'], primary: '#fb7185', light: '#2a1814', text: '#fff7ed', muted: '#fdba74' },
    'cream-dark': { bg: ['#120e08', '#282010'], primary: '#f97316', light: '#2a2014', text: '#fffbeb', muted: '#fcd34d' },
    'lavender-dark': { bg: ['#0e0818', '#1e1030'], primary: '#a78bfa', light: '#241838', text: '#f5f3ff', muted: '#c4b5fd' },
    'ocean-dark': { bg: ['#061412', '#102820'], primary: '#2dd4bf', light: '#142a26', text: '#f0fdfa', muted: '#5eead4' },
    'sky-dark': { bg: ['#080e18', '#101828'], primary: '#60a5fa', light: '#142038', text: '#eff6ff', muted: '#93c5fd' },
    'forest-dark': { bg: ['#061410', '#102818'], primary: '#34d399', light: '#142a20', text: '#ecfdf5', muted: '#6ee7b7' }
};

function getCoupleTitle() {
    const { coupleName1, coupleName2 } = appSettings;
    if (coupleName1 && coupleName2) return `${coupleName1} & ${coupleName2}`;
    if (coupleName1) return `${coupleName1}'in Restoranları`;
    return 'Bizim Restoranlarımız';
}

function wrapCanvasText(ctx, text, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let line = '';
    words.forEach(word => {
        const test = line ? `${line} ${word}` : word;
        if (ctx.measureText(test).width > maxWidth && line) {
            lines.push(line);
            line = word;
        } else line = test;
    });
    if (line) lines.push(line);
    return lines;
}

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

function shareCardSlug(text) {
    return (text || 'mekan').toLowerCase().replace(/[^a-z0-9ğüşıöç]+/gi, '-').replace(/^-|-$/g, '').slice(0, 32) || 'mekan';
}

function loadCanvasImage(src) {
    if (!src) return Promise.resolve(null);
    return new Promise(resolve => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = src;
    });
}

function drawCanvasCoverImage(ctx, img, x, y, w, h) {
    const scale = Math.max(w / img.width, h / img.height);
    const sw = img.width * scale;
    const sh = img.height * scale;
    const sx = x + (w - sw) / 2;
    const sy = y + (h - sh) / 2;
    ctx.drawImage(img, sx, sy, sw, sh);
}

function canvasStarString(rating) {
    const full = Math.round(Number(rating) || 0);
    return '★'.repeat(Math.min(5, full)) + '☆'.repeat(Math.max(0, 5 - full));
}

function layoutStorySections(heights, top, bottom, minGap = 28, maxGap = 64) {
    if (!heights.length) return [];
    const total = heights.reduce((sum, h) => sum + h, 0);
    const gaps = heights.length - 1;
    const space = bottom - top - total;
    let gap = gaps > 0 ? space / gaps : 0;
    gap = Math.min(maxGap, Math.max(minGap, gap));
    const block = total + gap * gaps;
    let y = top + Math.max(0, (bottom - top - block) / 2);
    const positions = [];
    heights.forEach((height, index) => {
        positions.push(y);
        y += height + (index < gaps ? gap : 0);
    });
    return positions;
}

function paintShareCardFrame(ctx, w, h, theme) {
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, theme.bg[0]);
    grad.addColorStop(1, theme.bg[1]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.globalAlpha = 0.35;
    ctx.fillStyle = theme.primary;
    ctx.beginPath();
    ctx.arc(900, 220, 240, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(140, h - 280, 200, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.fillStyle = theme.light;
    roundRect(ctx, 60, 60, w - 120, h - 120, 48);
    ctx.fill();
    ctx.strokeStyle = theme.primary;
    ctx.lineWidth = 4;
    ctx.stroke();
}

async function drawShareCard(stats) {
    await document.fonts.ready;
    const canvas = document.getElementById('share-card-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = SHARE_CARD_SIZE.w;
    const h = SHARE_CARD_SIZE.h;
    canvas.width = w;
    canvas.height = h;
    const theme = SHARE_CARD_THEMES[appSettings.theme] || SHARE_CARD_THEMES.rose;
    const title = getCoupleTitle();
    const pad = 60;
    const frameY = pad;
    const frameH = h - pad * 2;
    const contentTop = frameY + 72;
    const contentBottom = frameY + frameH - 88;

    paintShareCardFrame(ctx, w, h, theme);

    ctx.font = 'bold 68px "Instrument Serif", Georgia, serif';
    const titleLines = wrapCanvasText(ctx, title, w - 200);
    const headerH = 170 + titleLines.length * 76;

    const highlights = [];
    if (stats.topRestaurant) highlights.push({ label: 'En çok gidilen', value: `${stats.topRestaurant.name} (${stats.topRestaurant.visits}x)` });
    if (stats.topRated) highlights.push({ label: 'En yüksek puan', value: `${stats.topRated.name} · ${stats.topRated.rating}★` });
    if (stats.favoriteCount) highlights.push({ label: 'Favoriler', value: `${stats.favoriteCount} restoran` });

    const sectionHeights = [headerH, 128, ...highlights.map(() => 124)];
    const sectionYs = layoutStorySections(sectionHeights, contentTop, contentBottom, 32, 52);

    const initials = title.split('&').map(s => s.trim()[0]?.toUpperCase()).filter(Boolean).join(' · ') || 'R';
    const headerY = sectionYs[0];

    ctx.textAlign = 'center';
    ctx.fillStyle = theme.primary;
    ctx.font = 'italic 80px "Instrument Serif", Georgia, serif';
    ctx.fillText(initials, w / 2, headerY + 72);

    ctx.fillStyle = theme.text;
    ctx.font = 'bold 68px "Instrument Serif", Georgia, serif';
    titleLines.forEach((line, i) => ctx.fillText(line, w / 2, headerY + 162 + i * 76));

    ctx.fillStyle = theme.muted;
    ctx.font = '500 34px "DM Sans", system-ui, sans-serif';
    ctx.fillText('Birlikte keşfettiğimiz lezzetler', w / 2, headerY + 162 + titleLines.length * 76 + 44);

    const avg = stats.avgRating || '—';
    const statsY = sectionYs[1];
    const cols = [
        { num: stats.restaurantCount, label: 'Restoran' },
        { num: stats.visitCount, label: 'Ziyaret' },
        { num: avg, label: 'Ort. Puan', suffix: avg !== '—' ? '★' : '' }
    ];
    cols.forEach((col, i) => {
        const x = 180 + i * 360;
        ctx.fillStyle = theme.primary;
        ctx.font = 'bold 88px "DM Sans", system-ui, sans-serif';
        ctx.fillText(`${col.num}${col.suffix || ''}`, x, statsY + 72);
        ctx.fillStyle = theme.muted;
        ctx.font = '500 30px "DM Sans", system-ui, sans-serif';
        ctx.fillText(col.label, x, statsY + 120);
    });

    highlights.forEach((item, index) => {
        const hy = sectionYs[2 + index];
        ctx.textAlign = 'left';
        ctx.fillStyle = theme.light;
        roundRect(ctx, 120, hy, w - 240, 124, 24);
        ctx.fill();
        ctx.strokeStyle = theme.primary;
        ctx.globalAlpha = 0.25;
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.font = '600 30px "DM Sans", system-ui, sans-serif';
        ctx.fillStyle = theme.muted;
        ctx.fillText(item.label, 150, hy + 44);
        ctx.font = 'bold 36px "DM Sans", system-ui, sans-serif';
        ctx.fillStyle = theme.text;
        wrapCanvasText(ctx, item.value, w - 300).slice(0, 2).forEach((line, li) => {
            ctx.fillText(line, 150, hy + 86 + li * 40);
        });
    });

    ctx.textAlign = 'center';
    ctx.fillStyle = theme.muted;
    ctx.font = '500 28px "DM Sans", system-ui, sans-serif';
    const dateStr = new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
    ctx.fillText(`Lezzet günlüğü · ${dateStr}`, w / 2, h - pad - 36);
}

async function drawRestaurantShareCard(r) {
    await document.fonts.ready;
    const canvas = document.getElementById('share-card-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = SHARE_CARD_SIZE.w;
    const h = SHARE_CARD_SIZE.h;
    canvas.width = w;
    canvas.height = h;
    const theme = SHARE_CARD_THEMES[appSettings.theme] || SHARE_CARD_THEMES.rose;
    const labels = getCoupleLabels();
    const avg = avgRating(r.myRating, r.partnerRating);
    const visitDate = r.lastVisited ? formatDate(r.lastVisited) : '';
    const locationHint = formatLocationHint(r.location);
    const cuisineLine = r.cuisine?.trim() || '';
    const cover = getCoverPhoto(r);
    const img = await loadCanvasImage(cover);

    const pad = 60;
    const frameX = pad;
    const frameY = pad;
    const frameW = w - pad * 2;
    const frameH = h - pad * 2;
    const innerX = frameX + 48;
    const innerW = frameW - 96;
    const footerY = frameY + frameH - 72;
    const contentBottom = footerY - 24;

    const catEntries = Object.entries(CATEGORY_LABELS).map(([key, label]) => {
        const cat = r.categories?.[key];
        if (!cat) return null;
        return { label, value: avgRating(cat.my, cat.partner) };
    }).filter(Boolean);
    const hasNotes = Boolean(r.notes?.trim());
    ctx.font = 'italic 26px "Cormorant Garamond", Georgia, serif';
    const noteLines = hasNotes
        ? wrapCanvasText(ctx, `"${r.notes.trim()}"`, innerW - 40).slice(0, 2)
        : [];

    ctx.font = 'bold 58px "Instrument Serif", Georgia, serif';
    const nameLineCount = Math.min(2, wrapCanvasText(ctx, r.name, innerW).length);

    const sectionHeights = [];
    const sectionKinds = [];
    if (!img) {
        sectionHeights.push(108);
        sectionKinds.push('monogram');
    }
    sectionHeights.push(nameLineCount * 64 + 8);
    sectionKinds.push('name');
    if (visitDate) { sectionHeights.push(34); sectionKinds.push('date'); }
    if (cuisineLine) { sectionHeights.push(30); sectionKinds.push('cuisine'); }
    if (locationHint) { sectionHeights.push(30); sectionKinds.push('location'); }
    sectionHeights.push(112);
    sectionKinds.push('score');
    sectionHeights.push(118);
    sectionKinds.push('ratings');
    if (catEntries.length) { sectionHeights.push(72); sectionKinds.push('categories'); }
    if (hasNotes) { sectionHeights.push(Math.max(88, 52 + noteLines.length * 30)); sectionKinds.push('notes'); }
    if ((r.visitCount || 0) > 1) { sectionHeights.push(26); sectionKinds.push('visits'); }

    const contentMin = sectionHeights.reduce((sum, height) => sum + height, 0)
        + Math.max(0, sectionHeights.length - 1) * 28;
    let heroH = 0;
    if (img) {
        heroH = frameH - contentMin - 132;
        heroH = Math.min(Math.round(frameH * 0.48), Math.max(Math.round(frameH * 0.34), heroH));
    }

    paintShareCardFrame(ctx, w, h, theme);

    if (img) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(frameX + 48, frameY);
        ctx.lineTo(frameX + frameW - 48, frameY);
        ctx.quadraticCurveTo(frameX + frameW, frameY, frameX + frameW, frameY + 48);
        ctx.lineTo(frameX + frameW, frameY + heroH);
        ctx.lineTo(frameX, frameY + heroH);
        ctx.lineTo(frameX, frameY + 48);
        ctx.quadraticCurveTo(frameX, frameY, frameX + 48, frameY);
        ctx.closePath();
        ctx.clip();
        drawCanvasCoverImage(ctx, img, frameX, frameY, frameW, heroH);
        const overlay = ctx.createLinearGradient(0, frameY + heroH - 80, 0, frameY + heroH);
        overlay.addColorStop(0, 'rgba(0,0,0,0)');
        overlay.addColorStop(1, 'rgba(0,0,0,0.28)');
        ctx.fillStyle = overlay;
        ctx.fillRect(frameX, frameY + heroH - 80, frameW, 80);
        ctx.restore();

        ctx.fillStyle = theme.light;
        ctx.fillRect(frameX + 3, frameY + heroH, frameW - 6, frameH - heroH - 3);
        ctx.strokeStyle = theme.primary;
        ctx.globalAlpha = 0.12;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(innerX, frameY + heroH + 14);
        ctx.lineTo(innerX + innerW, frameY + heroH + 14);
        ctx.stroke();
        ctx.globalAlpha = 1;
    }

    ctx.strokeStyle = theme.primary;
    ctx.lineWidth = 4;
    roundRect(ctx, frameX, frameY, frameW, frameH, 48);
    ctx.stroke();

    const contentTop = img ? frameY + heroH + 28 : frameY + 56;
    const sectionYs = layoutStorySections(sectionHeights, contentTop, contentBottom, 26, 44);

    sectionKinds.forEach((kind, index) => {
        const y = sectionYs[index];
        ctx.textAlign = 'center';

        if (kind === 'monogram') {
            const cx = w / 2;
            const cy = y + 44;
            ctx.fillStyle = theme.light;
            ctx.beginPath();
            ctx.arc(cx, cy, 44, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = theme.primary;
            ctx.globalAlpha = 0.35;
            ctx.lineWidth = 3;
            ctx.stroke();
            ctx.globalAlpha = 1;
            ctx.fillStyle = theme.primary;
            ctx.font = 'italic 52px "Instrument Serif", Georgia, serif';
            ctx.fillText(nameInitial(r.name), cx, cy + 18);
            return;
        }

        if (kind === 'name') {
            ctx.fillStyle = theme.text;
            ctx.font = 'bold 58px "Instrument Serif", Georgia, serif';
            wrapCanvasText(ctx, r.name, innerW).slice(0, 2).forEach((line, i) => {
                ctx.fillText(line, w / 2, y + 48 + i * 64);
            });
            return;
        }

        ctx.font = '500 26px "DM Sans", system-ui, sans-serif';
        ctx.fillStyle = theme.muted;
        if (kind === 'date') {
            ctx.fillText(visitDate, w / 2, y + 24);
            return;
        }
        if (kind === 'cuisine') {
            wrapCanvasText(ctx, cuisineLine, innerW).slice(0, 1).forEach(line => {
                ctx.fillText(line, w / 2, y + 24);
            });
            return;
        }
        if (kind === 'location') {
            wrapCanvasText(ctx, locationHint, innerW).slice(0, 1).forEach(line => {
                ctx.fillText(line, w / 2, y + 24);
            });
            return;
        }

        if (kind === 'score') {
            ctx.fillStyle = theme.primary;
            ctx.font = 'bold 84px "DM Sans", system-ui, sans-serif';
            ctx.fillText(`${avg} ★`, w / 2, y + 62);
            ctx.font = '500 28px "DM Sans", system-ui, sans-serif';
            ctx.fillStyle = theme.muted;
            ctx.fillText(canvasStarString(avg), w / 2, y + 98);
            return;
        }

        if (kind === 'ratings') {
            [{ label: labels.mine, value: r.myRating }, { label: labels.partner, value: r.partnerRating }].forEach((col, i) => {
                const x = i === 0 ? w / 2 - 200 : w / 2 + 200;
                ctx.fillStyle = theme.light;
                roundRect(ctx, x - 165, y, 330, 118, 22);
                ctx.fill();
                ctx.strokeStyle = theme.primary;
                ctx.globalAlpha = 0.22;
                ctx.stroke();
                ctx.globalAlpha = 1;
                ctx.textAlign = 'center';
                ctx.font = '600 24px "DM Sans", system-ui, sans-serif';
                ctx.fillStyle = theme.muted;
                ctx.fillText(col.label, x, y + 36);
                ctx.font = 'bold 42px "DM Sans", system-ui, sans-serif';
                ctx.fillStyle = theme.text;
                ctx.fillText(`${col.value} ★`, x, y + 82);
            });
            return;
        }

        if (kind === 'categories') {
            ctx.font = '600 22px "DM Sans", system-ui, sans-serif';
            ctx.fillStyle = theme.muted;
            ctx.fillText('Detay puanlar', w / 2, y + 20);
            const catText = catEntries.map(c => `${c.label} ${c.value}`).join('   ·   ');
            ctx.font = '500 24px "DM Sans", system-ui, sans-serif';
            wrapCanvasText(ctx, catText, innerW).slice(0, 2).forEach((line, i) => {
                ctx.fillText(line, w / 2, y + 52 + i * 28);
            });
            return;
        }

        if (kind === 'notes') {
            const noteH = sectionHeights[index];
            ctx.fillStyle = theme.light;
            roundRect(ctx, innerX, y, innerW, noteH, 18);
            ctx.fill();
            ctx.strokeStyle = theme.primary;
            ctx.globalAlpha = 0.2;
            ctx.stroke();
            ctx.globalAlpha = 1;
            ctx.font = 'italic 26px "Cormorant Garamond", Georgia, serif';
            ctx.fillStyle = theme.text;
            noteLines.forEach((line, i) => {
                ctx.fillText(line, w / 2, y + 38 + i * 30);
            });
            return;
        }

        if (kind === 'visits') {
            ctx.font = '500 22px "DM Sans", system-ui, sans-serif';
            ctx.fillStyle = theme.muted;
            ctx.fillText(`${r.visitCount} ziyaret`, w / 2, y + 20);
        }
    });

    ctx.textAlign = 'center';
    ctx.fillStyle = theme.muted;
    ctx.font = '500 24px "DM Sans", system-ui, sans-serif';
    ctx.fillText(`${getCoupleTitle()} · Lezzet günlüğü`, w / 2, footerY);
}

function openShareCardModalShell(title, subtitle) {
    const modal = document.getElementById('share-card-modal');
    modal.classList.remove('hidden');
    modal.innerHTML = `<div class="modal-box share-card-modal-box text-center">
        <div class="flex justify-between mb-4">
            <h2 class="font-display font-semibold theme-text">${escapeHtml(title)}</h2>
            <button onclick="closeModal('share-card-modal')" class="text-2xl opacity-40">×</button>
        </div>
        <p class="text-sm opacity-70 mb-4">${escapeHtml(subtitle)} · 9:16 story</p>
        <div class="share-card-preview">
            <canvas id="share-card-canvas" class="share-card-canvas"></canvas>
        </div>
        <div class="flex gap-2 mt-4">
            <button onclick="downloadShareCard()" class="btn-primary flex-1">İndir</button>
            <button onclick="shareShareCard()" class="btn-secondary flex-1">Paylaş</button>
        </div>
    </div>`;
    modal.onclick = e => { if (e.target === modal) closeModal('share-card-modal'); };
}

async function openShareCardModal() {
    closeFabMenu();
    const res = await fetch(`${API}/stats`);
    const stats = await res.json();
    if (!stats.restaurantCount) {
        showToast('Önce bir restoran ekle!');
        return;
    }
    const date = new Date().toISOString().slice(0, 10);
    shareCardMeta = {
        type: 'summary',
        filename: `lezzet-gunlugu-${date}.png`,
        shareText: 'Birlikte keşfettiğimiz lezzetler'
    };
    openShareCardModalShell('Paylaşılabilir Kart', 'Story veya gönderi olarak paylaş');
    await drawShareCard(stats);
}

async function openRestaurantShareModal(id) {
    const res = await fetch(`${API}/restaurants/${id}`);
    if (!res.ok) {
        showToast('Restoran bulunamadı');
        return;
    }
    const r = await res.json();
    const avg = avgRating(r.myRating, r.partnerRating);
    const date = r.lastVisited || new Date().toISOString().slice(0, 10);
    shareCardMeta = {
        type: 'restaurant',
        filename: `restoran-${shareCardSlug(r.name)}-${date}.png`,
        shareText: `${r.name} · ${avg}★ — ${getCoupleTitle()}`
    };
    openShareCardModalShell('Restoran Kartı', `${r.name} için paylaşım kartı`);
    await drawRestaurantShareCard(r);
}

function downloadShareCard() {
    const canvas = document.getElementById('share-card-canvas');
    if (!canvas) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = shareCardMeta.filename || `lezzet-gunlugu-${new Date().toISOString().slice(0, 10)}.png`;
    a.click();
    showToast('Kart indirildi!');
}

async function shareShareCard() {
    const canvas = document.getElementById('share-card-canvas');
    if (!canvas) return;
    const filename = shareCardMeta.filename || `lezzet-gunlugu-${new Date().toISOString().slice(0, 10)}.png`;
    const shareText = shareCardMeta.shareText || 'Birlikte keşfettiğimiz lezzetler';
    try {
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        const file = new File([blob], filename, { type: 'image/png' });
        if (navigator.share && navigator.canShare?.({ files: [file] })) {
            await navigator.share({ files: [file], title: getCoupleTitle(), text: shareText });
            showToast('Paylaşıldı!');
        } else {
            downloadShareCard();
        }
    } catch (e) {
        if (e.name !== 'AbortError') downloadShareCard();
    }
}

// --- HELPERS ---
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
}

function avgRating(my, partner) {
    return ((my + partner) / 2).toFixed(1);
}

function formatDate(d) {
    if (!d) return '—';
    return new Date(d + 'T00:00:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatWishlistAddedAt(addedAt) {
    if (!addedAt) return { formatted: '—', rel: '', days: 0 };
    const date = new Date(addedAt);
    const formatted = date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
    const days = Math.floor((Date.now() - date.getTime()) / 86400000);
    let rel;
    if (days <= 0) rel = 'Bugün eklendi';
    else if (days === 1) rel = 'Dün eklendi';
    else if (days < 7) rel = `${days} gün önce eklendi`;
    else if (days < 30) rel = `${Math.floor(days / 7)} hafta önce eklendi`;
    else if (days < 365) rel = `${Math.floor(days / 30)} ay önce eklendi`;
    else rel = `${Math.floor(days / 365)} yıl önce eklendi`;
    return { formatted, rel, days };
}

function renderStars(rating, variant = 'default') {
    const empty = variant === 'on-dark' ? 'star-off-on-dark' : 'star-off';
    return Array.from({ length: 5 }, (_, i) =>
        `<span class="${i < rating ? 'star-on' : empty}" aria-hidden="true">★</span>`
    ).join('');
}

function nameInitial(name) {
    if (!name?.trim()) return '?';
    return name.trim()[0].toUpperCase();
}

function getCoupleLabels() {
    return {
        mine: appSettings.coupleName1 || 'Sen',
        partner: appSettings.coupleName2 || 'Sevgilin'
    };
}

function getRatingLabels() {
    const { mine, partner } = getCoupleLabels();
    return {
        mine: `${mine} Puanı`,
        partner: `${partner} Puanı`
    };
}

function updateRatingLabels() {
    const labels = getRatingLabels();
    const myLabel = document.getElementById('add-my-rating-label');
    const partnerLabel = document.getElementById('add-partner-rating-label');
    if (myLabel) myLabel.textContent = labels.mine;
    if (partnerLabel) partnerLabel.textContent = labels.partner;
}

function getAgreementBadge(my, partner) {
    const diff = Math.abs(my - partner);
    if (diff === 0) return '<span class="agreement-badge agreement-match">Tam uyum</span>';
    if (diff >= 2) return '<span class="agreement-badge agreement-debate">Tartışmalı</span>';
    return '';
}

function getTopDishes(r, limit = 4) {
    const dishMap = {};
    (r.visits || []).forEach(v => {
        (v.dishes || []).forEach(d => {
            if (!d.name) return;
            if (!dishMap[d.name]) dishMap[d.name] = { count: 0, totalRating: 0 };
            dishMap[d.name].count++;
            dishMap[d.name].totalRating += Number(d.rating) || 0;
        });
    });
    return Object.entries(dishMap)
        .map(([name, info]) => ({ name, avg: info.totalRating / info.count, count: info.count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);
}

function renderDetailCategories(categories) {
    if (!categories || !hasDistinctCategories(categories)) return '';
    const rows = Object.entries(CATEGORY_LABELS).map(([key, label]) => {
        const cat = categories[key];
        if (!cat) return '';
        const avg = (Number(cat.my) + Number(cat.partner)) / 2;
        const pct = Math.max(8, (avg / 5) * 100);
        return `<div class="detail-category-row">
            <div class="detail-category-head"><span>${label}</span><span class="detail-category-score">${avg.toFixed(1)}</span></div>
            <div class="detail-category-bar"><div class="detail-category-fill" style="width:${pct}%"></div></div>
        </div>`;
    }).join('');
    if (!rows.trim()) return '';
    return `<section class="detail-section"><h3 class="detail-section-title">Detaylı puanlar</h3><div class="detail-categories">${rows}</div></section>`;
}

function hasDistinctCategories(categories) {
    const avgs = Object.keys(CATEGORY_LABELS).map(key => {
        const cat = categories[key];
        if (!cat) return null;
        return (Number(cat.my) + Number(cat.partner)) / 2;
    }).filter(v => v != null);
    return new Set(avgs.map(v => v.toFixed(1))).size > 1;
}

function renderDetailDishes(r) {
    const dishes = getTopDishes(r);
    if (!dishes.length) return '';
    return `<section class="detail-section"><h3 class="detail-section-title">Favori lezzetler</h3>
        <div class="detail-dish-list">${dishes.map(d =>
            `<div class="detail-dish-item"><span class="detail-dish-name">${escapeHtml(d.name)}</span>
            <span class="detail-dish-meta">${d.avg.toFixed(1)}★ · ${d.count}×</span></div>`
        ).join('')}</div></section>`;
}

function renderDetailVisits(visits, restaurantId) {
    if (!visits?.length) return '';
    const sorted = [...visits].sort((a, b) => b.date.localeCompare(a.date));
    return `<section class="detail-section"><div class="detail-section-head">
        <h3 class="detail-section-title">Son anılar</h3>
        ${sorted.length > 2 ? `<button type="button" onclick="closeModal('detail-modal');openHistoryModal('${restaurantId}')" class="detail-link-btn">Tümü (${sorted.length})</button>` : ''}
    </div>
    <div class="detail-visit-list">${sorted.slice(0, 3).map(v => {
        const isSpecial = (v.tags || []).some(t => SPECIAL_TAGS.has(t));
        const parts = formatDateParts(v.date);
        return `<article class="detail-visit-card ${isSpecial ? 'special' : ''}">
            <div class="detail-visit-date"><span class="day">${parts.day}</span><span class="month">${parts.month}</span></div>
            <div class="detail-visit-body">
                ${isSpecial ? '<span class="detail-visit-badge">Özel gün</span>' : ''}
                ${v.notes ? `<p class="detail-visit-note">"${escapeHtml(v.notes)}"</p>` : ''}
                ${v.dishes?.length ? `<p class="detail-visit-dishes">${v.dishes.map(d => `${escapeHtml(d.name)} ${d.rating}★`).join(' · ')}</p>` : ''}
                ${renderTags(v.tags, false)}
                ${v.photos?.length ? renderPhotoStrip(v.photos, `detail-visit-${restaurantId}-${v.id}`) : ''}
            </div>
        </article>`;
    }).join('')}</div></section>`;
}

function renderDetailPhotos(photos, cover, galleryKey) {
    if (!photos.length) return '';
    photoGalleries[`${galleryKey}-all`] = photos;
    if (photos.length === 1 && cover) return '';
    const gallery = cover ? photos.slice(1) : photos;
    if (!gallery.length) return '';
    photoGalleries[galleryKey] = gallery;
    const bentoClass = gallery.length === 1 ? 'photo-bento-1'
        : gallery.length === 2 ? 'photo-bento-2'
        : gallery.length === 3 ? 'photo-bento-3' : 'photo-bento-4';
    const frames = gallery.slice(0, 4).map((p, i) => {
        const hasMore = i === 3 && gallery.length > 4;
        return `<button type="button" class="photo-frame" onclick="openLightboxGallery('${galleryKey}',${i})">
            <img src="${p}" alt="" loading="lazy">
            ${hasMore ? `<span class="photo-more">+${gallery.length - 4}</span>` : ''}
        </button>`;
    }).join('');
    return `<section class="detail-section detail-photo-section">
        <h3 class="detail-section-title">Fotoğraflar <span class="detail-photo-count">${photos.length}</span></h3>
        <div class="photo-bento detail-photo-bento ${bentoClass}">${frames}</div>
    </section>`;
}

function buildDetailModalHtml(r) {
    const avg = avgRating(r.myRating, r.partnerRating);
    const photos = getAllPhotos(r, 12);
    const cover = getCoverPhoto(r);
    const galleryKey = `detail-${r.id}`;
    const agreement = getAgreementBadge(r.myRating, r.partnerRating);
    const labels = getCoupleLabels();
    const initial = nameInitial(r.name);
    const perfect = Math.round(parseFloat(avg)) >= 5;
    const totalBudget = (r.visits || []).reduce((sum, v) => sum + (Number(v.budget) || 0), 0);
    const mapLink = r.lat && r.lng
        ? `https://www.google.com/maps?q=${r.lat},${r.lng}`
        : null;

    const hero = cover
        ? `<img src="${cover}" class="detail-hero-img" alt="" onclick="openLightboxGallery('${galleryKey}-all',0)">`
        : `<div class="detail-hero-placeholder"><span class="detail-monogram">${initial}</span></div>`;

    return `<div class="modal-box detail-modal-box${perfect ? ' detail-perfect' : ''}">
        <div class="detail-hero">
            ${hero}
            <div class="detail-hero-gradient"></div>
            <div class="detail-hero-top">
                <button type="button" onclick="closeModal('detail-modal')" class="detail-icon-btn" aria-label="Kapat">×</button>
                <button type="button" onclick="event.stopPropagation();toggleFavoriteFromDetail('${r.id}', this)" class="detail-icon-btn detail-fav-btn ${r.favorite ? 'active' : ''}" aria-label="Favori">♥</button>
            </div>
            <div class="detail-hero-bottom">
                <div class="detail-hero-score">
                    <span class="detail-hero-score-num">${avg}</span>
                    <span class="detail-hero-score-stars">${renderStars(Math.round(avg), 'on-dark')}</span>
                </div>
                ${photos.length > 1 ? `<span class="detail-hero-photo-count">${photos.length} foto</span>` : ''}
            </div>
        </div>
        <div class="detail-body">
            <div class="detail-title-block">
                <h2 class="detail-title">${escapeHtml(r.name)}</h2>
                <div class="detail-meta">
                    ${r.cuisine ? `<span class="detail-chip">${escapeHtml(r.cuisine)}</span>` : ''}
                    ${r.location ? `<span class="detail-chip">${escapeHtml(r.location)}</span>` : ''}
                    ${mapLink ? `<a href="${mapLink}" target="_blank" rel="noopener" class="detail-chip detail-chip-link">Haritada aç</a>` : ''}
                </div>
                <div class="detail-stats">
                    <span class="detail-stat"><strong>${r.visitCount || 0}</strong> ziyaret</span>
                    <span class="detail-stat-dot">·</span>
                    <span class="detail-stat">Son: ${formatDate(r.lastVisited)}</span>
                    ${totalBudget > 0 ? `<span class="detail-stat-dot">·</span><span class="detail-stat">${totalBudget.toLocaleString('tr-TR')} ₺</span>` : ''}
                </div>
                ${agreement ? `<div class="detail-agreement">${agreement}</div>` : ''}
            </div>
            <div class="detail-rating-grid">
                <div class="detail-rating-card">
                    <span class="detail-rating-label">${escapeHtml(labels.mine)}</span>
                    <span class="detail-rating-value">${r.myRating}</span>
                    <span class="detail-rating-stars">${renderStars(r.myRating)}</span>
                </div>
                <div class="detail-rating-card detail-rating-card-partner">
                    <span class="detail-rating-label">${escapeHtml(labels.partner)}</span>
                    <span class="detail-rating-value">${r.partnerRating}</span>
                    <span class="detail-rating-stars">${renderStars(r.partnerRating)}</span>
                </div>
            </div>
            ${r.notes ? `<blockquote class="detail-note">"${escapeHtml(r.notes)}"</blockquote>` : ''}
            ${renderDetailCategories(r.categories)}
            ${renderDetailDishes(r)}
            ${renderDetailPhotos(photos, cover, galleryKey)}
            ${renderDetailVisits(r.visits, r.id)}
        </div>
        <div class="detail-actions">
            <button type="button" onclick="closeModal('detail-modal');openVisitModal('${r.id}')" class="detail-action-btn primary">Ziyaret</button>
            <button type="button" onclick="openRestaurantShareModal('${r.id}')" class="detail-action-btn">Kart</button>
            <button type="button" onclick="closeModal('detail-modal');openHistoryModal('${r.id}')" class="detail-action-btn">Geçmiş</button>
            <button type="button" onclick="closeModal('detail-modal');openEditModal('${r.id}')" class="detail-action-btn">Düzenle</button>
            <button type="button" onclick="closeModal('detail-modal');deleteRestaurant('${r.id}')" class="detail-action-btn danger">Sil</button>
        </div>
    </div>`;
}

async function toggleFavoriteFromDetail(id, btn) {
    await fetch(`${API}/restaurants/${id}/favorite`, { method: 'POST' });
    btn.classList.toggle('active');
    btn.classList.add('pop');
    setTimeout(() => btn.classList.remove('pop'), 500);
    loadRestaurants();
    loadStats();
}

function getCoverPhoto(r) {
    if (r.coverPhoto) return r.coverPhoto;
    const photos = (r.visits || []).flatMap(v => v.photos || []);
    if (photos.length) return photos[0];
    if (r.photos?.length) return r.photos[0];
    return null;
}

function getPhotoCount(r) {
    if (r.photoCount != null) return r.photoCount;
    return getAllPhotos(r).length;
}

function getAllPhotos(r, limit = 6) {
    const photos = (r.visits || []).flatMap(v => v.photos || []);
    if (!photos.length && r.photos?.length) return r.photos.slice(0, limit);
    return photos.slice(0, limit);
}

function buildStarPicker(containerId, hiddenId, initial = 3) {
    const container = document.getElementById(containerId);
    const hidden = document.getElementById(hiddenId);
    if (!container || !hidden) return;
    hidden.value = initial;
    container.innerHTML = Array.from({ length: 5 }, (_, i) => {
        const v = i + 1;
        return `<span class="star-btn ${v <= initial ? 'star-on' : 'star-off'}" onclick="setStar('${containerId}','${hiddenId}',${v})">★</span>`;
    }).join('');
}

function setStar(containerId, hiddenId, val) {
    document.getElementById(hiddenId).value = val;
    const container = document.getElementById(containerId);
    container.querySelectorAll('.star-btn').forEach((s, i) => {
        s.className = `star-btn ${i < val ? 'star-on' : 'star-off'}`;
    });
    if (val === 5) {
        container.classList.add('stars-max');
        setTimeout(() => container.classList.remove('stars-max'), 500);
    }
}

function showToast(msg, opts = {}) {
    const toast = document.getElementById('toast');
    const msgEl = document.getElementById('toast-msg');
    toast.classList.toggle('toast-fun', !!opts.fun);
    if (msgEl) msgEl.textContent = msg;
    else toast.textContent = msg;
    toast.classList.add('show');
    if (opts.confetti) burstConfetti({ count: opts.confettiCount || 28 });
    setTimeout(() => {
        toast.classList.remove('show');
        toast.classList.remove('toast-fun');
    }, 2800);
}

function formatDateParts(d) {
    if (!d) return { day: '—', month: '' };
    const date = new Date(d + 'T00:00:00');
    return {
        day: date.getDate(),
        month: date.toLocaleDateString('tr-TR', { month: 'short' }).replace('.', '')
    };
}

function readFilesAsBase64(files) {
    return Promise.all([...files].map(f => new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result);
        r.onerror = rej;
        r.readAsDataURL(f);
    })));
}

const PHOTO_MAX_WIDTH = 1024;
const PHOTO_QUALITY = 0.82;
const COVER_MAX_WIDTH = 640;
const COVER_QUALITY = 0.78;

function compressImageFile(file, maxWidth = PHOTO_MAX_WIDTH, quality = PHOTO_QUALITY) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            URL.revokeObjectURL(url);
            let { width, height } = img;
            if (width > maxWidth) {
                height = Math.round(height * maxWidth / width);
                width = maxWidth;
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            canvas.getContext('2d').drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Fotoğraf okunamadı'));
        };
        img.src = url;
    });
}

function compressDataUrl(dataUrl, maxWidth = COVER_MAX_WIDTH, quality = COVER_QUALITY) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            let { width, height } = img;
            if (width > maxWidth) {
                height = Math.round(height * maxWidth / width);
                width = maxWidth;
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            canvas.getContext('2d').drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = () => reject(new Error('Fotoğraf okunamadı'));
        img.src = dataUrl;
    });
}

async function readFilesCompressed(files) {
    return Promise.all([...files].map(f => compressImageFile(f)));
}

async function refreshAddCoverPhoto() {
    addCoverPhoto = addPhotoData.length ? await compressDataUrl(addPhotoData[0]) : null;
}

async function refreshVisitCoverPhoto() {
    visitCoverPhoto = visitPhotoData.length ? await compressDataUrl(visitPhotoData[0]) : null;
}

function renderPhotoPreviews(containerId, photos, removable, removeFn) {
    const el = document.getElementById(containerId);
    if (!el) return;
    photoGalleries[containerId] = photos;
    el.className = 'photo-upload-grid';
    el.innerHTML = photos.map((src, i) => `
        <div class="photo-upload-item">
            <img src="${src}" onclick="openLightboxGallery('${containerId}',${i})">
            ${removable ? `<button type="button" onclick="${removeFn}(${i})" class="photo-upload-remove">×</button>` : ''}
        </div>`).join('');
}

function renderPhotoSection(photos, skipCover, galleryKey) {
    const gallery = skipCover ? photos.slice(1) : photos;
    if (!gallery.length) return '';
    photoGalleries[galleryKey] = gallery;
    const bentoClass = gallery.length === 1 ? 'photo-bento-1'
        : gallery.length === 2 ? 'photo-bento-2'
        : gallery.length === 3 ? 'photo-bento-3' : 'photo-bento-4';
    const frames = gallery.slice(0, 4).map((p, i) => {
        const hasMore = i === 3 && gallery.length > 4;
        return `<button type="button" class="photo-frame" onclick="openLightboxGallery('${galleryKey}',${i})">
            <img src="${p}" alt="" loading="lazy">
            ${hasMore ? `<span class="photo-more">+${gallery.length - 4}</span>` : ''}
        </button>`;
    }).join('');
    return `<div class="photo-section">
        <div class="photo-section-label">Fotoğraflar <span class="photo-count">${photos.length}</span></div>
        <div class="photo-bento ${bentoClass}">${frames}</div>
    </div>`;
}

function renderPhotoStrip(photos, galleryKey) {
    if (!photos?.length) return '';
    photoGalleries[galleryKey] = photos;
    return `<div class="photo-strip mt-2">${photos.slice(0, 5).map((p, i) =>
        `<div class="photo-strip-item" onclick="openLightboxGallery('${galleryKey}',${i})"><img src="${p}" alt="" loading="lazy"></div>`
    ).join('')}</div>`;
}

function openLightboxGallery(key, index) {
    lightboxPhotos = photoGalleries[key] || [];
    lightboxIndex = index;
    showLightbox();
}

function openLightbox(src) {
    lightboxPhotos = [src];
    lightboxIndex = 0;
    showLightbox();
}

function showLightbox() {
    if (!lightboxPhotos.length) return;
    updateLightbox();
    document.getElementById('photo-lightbox').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function updateLightbox() {
    document.getElementById('lightbox-img').src = lightboxPhotos[lightboxIndex];
    const counter = document.getElementById('lightbox-counter');
    const prev = document.getElementById('lightbox-prev');
    const next = document.getElementById('lightbox-next');
    const multi = lightboxPhotos.length > 1;
    counter.textContent = multi ? `${lightboxIndex + 1} / ${lightboxPhotos.length}` : '';
    prev.classList.toggle('hidden', !multi);
    next.classList.toggle('hidden', !multi);
}

function lightboxNav(dir, e) {
    e.stopPropagation();
    lightboxIndex = (lightboxIndex + dir + lightboxPhotos.length) % lightboxPhotos.length;
    updateLightbox();
}

function closeLightbox(e) {
    if (e && e.target !== e.currentTarget && !e.target?.classList?.contains('lightbox-close')) return;
    document.getElementById('photo-lightbox').classList.add('hidden');
    document.body.style.overflow = '';
}

document.addEventListener('keydown', e => {
    const lb = document.getElementById('photo-lightbox');
    if (lb.classList.contains('hidden')) return;
    if (e.key === 'Escape') closeLightbox({ target: lb, currentTarget: lb });
    if (e.key === 'ArrowLeft') lightboxNav(-1, { stopPropagation() {} });
    if (e.key === 'ArrowRight') lightboxNav(1, { stopPropagation() {} });
});

function renderEmptyState(title, desc, actionHtml = '', icon = '') {
    return `<div class="empty-state">
        ${icon ? `<span class="empty-state-icon" aria-hidden="true">${icon}</span>` : ''}
        <h3>${title}</h3>
        <p>${desc}</p>
        ${actionHtml ? `<div class="mt-4">${actionHtml}</div>` : ''}
    </div>`;
}

// --- KATEGORİ (otomatik — ana puandan türetilir) ---
function categoriesFromRatings(my, partner) {
    const m = Number(my) || 3;
    const p = Number(partner) || 3;
    return {
        food: { my: m, partner: p },
        service: { my: m, partner: p },
        atmosphere: { my: m, partner: p },
        price: { my: m, partner: p }
    };
}

// --- YEMEK & ETİKET ---
function addDishRow(prefix, name = '', rating = 5) {
    const container = document.getElementById(`${prefix}-dishes`);
    const row = document.createElement('div');
    row.className = 'dish-row';
    row.innerHTML = `
        <input type="text" class="input dish-name" placeholder="Yemek adı" value="${escapeHtml(name)}">
        <select class="input dish-rating">${[1,2,3,4,5].map(n=>`<option value="${n}" ${n===rating?'selected':''}>${n}★</option>`).join('')}</select>
        <button type="button" onclick="this.parentElement.remove()" class="dish-remove" aria-label="Kaldır">×</button>`;
    container.appendChild(row);
}

function getDishesFromForm(prefix) {
    const rows = document.querySelectorAll(`#${prefix}-dishes .dish-row`);
    return [...rows].map(r => ({
        name: r.querySelector('.dish-name').value.trim(),
        rating: Number(r.querySelector('.dish-rating').value)
    })).filter(d => d.name);
}

function buildTagSelector(prefix, selected = []) {
    const container = document.getElementById(`${prefix}-tags`);
    if (!container) return;
    if (prefix === 'add') selectedAddTags = [...selected];
    else selectedVisitTags = [...selected];
    container.innerHTML = TAG_PRESETS.map(tag => {
        const sel = selected.includes(tag);
        return `<button type="button" onclick="toggleTag('${prefix}','${tag}')" class="tag-chip ${sel?'selected':''}" data-tag="${tag}">${tag}</button>`;
    }).join('');
}

function toggleTag(prefix, tag) {
    const arr = prefix === 'add' ? selectedAddTags : selectedVisitTags;
    const idx = arr.indexOf(tag);
    if (idx === -1) arr.push(tag); else arr.splice(idx, 1);
    buildTagSelector(prefix, arr);
}

function renderTags(tags, special = true) {
    if (!tags?.length) return '';
    return `<div class="flex flex-wrap gap-1 mt-1">${tags.map(t =>
        `<span class="tag-chip ${special && SPECIAL_TAGS.has(t) ? 'special' : ''}">${escapeHtml(t)}</span>`
    ).join('')}</div>`;
}

// --- GEOCODE ---
function parseCoordsClient(text) {
    const trimmed = text.trim();
    const coordNum = '-?\\d+(?:\\.\\d+)?';
    const valid = (lat, lng) => lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;

    const direct = trimmed.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
    if (direct) {
        const lat = parseFloat(direct[1]);
        const lng = parseFloat(direct[2]);
        if (valid(lat, lng)) return { lat, lng };
    }

    if (!/(?:google\.com\/maps|maps\.google\.|goo\.gl\/maps|maps\.app\.goo\.gl|share\.google)/i.test(trimmed)) {
        return null;
    }

    let decoded = trimmed;
    try {
        decoded = decodeURIComponent(trimmed.replace(/\+/g, ' '));
    } catch { /* keep original */ }

    const lat3 = decoded.match(new RegExp(`[!%]3d(${coordNum})`, 'i'));
    const lng4 = decoded.match(new RegExp(`[!%]4d(${coordNum})`, 'i'));
    if (lat3 && lng4) {
        const lat = parseFloat(lat3[1]);
        const lng = parseFloat(lng4[1]);
        if (valid(lat, lng)) return { lat, lng };
    }

    const patterns = [
        new RegExp(`@(${coordNum}),(${coordNum})`),
        /[?&]q=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
        /[?&]ll=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
        new RegExp(`/dir/(?:[^/]*/)*(${coordNum}),(${coordNum})`)
    ];
    for (const pattern of patterns) {
        const match = decoded.match(pattern);
        if (!match) continue;
        const lat = parseFloat(match[1]);
        const lng = parseFloat(match[2]);
        if (valid(lat, lng)) return { lat, lng };
    }

    return null;
}

async function geocodeLocation(prefix) {
    const input = document.getElementById(`${prefix}-location`);
    const location = input?.value?.trim();
    if (!location) {
        showLocationStatus(prefix, 'Konum yazın veya Google Maps linki yapıştırın', 'error');
        return false;
    }
    const local = parseCoordsClient(location);
    if (local) {
        input.dataset.lat = local.lat;
        input.dataset.lng = local.lng;
        showLocationStatus(prefix, 'Google Maps linkinden alındı', 'success');
        return true;
    }
    showLocationStatus(prefix, 'Aranıyor...', 'loading');
    try {
        const name = document.getElementById(`${prefix}-name`)?.value?.trim() || '';
        const params = new URLSearchParams({ q: location });
        if (name) params.set('name', name);
        const res = await fetch(`${API}/geocode?${params}`);
        let data = {};
        try { data = await res.json(); } catch { /* */ }
        if (res.ok && data.lat != null) {
            input.dataset.lat = data.lat;
            input.dataset.lng = data.lng;
            showLocationStatus(prefix, 'Bulundu — haritada görünecek', 'success');
            return true;
        }
        delete input.dataset.lat;
        delete input.dataset.lng;
        showLocationStatus(prefix, data.error || 'Konum bulunamadı', 'error');
        return false;
    } catch {
        showLocationStatus(prefix, 'Sunucuya bağlanılamadı', 'error');
        return false;
    }
}

function showLocationStatus(prefix, msg, type) {
    const el = document.getElementById(`${prefix}-location-status`);
    if (!el) return;
    el.textContent = msg;
    el.className = 'field-hint';
    if (type === 'success') el.classList.add('success');
    else if (type === 'error') el.classList.add('error');
    else el.classList.add('loading');
}

function setLocationCoords(prefix, lat, lng) {
    const input = document.getElementById(`${prefix}-location`);
    if (!input || !lat || !lng) return;
    input.dataset.lat = lat;
    input.dataset.lng = lng;
    showLocationStatus(prefix, 'Haritada kayıtlı', 'success');
}

// --- İSİM ÖNERİLERİ ---
function buildNameSuggestions(query) {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const map = new Map();
    const add = (name, location = '', cuisine = '') => {
        const trimmed = (name || '').trim();
        if (!trimmed) return;
        const key = trimmed.toLowerCase();
        if (!key.includes(q) && !(location || '').toLowerCase().includes(q)) return;
        map.set(key, { name: trimmed, cuisine: cuisine || '', location: location || '' });
    };
    allWishlist.forEach(w => add(w.name, w.location, w.cuisine));
    allRestaurants.forEach(r => add(r.name, r.location, r.cuisine));
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'tr'));
}

function formatLocationHint(location) {
    if (!location?.trim()) return '';
    const text = location.trim();
    if (/google\.|maps\.|goo\.gl|share\.google/i.test(text)) return 'Konum kayıtlı';
    return text.length > 36 ? `${text.slice(0, 34)}…` : text;
}

function fillNameFields(target, entry) {
    const p = target === 'edit' ? 'edit' : (target === 'wishlist' ? 'wishlist' : 'add');
    const nameEl = document.getElementById(`${p}-name`);
    if (nameEl) nameEl.value = entry.name;
    const locEl = document.getElementById(`${p}-location`);
    if (locEl && entry.location) locEl.value = entry.location;
    document.getElementById('add-name-suggest')?.classList.add('hidden');
}

async function showSuggest(inputId, suggestId) {
    const input = document.getElementById(inputId);
    const dropdown = document.getElementById(suggestId);
    if (!input || !dropdown) return;

    const query = input.value.trim();
    if (query.length < 2) {
        dropdown.classList.add('hidden');
        return;
    }

    cachedNames = buildNameSuggestions(query);
    const target = inputId.includes('edit') ? 'edit' : 'add';
    const exactMatch = cachedNames.some(n => n.name.toLowerCase() === query.toLowerCase());

    if (!cachedNames.length) {
        dropdown.innerHTML = `<p class="suggest-empty">"${escapeHtml(query)}" yeni bir kayıt olabilir — yazmaya devam edin.</p>`;
        dropdown.classList.remove('hidden');
        return;
    }

    dropdown.innerHTML = `
        <p class="suggest-hint">Öneri — seçmek zorunda değilsiniz</p>
        ${cachedNames.slice(0, 6).map((n, i) => `
            <button type="button" class="suggest-item" onclick="pickSuggest('${target}', ${i}, '${suggestId}')">
                <span class="suggest-item-name">${escapeHtml(n.name)}</span>
                ${n.location ? `<span class="suggest-item-meta">${escapeHtml(formatLocationHint(n.location))}</span>` : ''}
            </button>`).join('')}
        ${exactMatch ? '' : `<p class="suggest-footer">Enter ile "<span>${escapeHtml(query)}</span>" olarak kaydedebilirsiniz</p>`}`;

    dropdown.classList.remove('hidden');
}

function pickSuggest(target, index, suggestId) {
    fillNameFields(target, cachedNames[index]);
    document.getElementById(suggestId)?.classList.add('hidden');
}

function setupNameAutocomplete(inputId, suggestId) {
    const input = document.getElementById(inputId);
    const dropdown = document.getElementById(suggestId);
    if (!input || !dropdown) return;

    input.addEventListener('input', () => showSuggest(inputId, suggestId));
    input.addEventListener('focus', () => {
        if (input.value.trim().length >= 2) showSuggest(inputId, suggestId);
    });
    input.addEventListener('blur', () => {
        setTimeout(() => dropdown.classList.add('hidden'), 160);
    });
    input.addEventListener('keydown', e => {
        if (e.key === 'Escape') dropdown.classList.add('hidden');
    });
}

async function openNamePicker(target) {
    namePickerTarget = target;
    await loadWishlist();
    const modal = document.getElementById('name-picker-modal');
    modal.classList.remove('hidden');
    modal.innerHTML = `<div class="modal-box name-picker-box">
        <div class="flex justify-between mb-3">
            <div>
                <h2 class="font-display font-semibold theme-text">İstek listesi</h2>
                <p class="name-picker-hint">Gitmek istediğiniz mekanlar — silinen veya gittiğiniz kayıtlar burada görünmez</p>
            </div>
            <button type="button" onclick="closeModal('name-picker-modal')" class="modal-close" aria-label="Kapat">×</button>
        </div>
        <input type="text" id="name-picker-search" class="input" placeholder="Ara..." oninput="searchNamePicker(this.value)">
        <div id="name-picker-list" class="name-picker-list"></div>
    </div>`;
    renderNamePickerList('');
    modal.onclick = e => { if (e.target === modal) closeModal('name-picker-modal'); };
}

function searchNamePicker(q) { renderNamePickerList(q); }

function renderNamePickerList(search) {
    const list = document.getElementById('name-picker-list');
    if (!list) return;
    const q = search.trim().toLowerCase();
    const filtered = allWishlist.filter(w =>
        !q || w.name.toLowerCase().includes(q) || (w.location || '').toLowerCase().includes(q)
    );

    list.innerHTML = filtered.length ? filtered.map(w => `
        <div class="name-picker-row">
            <button type="button" class="name-picker-item" onclick="pickWishlistEntry('${w.id}')">
                <span class="name-picker-item-name">${escapeHtml(w.name)}</span>
                ${w.location ? `<span class="name-picker-item-meta">${escapeHtml(formatLocationHint(w.location))}</span>` : ''}
            </button>
            <button type="button" class="name-picker-remove" onclick="deleteWishlistFromPicker('${w.id}')" title="Listeden kaldır" aria-label="Kaldır">×</button>
        </div>`).join('') : '<p class="name-picker-empty">İstek listesi boş — önce İstek sekmesinden mekan ekleyin</p>';
}

function deleteWishlistFromPicker(id) {
    deleteWishlistItem(id, { refreshPicker: true });
}

function pickWishlistEntry(id) {
    const w = allWishlist.find(item => item.id === id);
    if (!w) return;
    fillNameFields(namePickerTarget, { name: w.name, location: w.location || '', cuisine: w.cuisine || '' });
    closeModal('name-picker-modal');
}

function closeModal(id) {
    document.getElementById(id).classList.add('hidden');
    if (id === 'detail-modal') {
        mascotContextRestaurant = null;
        updateMascotMood();
    }
}

// --- DASHBOARD ---
async function loadStats() {
    const res = await fetch(`${API}/stats`);
    const s = await res.json();
    renderDashboard(s);
}

function renderDashboard(s) {
    const el = document.getElementById('dashboard');
    if (!el) return;
    if (!s.restaurantCount) {
        el.innerHTML = '';
        return;
    }
    const highlights = [];
    if (s.avgRating) highlights.push({ label: 'Ortalama', value: `${s.avgRating}★` });
    if (s.topRestaurant) highlights.push({ label: 'En çok gidilen', value: `${escapeHtml(s.topRestaurant.name)} · ${s.topRestaurant.visits}×` });
    if (s.topRated) highlights.push({ label: 'En yüksek puan', value: `${escapeHtml(s.topRated.name)} · ${s.topRated.rating}★` });
    if (s.monthVisits != null) highlights.push({ label: 'Bu ay', value: `${s.monthVisits} ziyaret` });
    if (s.topCuisine) highlights.push({ label: 'Favori mutfak', value: `${escapeHtml(s.topCuisine.name)} · ${s.topCuisine.count}×` });

    el.innerHTML = `
        <div class="dash-summary">
            <div class="dash-stat"><span class="dash-stat-value">${s.restaurantCount}</span><span class="dash-stat-label">Restoran</span></div>
            <div class="dash-stat"><span class="dash-stat-value">${s.visitCount}</span><span class="dash-stat-label">Ziyaret</span></div>
            <div class="dash-stat"><span class="dash-stat-value">${s.favoriteCount}</span><span class="dash-stat-label">Favori <span class="heart-tiny" aria-hidden="true">♥</span></span></div>
            <div class="dash-stat"><span class="dash-stat-value">${s.wishlistCount || 0}</span><span class="dash-stat-label">İstek</span></div>
        </div>
        ${highlights.length ? `<div class="dash-highlights">${highlights.map(h => `
            <div class="dash-highlight">
                <span class="dash-highlight-label">${h.label}</span>
                <span class="dash-highlight-value">${h.value}</span>
            </div>`).join('')}</div>` : ''}`;
}

// --- GÖRÜNÜM ---
function setView(view) {
    currentView = view;
    ['list', 'map', 'timeline', 'wishlist'].forEach(v => {
        document.getElementById(`view-${v}`)?.classList.toggle('active', view === v);
    });
    document.getElementById('map-container').classList.toggle('hidden', view !== 'map');
    document.getElementById('list-section').classList.toggle('hidden', view !== 'list');
    document.getElementById('timeline-section').classList.toggle('hidden', view !== 'timeline');
    document.getElementById('wishlist-section').classList.toggle('hidden', view !== 'wishlist');
    document.getElementById('add-section').classList.toggle('hidden', view === 'timeline' || view === 'wishlist');

    if (view === 'map') renderMap();
    else if (view === 'timeline') loadTimeline();
    else if (view === 'wishlist') loadWishlist();
    updateMascotMood();
}

function createCustomIcon(type) {
    const cls = type === 'wishlist' ? 'custom-marker-wishlist' : 'custom-marker-visited';
    return L.divIcon({
        className: '',
        html: `<div class="${cls}"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
        popupAnchor: [0, -10]
    });
}

function buildMapPopup(r, isWishlist = false) {
    const cover = getCoverPhoto(r);
    const avg = !isWishlist ? avgRating(r.myRating, r.partnerRating) : null;
    return `<div>
        ${cover ? `<img src="${cover}" class="map-popup-img">` : ''}
        <b>${escapeHtml(r.name)}</b><br>
        <span style="color:#6b7280;font-size:12px">${escapeHtml(r.location || '')}</span>
        ${avg ? `<br><span style="color:#f43f5e;font-weight:600">${avg}★</span> · ${r.visitCount} ziyaret` : ''}
        ${isWishlist ? '<br><span style="color:#8b5cf6;font-size:12px">İstek listesinde</span>' : ''}
    </div>`;
}

function renderMap() {
    const container = document.getElementById('map-container');
    if (!mapInstance) {
        mapInstance = L.map(container).setView([41.0082, 28.9784], 11);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(mapInstance);
        markerCluster = L.markerClusterGroup({ maxClusterRadius: 40 });
        mapInstance.addLayer(markerCluster);
    }
    markerCluster.clearLayers();

    const withCoords = allRestaurants.filter(r => r.lat && r.lng);
    const wishWithCoords = allWishlist.filter(w => w.lat && w.lng);

    if (!withCoords.length && !wishWithCoords.length) {
        if (!document.getElementById('map-hint')) {
            const hint = document.createElement('div');
            hint.id = 'map-hint';
            hint.className = 'absolute inset-0 flex items-center justify-center bg-white/80 z-[1000] pointer-events-none p-6 text-center';
            hint.innerHTML = '<div><p class="font-medium text-gray-700">Haritada konum yok</p><p class="text-sm text-gray-500 mt-1">Google Maps linki yapıştırıp <b>Konumu Bul</b>a tıklayın</p></div>';
            container.style.position = 'relative';
            container.appendChild(hint);
        }
    } else {
        document.getElementById('map-hint')?.remove();
        withCoords.forEach(r => {
            const marker = L.marker([r.lat, r.lng], { icon: createCustomIcon('visited') });
            marker.bindPopup(buildMapPopup(r));
            markerCluster.addLayer(marker);
        });
        wishWithCoords.forEach(w => {
            const marker = L.marker([w.lat, w.lng], { icon: createCustomIcon('wishlist') });
            marker.bindPopup(buildMapPopup(w, true));
            markerCluster.addLayer(marker);
        });
        const all = [...withCoords, ...wishWithCoords];
        if (all.length === 1) {
            mapInstance.setView([all[0].lat, all[0].lng], 14);
        } else if (all.length > 1) {
            const bounds = L.latLngBounds(all.map(x => [x.lat, x.lng]));
            mapInstance.fitBounds(bounds, { padding: [40, 40] });
        }
    }
    setTimeout(() => mapInstance.invalidateSize(), 100);
}

// --- LİSTE ---
async function loadRestaurants() {
    const params = new URLSearchParams({ sort: DEFAULT_SORT });
    const res = await fetch(`${API}/restaurants?${params}`);
    allRestaurants = await res.json();
    renderList(allRestaurants);
    loadStats();
    if (currentView === 'map') renderMap();
    updateMascotMood();
}

function renderVisitHistory(visits, restaurantId) {
    if (!visits?.length) return '';
    const sorted = [...visits].sort((a, b) => b.date.localeCompare(a.date));
    return `<div class="mt-3 space-y-2">
        <p class="text-xs font-semibold text-rose-400 uppercase tracking-wide">Son Ziyaretler</p>
        ${sorted.slice(0, 2).map(v => {
            const isSpecial = (v.tags || []).some(t => SPECIAL_TAGS.has(t));
            return `<div class="visit-history-item ${isSpecial ? 'special-memory' : ''}">
                <div class="text-sm font-medium">${formatDate(v.date)}${isSpecial ? ' · Özel' : ''}</div>
                ${v.notes ? `<p class="text-sm text-gray-600 italic mt-1">"${escapeHtml(v.notes)}"</p>` : ''}
                ${v.dishes?.length ? `<p class="text-xs text-gray-500 mt-1">${v.dishes.map(d=>`${escapeHtml(d.name)} ${d.rating}★`).join(' · ')}</p>` : ''}
                ${renderTags(v.tags)}
            </div>`;
        }).join('')}
        ${sorted.length > 2 ? `<button onclick="openHistoryModal('${restaurantId}')" class="text-sm text-rose-500 hover:underline">Tümünü gör (${sorted.length})</button>` : ''}
    </div>`;
}

function renderCoverRatingBadge(avg, perfect) {
    const stars = renderStars(Math.round(parseFloat(avg)), 'on-dark');
    if (perfect) {
        return `<div class="card-score-stack">
            <span class="card-score-label">Mükemmel</span>
            <div class="cover-rating-badge cover-rating-badge-stacked">
                <span class="score">${avg}</span>
                <span class="stars stars-compact">${stars}</span>
            </div>
        </div>`;
    }
    return `<div class="cover-rating-badge">
        <span class="score">${avg}</span>
        <span class="stars stars-compact">${stars}</span>
    </div>`;
}

function renderPlaceholderRating(avg, perfect) {
    const stars = renderStars(Math.round(parseFloat(avg)));
    if (perfect) {
        return `<div class="card-rating-unit">
            <span class="card-score-label">Mükemmel</span>
            <div class="placeholder-rating-pill">
                <span class="score">${avg}</span>
                <span class="stars stars-compact">${stars}</span>
            </div>
        </div>`;
    }
    return `<span class="rating-inline">${avg} · ${stars}</span>`;
}

function renderRestaurantCard(r, index) {
    const avg = avgRating(r.myRating, r.partnerRating);
    const cover = getCoverPhoto(r);
    const photoCount = getPhotoCount(r);
    const initial = nameInitial(r.name);
    const perfect = Math.round(parseFloat(avg)) >= 5;
    const perfectClass = perfect ? ' card-perfect' : '';
    const favClass = r.favorite ? ' active' : '';

    if (cover) {
        return `<article class="restaurant-card${perfectClass}" id="card-${r.id}" style="animation-delay:${index * 0.05}s" onclick="openRestaurantDetail('${r.id}')">
            <div class="card-cover${perfect ? ' has-perfect' : ''}">
                <img src="${cover}" class="card-cover-img" alt="">
                <div class="card-cover-overlay"></div>
                <div class="card-cover-info"><h3>${escapeHtml(r.name)}</h3></div>
                <button type="button" onclick="event.stopPropagation();toggleFavorite('${r.id}')" class="fav-btn fav-btn-cover${favClass}" aria-label="Favori">♥</button>
                ${photoCount > 1 ? `<span class="cover-photo-badge">${photoCount} foto</span>` : ''}
                ${renderCoverRatingBadge(avg, perfect)}
            </div>
        </article>`;
    }

    return `<article class="restaurant-card${perfectClass}" id="card-${r.id}" style="animation-delay:${index * 0.05}s" onclick="openRestaurantDetail('${r.id}')">
        <div class="card-placeholder">
            <button type="button" onclick="event.stopPropagation();toggleFavorite('${r.id}')" class="fav-btn${favClass}" aria-label="Favori">♥</button>
            <span class="card-monogram">${initial}</span>
            <span class="name">${escapeHtml(r.name)}</span>
            ${renderPlaceholderRating(avg, perfect)}
        </div>
    </article>`;
}

async function openRestaurantDetail(id) {
    const res = await fetch(`${API}/restaurants/${id}`);
    const r = await res.json();
    const modal = document.getElementById('detail-modal');
    modal.classList.remove('hidden');
    modal.innerHTML = buildDetailModalHtml(r);
    modal.onclick = e => { if (e.target === modal) closeModal('detail-modal'); };
    updateMascotMood({ restaurant: r });
}

function renderList(restaurants) {
    const list = document.getElementById('restaurant-list');

    if (!restaurants.length) {
        list.innerHTML = renderEmptyState('Henüz restoran yok', 'İlk mekânınızı ekleyin — macera buradan başlar.', '<button onclick="fabAddRestaurant()" class="btn-primary">Restoran ekle</button>', '✦');
        return;
    }
    list.innerHTML = restaurants.map((r, i) => renderRestaurantCard(r, i)).join('');
}

// --- TIMELINE ---
async function loadTimeline() {
    const res = await fetch(`${API}/timeline`);
    const events = await res.json();
    renderTimeline(events);
}

function renderTimeline(events) {
    const list = document.getElementById('timeline-list');
    if (!events.length) {
        list.innerHTML = renderEmptyState('Henüz anı yok', 'Ziyaret ekleyince burada görünür.', '', '◷');
        return;
    }
    list.innerHTML = events.map(e => {
        const isSpecial = e.isSpecial || (e.tags || []).some(t => SPECIAL_TAGS.has(t));
        const parts = formatDateParts(e.date);
        return `<div class="timeline-item">
            <div class="date-badge ${isSpecial ? 'special' : ''}">
                <span class="day">${parts.day}</span>
                <span class="month">${parts.month}</span>
            </div>
            <div class="timeline-content ${isSpecial ? 'special-glow' : ''}">
                <p class="font-display font-semibold theme-text">${escapeHtml(e.restaurantName)}${isSpecial ? ' · Özel' : ''}</p>
                ${e.notes ? `<p class="text-sm italic mt-2 opacity-80">"${escapeHtml(e.notes)}"</p>` : ''}
                ${e.dishes?.length ? `<p class="text-xs mt-1 opacity-60">${e.dishes.map(d=>`${escapeHtml(d.name)} ${d.rating}★`).join(', ')}</p>` : ''}
                ${renderTags(e.tags)}
                ${e.photoCount ? `<p class="text-xs mt-2 opacity-60"><button type="button" class="text-link" onclick="openRestaurantDetail('${e.restaurantId}')">${e.photoCount} fotoğraf</button></p>` : ''}
            </div>
        </div>`;
    }).join('');
}

// --- WISHLIST ---
async function loadWishlist() {
    const res = await fetch(`${API}/wishlist`);
    allWishlist = await res.json();
    renderWishlist();
    if (currentView === 'map') renderMap();
    updateMascotMood();
}

function renderWishlist() {
    const list = document.getElementById('wishlist-list');
    if (!allWishlist.length) {
        list.innerHTML = renderEmptyState('İstek listesi boş', 'Gitmek istediğiniz restoranları buraya ekleyin.', '<button onclick="openWishlistAddModal()" class="btn-primary">İstek ekle</button>');
        return;
    }
    list.innerHTML = allWishlist.map(w => {
        const { formatted, rel, days } = formatWishlistAddedAt(w.addedAt);
        const ageClass = days >= 30 ? ' wishlist-card-stale' : days >= 7 ? ' wishlist-card-aging' : '';
        return `
        <div class="wishlist-card${ageClass}">
            <div class="wishlist-body">
                <p class="wishlist-name">${escapeHtml(w.name)}</p>
                <p class="wishlist-meta">${escapeHtml(w.location || '')}</p>
                <p class="wishlist-date">${formatted} · <span class="wishlist-date-rel">${rel}</span></p>
                ${w.notes ? `<p class="wishlist-note">"${escapeHtml(w.notes)}"</p>` : ''}
            </div>
            <div class="wishlist-actions">
                <button type="button" onclick="visitFromWishlist('${w.id}')" class="btn-secondary btn-sm">Gittik</button>
                <button type="button" onclick="deleteWishlistItem('${w.id}')" class="text-link text-link-danger">Sil</button>
            </div>
        </div>`;
    }).join('');
}

function openWishlistAddModal() {
    closeFabMenu();
    const modal = document.getElementById('wishlist-modal');
    modal.classList.remove('hidden');
    modal.innerHTML = `<div class="modal-box">
        <div class="flex justify-between mb-4"><h2 class="font-display font-semibold text-rose-700">İstek Listesine Ekle</h2>
        <button onclick="closeModal('wishlist-modal')" class="text-2xl text-gray-400">×</button></div>
        <form id="wishlist-form" class="space-y-4" onsubmit="submitWishlist(event)">
            <div><label class="label">Restoran Adı *</label><input type="text" id="wishlist-name" required class="input" placeholder="Denemek istediğimiz yer"></div>
            <div><label class="label">Konum</label>
            <div class="flex gap-2"><input type="text" id="wishlist-location" class="input flex-1" placeholder="Google Maps linki">
            <button type="button" onclick="geocodeLocation('wishlist')" class="btn-secondary shrink-0 text-xs">Bul</button></div>
            <p id="wishlist-location-status" class="text-xs mt-1 hidden"></p></div>
            <div><label class="label">Not</label><textarea id="wishlist-notes" rows="2" class="input resize-none" placeholder="Neden gitmek istiyoruz?"></textarea></div>
            <button type="submit" class="btn-primary w-full">Listeye Ekle</button>
        </form>
    </div>`;
    modal.onclick = e => { if (e.target === modal) closeModal('wishlist-modal'); };
}

async function submitWishlist(e) {
    e.preventDefault();
    const loc = document.getElementById('wishlist-location');
    if (loc.value.trim() && !loc.dataset.lat) await geocodeLocation('wishlist');
    const body = {
        name: document.getElementById('wishlist-name').value,
        location: loc.value,
        notes: document.getElementById('wishlist-notes').value,
        lat: loc.dataset.lat ? parseFloat(loc.dataset.lat) : null,
        lng: loc.dataset.lng ? parseFloat(loc.dataset.lng) : null
    };
    await fetch(`${API}/wishlist`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    closeModal('wishlist-modal');
    showToast('İstek listesine eklendi!');
    loadWishlist();
    loadStats();
}

async function visitFromWishlist(id) {
    const res = await fetch(`${API}/wishlist/${id}/visit`, { method: 'POST' });
    if (res.ok) {
        showToast('Restoran eklendi — gittiniz!');
        loadWishlist();
        loadRestaurants();
        loadStats();
    }
}

async function deleteWishlistItem(id, { refreshPicker = false } = {}) {
    if (!confirm('İstek listesinden silinsin mi?')) return;
    await fetch(`${API}/wishlist/${id}`, { method: 'DELETE' });
    await loadWishlist();
    loadStats();
    if (refreshPicker || isNamePickerOpen()) {
        renderNamePickerList(document.getElementById('name-picker-search')?.value || '');
    }
}

function isNamePickerOpen() {
    const modal = document.getElementById('name-picker-modal');
    return modal && !modal.classList.contains('hidden');
}

// --- ROULETTE ---
function getRoulettePool(fromWishlist = false) {
    if (fromWishlist) return [...allWishlist];
    const favs = allRestaurants.filter(r => r.favorite);
    return favs.length >= 2 ? favs : [...allRestaurants];
}

function rouletteSourceHint(pool, fromWishlist) {
    if (fromWishlist) return `${pool.length} istek listesi öğesi arasından`;
    const favs = allRestaurants.filter(r => r.favorite);
    return `${pool.length} restoran arasından${favs.length >= 2 ? ' (favoriler)' : ''}`;
}

function shortRouletteName(name, max = 11) {
    const n = (name || '').trim();
    if (n.length <= max) return n;
    return `${n.slice(0, max - 1)}…`;
}

function buildRouletteWheelHtml(pool) {
    const n = pool.length;
    if (!n) return '<div class="roulette-wheel-empty">Liste boş</div>';
    const slice = 360 / n;
    const stops = pool.map((_, i) => {
        const c = ROULETTE_COLORS[i % ROULETTE_COLORS.length];
        return `${c} ${(i * slice).toFixed(2)}deg ${((i + 1) * slice).toFixed(2)}deg`;
    }).join(', ');
    const labels = pool.map((r, i) => {
        const angle = i * slice + slice / 2;
        return `<span class="roulette-label" style="--a:${angle}deg">${escapeHtml(shortRouletteName(r.name))}</span>`;
    }).join('');
    return `<div class="roulette-wheel-face" style="background:conic-gradient(${stops})">${labels}<div class="roulette-hub"></div></div>`;
}

function renderRouletteWheel(pool, resetRotation = true) {
    const wheel = document.getElementById('roulette-wheel');
    if (!wheel) return;
    if (resetRotation) {
        rouletteRotation = 0;
        wheel.style.transition = 'none';
        wheel.style.transform = 'rotate(0deg)';
        void wheel.offsetHeight;
        wheel.style.transition = '';
    }
    wheel.innerHTML = buildRouletteWheelHtml(pool);
}

function updateRouletteSourceLabel() {
    const el = document.getElementById('roulette-source-label');
    if (el) el.textContent = rouletteSourceHint(roulettePool, rouletteFromWishlist);
}

function openRouletteModal() {
    closeFabMenu();
    rouletteFromWishlist = false;
    roulettePool = getRoulettePool(false);
    const modal = document.getElementById('roulette-modal');
    modal.classList.remove('hidden');
    modal.innerHTML = `<div class="modal-box text-center">
        <div class="flex justify-between mb-4"><h2 class="font-display font-semibold theme-text">Bugün Nereye?</h2>
        <button onclick="closeModal('roulette-modal')" class="text-2xl opacity-40">×</button></div>
        <div class="roulette-wrap">
            <div class="roulette-pointer" aria-hidden="true"></div>
            <div id="roulette-wheel" class="roulette-wheel"></div>
        </div>
        <div id="roulette-result" class="roulette-result hidden"></div>
        <p id="roulette-source-label" class="text-xs text-gray-400 mb-4">${rouletteSourceHint(roulettePool, false)}</p>
        <button id="roulette-spin-btn" onclick="spinRoulette()" class="btn-primary w-full" ${roulettePool.length < 1 ? 'disabled' : ''}>Çevir!</button>
        ${allWishlist.length ? `<button onclick="spinRoulette(true)" class="btn-secondary w-full mt-2">İstek listesinden seç (${allWishlist.length})</button>` : ''}
    </div>`;
    renderRouletteWheel(roulettePool, true);
    modal.onclick = e => { if (e.target === modal) closeModal('roulette-modal'); };
}

function sameRoulettePool(a, b) {
    if (a.length !== b.length) return false;
    return a.every((r, i) => r.id === b[i]?.id);
}

function spinRoulette(fromWishlist = false) {
    if (rouletteSpinning) return;
    const pool = getRoulettePool(fromWishlist);
    if (!pool.length) {
        showToast(fromWishlist ? 'İstek listesi boş!' : 'Restoran yok!');
        return;
    }

    if (fromWishlist !== rouletteFromWishlist || !sameRoulettePool(pool, roulettePool)) {
        rouletteFromWishlist = fromWishlist;
        roulettePool = pool;
        renderRouletteWheel(pool, true);
        updateRouletteSourceLabel();
    } else {
        roulettePool = pool;
    }

    rouletteSpinning = true;
    const btn = document.getElementById('roulette-spin-btn');
    if (btn) btn.disabled = true;
    const wheel = document.getElementById('roulette-wheel');
    const result = document.getElementById('roulette-result');
    if (!wheel || !result) {
        rouletteSpinning = false;
        if (btn) btn.disabled = false;
        return;
    }
    result.classList.add('hidden');
    result.innerHTML = '';

    const pickIndex = Math.floor(Math.random() * pool.length);
    const pick = pool[pickIndex];
    const slice = 360 / pool.length;
    const segmentCenter = pickIndex * slice + slice / 2;
    const extraTurns = 4 + Math.floor(Math.random() * 2);
    const target = rouletteRotation + extraTurns * 360 + (360 - segmentCenter);
    rouletteRotation = target;
    wheel.style.transform = `rotate(${target}deg)`;

    setTimeout(() => {
        result.classList.remove('hidden');
        const rating = !fromWishlist && pick.myRating != null
            ? `<p class="roulette-result-rating">${avgRating(pick.myRating, pick.partnerRating)}★ ortalama</p>` : '';
        result.innerHTML = `<p class="roulette-result-kicker">Bugün buraya gidelim!</p>
            <p class="roulette-result-name">${escapeHtml(pick.name)}</p>
            ${pick.location ? `<p class="roulette-result-sub">${escapeHtml(pick.location)}</p>` : ''}
            ${rating}`;
        showToast(funMessage('roulette'), { fun: true, confetti: true, confettiCount: 20 });
        rouletteSpinning = false;
        if (btn) btn.disabled = false;
    }, 3000);
}

// --- FAB ---
function openFabMenu() {
    document.getElementById('fab-menu').classList.toggle('hidden');
}
function closeFabMenu() {
    document.getElementById('fab-menu').classList.add('hidden');
}
function fabAddRestaurant() {
    closeFabMenu();
    const form = document.getElementById('add-form');
    const section = document.getElementById('add-section');
    form.classList.remove('hidden');
    section?.classList.add('add-panel-open');
    document.getElementById('add-form-toggle').textContent = '−';
    section.scrollIntoView({ behavior: 'smooth' });
    document.getElementById('add-name')?.focus();
}

document.addEventListener('click', e => {
    if (!e.target.closest('#fab') && !e.target.closest('#fab-menu')) closeFabMenu();
});

// --- FAVORİ ---
async function toggleFavorite(id) {
    const btn = document.querySelector(`#card-${id} .fav-btn`);
    const wasFav = btn?.classList.contains('active');
    await fetch(`${API}/restaurants/${id}/favorite`, { method: 'POST' });
    if (btn) {
        btn.classList.toggle('active');
        btn.classList.add('pop');
        setTimeout(() => btn.classList.remove('pop'), 500);
    }
    if (!wasFav) showToast(funMessage('favorite'), { fun: true });
    loadRestaurants();
    loadStats();
}

// --- ZİYARET ---
function openVisitModal(id) {
    visitRestaurantId = id;
    visitPhotoData = [];
    visitCoverPhoto = null;
    selectedVisitTags = [];
    const modal = document.getElementById('visit-modal');
    modal.classList.remove('hidden');
    const today = new Date().toISOString().split('T')[0];
    modal.innerHTML = `<div class="modal-box">
        <div class="flex justify-between mb-4"><h2 class="font-semibold text-rose-700">Yeni Ziyaret Ekle</h2>
        <button onclick="closeModal('visit-modal')" class="text-2xl text-gray-400">×</button></div>
        <form id="visit-form" class="space-y-4" onsubmit="submitVisit(event)">
            <div><label class="label">Tarih</label><input type="date" id="visit-date" class="input" value="${today}"></div>
            <div><label class="label">Ne Yedik?</label><div id="visit-dishes" class="space-y-2"></div>
            <button type="button" onclick="addDishRow('visit')" class="text-sm text-rose-500 hover:underline">+ Yemek ekle</button></div>
            <div><label class="label">Özel Gün</label><div id="visit-tags" class="flex flex-wrap gap-2"></div></div>
            <div><label class="label">Not</label><textarea id="visit-notes" rows="2" class="input resize-none"></textarea></div>
            <div><label class="label">Fotoğraf</label><input type="file" id="visit-photos" accept="image/*" multiple class="file-input" onchange="handleVisitPhotos(event)">
            <div id="visit-photo-preview" class="flex flex-wrap gap-2 mt-2"></div></div>
            <button type="submit" class="btn-primary w-full">Ziyaret Ekle</button>
        </form>
    </div>`;
    buildTagSelector('visit');
    modal.onclick = e => { if (e.target === modal) closeModal('visit-modal'); };
}

async function handleVisitPhotos(e) {
    const photos = await readFilesCompressed(e.target.files);
    visitPhotoData = [...visitPhotoData, ...photos];
    await refreshVisitCoverPhoto();
    renderPhotoPreviews('visit-photo-preview', visitPhotoData, true, 'removeVisitPhoto');
    e.target.value = '';
}
function removeVisitPhoto(i) {
    visitPhotoData.splice(i, 1);
    refreshVisitCoverPhoto().then(() => renderPhotoPreviews('visit-photo-preview', visitPhotoData, true, 'removeVisitPhoto'));
}

async function submitVisit(e) {
    e.preventDefault();
    const body = {
        date: document.getElementById('visit-date').value,
        notes: document.getElementById('visit-notes').value,
        dishes: getDishesFromForm('visit'),
        tags: selectedVisitTags,
        photos: visitPhotoData,
        coverPhoto: visitCoverPhoto
    };
    await fetch(`${API}/restaurants/${visitRestaurantId}/visits`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    closeModal('visit-modal');
    showToast(funMessage('visit'), { fun: true, confetti: true, confettiCount: 16 });
    loadRestaurants();
    loadStats();
}

// --- GEÇMİŞ ---
async function openHistoryModal(id) {
    const res = await fetch(`${API}/restaurants/${id}`);
    const r = await res.json();
    const modal = document.getElementById('history-modal');
    modal.classList.remove('hidden');
    const visits = [...(r.visits||[])].sort((a,b) => b.date.localeCompare(a.date));
    modal.innerHTML = `<div class="modal-box">
        <div class="flex justify-between mb-4"><h2 class="font-display font-semibold text-rose-700">${escapeHtml(r.name)} — Anılar</h2>
        <button onclick="closeModal('history-modal')" class="text-2xl text-gray-400">×</button></div>
        <div class="space-y-4">${visits.map(v => {
            const isSpecial = (v.tags || []).some(t => SPECIAL_TAGS.has(t));
            return `<div class="visit-history-item ${isSpecial ? 'special-memory' : ''}">
                <div class="flex justify-between items-start">
                    <p class="font-medium">${formatDate(v.date)}${isSpecial ? ' · Özel' : ''}</p>
                    <button onclick="deleteVisit('${id}','${v.id}')" class="text-red-400 text-xs hover:underline">Sil</button>
                </div>
                ${v.notes ? `<p class="text-sm italic text-gray-600 mt-1">"${escapeHtml(v.notes)}"</p>` : ''}
                ${v.dishes?.length ? `<p class="text-xs text-gray-500 mt-1">${v.dishes.map(d=>`${escapeHtml(d.name)} ${d.rating}★`).join(', ')}</p>` : ''}
                ${renderTags(v.tags)}
                ${v.photos?.length ? renderPhotoStrip(v.photos, `history-${id}-${v.id}`) : ''}
            </div>`;
        }).join('')}</div>
    </div>`;
    modal.onclick = e => { if (e.target === modal) closeModal('history-modal'); };
}

async function deleteVisit(restaurantId, visitId) {
    if (!confirm('Bu ziyareti silmek istediğine emin misin?')) return;
    await fetch(`${API}/restaurants/${restaurantId}/visits/${visitId}`, { method: 'DELETE' });
    closeModal('history-modal');
    loadRestaurants();
}

// --- DÜZENLEME ---
async function openEditModal(id) {
    const res = await fetch(`${API}/restaurants/${id}`);
    const r = await res.json();
    const labels = getRatingLabels();
    const modal = document.getElementById('edit-modal');
    modal.classList.remove('hidden');
    modal.innerHTML = `<div class="modal-box">
        <div class="flex justify-between mb-4"><h2 class="font-semibold text-rose-700">Düzenle</h2>
        <button onclick="closeModal('edit-modal')" class="text-2xl text-gray-400">×</button></div>
        <form id="edit-form" class="space-y-4" onsubmit="submitEdit(event,'${r.id}')">
            <div><label class="label">Ad</label><input type="text" id="edit-name" class="input" value="${escapeHtml(r.name)}" required></div>
            <div>
                <label class="label">Konum</label>
                <div class="flex gap-2"><input type="text" id="edit-location" class="input flex-1" value="${escapeHtml(r.location)}">
                <button type="button" onclick="geocodeLocation('edit')" class="btn-secondary shrink-0 text-xs px-2">Bul</button></div>
                <p id="edit-location-status" class="text-xs mt-1 hidden"></p>
            </div>
            <div class="grid grid-cols-2 gap-3">
                <div><label class="label">${escapeHtml(labels.mine)}</label><div id="edit-my-rating" class="stars"></div><input type="hidden" id="edit-my-rating-val" value="${r.myRating}"></div>
                <div><label class="label">${escapeHtml(labels.partner)}</label><div id="edit-partner-rating" class="stars"></div><input type="hidden" id="edit-partner-rating-val" value="${r.partnerRating}"></div>
            </div>
            <div><label class="flex items-center gap-2 cursor-pointer text-sm"><input type="checkbox" id="edit-favorite" class="rounded text-rose-500" ${r.favorite?'checked':''}> Favori</label></div>
            <div class="flex gap-3">
                <button type="submit" class="btn-primary flex-1">Kaydet</button>
                <button type="button" onclick="closeModal('edit-modal')" class="btn-secondary">İptal</button>
            </div>
        </form>
    </div>`;
    buildStarPicker('edit-my-rating', 'edit-my-rating-val', r.myRating);
    buildStarPicker('edit-partner-rating', 'edit-partner-rating-val', r.partnerRating);
    if (r.lat && r.lng) setLocationCoords('edit', r.lat, r.lng);
    modal.onclick = e => { if (e.target === modal) closeModal('edit-modal'); };
}

async function submitEdit(e, id) {
    e.preventDefault();
    const loc = document.getElementById('edit-location');
    if (loc.value.trim() && !loc.dataset.lat) await geocodeLocation('edit');
    const body = {
        name: document.getElementById('edit-name').value,
        location: loc.value,
        lat: loc.dataset.lat ? parseFloat(loc.dataset.lat) : null,
        lng: loc.dataset.lng ? parseFloat(loc.dataset.lng) : null,
        myRating: Number(document.getElementById('edit-my-rating-val').value),
        partnerRating: Number(document.getElementById('edit-partner-rating-val').value),
        categories: categoriesFromRatings(
            document.getElementById('edit-my-rating-val').value,
            document.getElementById('edit-partner-rating-val').value
        ),
        favorite: document.getElementById('edit-favorite').checked
    };
    await fetch(`${API}/restaurants/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    closeModal('edit-modal');
    showToast('Güncellendi!');
    loadRestaurants();
}

async function deleteRestaurant(id) {
    const r = allRestaurants.find(x => x.id === id);
    if (!confirm(`"${r?.name}" silinsin mi?`)) return;
    await fetch(`${API}/restaurants/${id}`, { method: 'DELETE' });
    loadRestaurants();
}

// --- EKLEME ---
function toggleAddForm() {
    const form = document.getElementById('add-form');
    const section = document.getElementById('add-section');
    const hidden = form.classList.toggle('hidden');
    section?.classList.toggle('add-panel-open', !hidden);
    document.getElementById('add-form-toggle').textContent = hidden ? '+' : '−';
}

function setupUI() {
    buildTagSelector('add');
    addDishRow('add');
    buildStarPicker('add-my-rating', 'add-my-rating-val', 3);
    buildStarPicker('add-partner-rating', 'add-partner-rating-val', 3);
    setDefaultDate();
    setupNameAutocomplete('add-name', 'add-name-suggest');

    document.getElementById('add-photos').addEventListener('change', async e => {
        const photos = await readFilesCompressed(e.target.files);
        addPhotoData = [...addPhotoData, ...photos];
        await refreshAddCoverPhoto();
        renderPhotoPreviews('add-photo-preview', addPhotoData, true, 'removeAddPhoto');
        e.target.value = '';
    });
    document.getElementById('add-form').addEventListener('submit', submitAdd);
}

function removeAddPhoto(i) {
    addPhotoData.splice(i, 1);
    refreshAddCoverPhoto().then(() => renderPhotoPreviews('add-photo-preview', addPhotoData, true, 'removeAddPhoto'));
}
function setDefaultDate() {
    const el = document.getElementById('add-last-visited');
    if (el) el.value = new Date().toISOString().split('T')[0];
}

async function submitAdd(e) {
    e.preventDefault();
    const loc = document.getElementById('add-location');
    if (loc.value.trim() && !loc.dataset.lat) await geocodeLocation('add');
    const body = {
        name: document.getElementById('add-name').value,
        location: loc.value,
        lat: loc.dataset.lat ? parseFloat(loc.dataset.lat) : null,
        lng: loc.dataset.lng ? parseFloat(loc.dataset.lng) : null,
        myRating: Number(document.getElementById('add-my-rating-val').value),
        partnerRating: Number(document.getElementById('add-partner-rating-val').value),
        categories: categoriesFromRatings(
            document.getElementById('add-my-rating-val').value,
            document.getElementById('add-partner-rating-val').value
        ),
        notes: document.getElementById('add-notes').value,
        photos: addPhotoData,
        coverPhoto: addCoverPhoto,
        lastVisited: document.getElementById('add-last-visited').value,
        dishes: getDishesFromForm('add'),
        tags: selectedAddTags,
        favorite: document.getElementById('add-favorite').checked
    };
    const res = await fetch(`${API}/restaurants`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (res.ok) {
        const count = allRestaurants.length + 1;
        const score = parseFloat(avgRating(body.myRating, body.partnerRating));
        let msg = funMessage('add');
        let confetti = false;
        if (count === 1) {
            msg = funMessage('first');
            confetti = true;
        } else if (count === 5 || count === 10 || count === 25) {
            msg = funMessage('milestone', { n: count });
            confetti = true;
        } else if (score >= 5) {
            msg = funMessage('perfect');
            confetti = true;
        }
        flashToast(msg, { confetti, fun: true });
        location.reload();
        return;
    }
    showToast('Eklenemedi, tekrar deneyin');
}

function debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// --- MASCOT ---
const MASCOT_POS_KEY = 'mascotPos';
let mascotBubbleTimer = null;
let mascotContextRestaurant = null;

function initMascot() {
    const el = document.getElementById('mascot');
    if (!el) return;
    restoreMascotPosition(el);
    setupMascotDrag(el);
    updateMascotMood();
}

function restoreMascotPosition(el) {
    try {
        const saved = JSON.parse(localStorage.getItem(MASCOT_POS_KEY) || 'null');
        if (saved && typeof saved.left === 'number' && typeof saved.top === 'number') {
            el.style.left = `${saved.left}px`;
            el.style.top = `${saved.top}px`;
            el.style.right = 'auto';
            el.style.bottom = 'auto';
        }
    } catch { /* varsayılan konum */ }
}

function saveMascotPosition(el) {
    const rect = el.getBoundingClientRect();
    localStorage.setItem(MASCOT_POS_KEY, JSON.stringify({ left: rect.left, top: rect.top }));
}

function setupMascotDrag(el) {
    let dragging = false;
    let moved = false;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;
    const margin = 8;

    const clamp = (val, min, max) => Math.max(min, Math.min(max, val));

    el.addEventListener('pointerdown', e => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        dragging = true;
        moved = false;
        el.setPointerCapture(e.pointerId);
        el.classList.add('mascot-dragging');
        const rect = el.getBoundingClientRect();
        startX = e.clientX;
        startY = e.clientY;
        startLeft = rect.left;
        startTop = rect.top;
        el.style.left = `${startLeft}px`;
        el.style.top = `${startTop}px`;
        el.style.right = 'auto';
        el.style.bottom = 'auto';
    });

    el.addEventListener('pointermove', e => {
        if (!dragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        if (Math.abs(dx) > 4 || Math.abs(dy) > 4) moved = true;
        const w = el.offsetWidth;
        const h = el.offsetHeight;
        const left = clamp(startLeft + dx, margin, window.innerWidth - w - margin);
        const top = clamp(startTop + dy, margin, window.innerHeight - h - margin);
        el.style.left = `${left}px`;
        el.style.top = `${top}px`;
    });

    const endDrag = e => {
        if (!dragging) return;
        dragging = false;
        el.releasePointerCapture(e.pointerId);
        el.classList.remove('mascot-dragging');
        saveMascotPosition(el);
        if (!moved) showMascotBubble(getMascotState().message, { force: true });
    };

    el.addEventListener('pointerup', endDrag);
    el.addEventListener('pointercancel', endDrag);
}

function moodFromRating(avg) {
    if (avg >= 4.5) return 'excited';
    if (avg >= 3.5) return 'happy';
    if (avg >= 2.5) return 'neutral';
    return 'sad';
}

function getOldestWishlistItem() {
    if (!allWishlist.length) return null;
    return [...allWishlist]
        .filter(w => w.addedAt)
        .sort((a, b) => new Date(a.addedAt) - new Date(b.addedAt))[0] || null;
}

function getWishlistPoutState() {
    const oldest = getOldestWishlistItem();
    if (!oldest) return null;
    const { rel, days } = formatWishlistAddedAt(oldest.addedAt);
    if (days >= 30) {
        return {
            mood: 'pout',
            message: `"${oldest.name}" ${rel}… Küsüyorum artık!`
        };
    }
    if (days >= 14) {
        return {
            mood: 'pout',
            message: `"${oldest.name}" ${rel}. Ne zaman gideceğiz?`
        };
    }
    if (days >= 7) {
        return {
            mood: 'pout',
            message: `"${oldest.name}" biraz bekledi… Küsmeye başladım.`
        };
    }
    if (days >= 3) {
        return {
            mood: 'neutral',
            message: `"${oldest.name}" ${rel}. Sırada o olabilir mi?`
        };
    }
    return {
        mood: 'happy',
        message: `"${oldest.name}" taze eklendi — yakında gideriz!`
    };
}

function getOverallRatingMood() {
    if (!allRestaurants.length) {
        return { mood: 'neutral', message: 'İlk restoranı ekleyince buradayım!' };
    }
    const avg = allRestaurants.reduce((s, r) => s + parseFloat(avgRating(r.myRating, r.partnerRating)), 0) / allRestaurants.length;
    const mood = moodFromRating(avg);
    const messages = {
        excited: 'Genel ortalama muhteşem — lezzet turu başarılı!',
        happy: 'Güzel puanlar birikmiş, devam!',
        neutral: 'Fena değil ama daha iyisi de olur.',
        sad: 'Ortalama düşük… Bir sonraki mekân daha iyi olsun.'
    };
    return { mood, message: messages[mood] };
}

function getRestaurantMood(restaurant) {
    const avg = parseFloat(avgRating(restaurant.myRating, restaurant.partnerRating));
    const mood = moodFromRating(avg);
    const name = restaurant.name || 'Bu mekân';
    const messages = {
        excited: `${name} — ${avg}★! İkimiz de bayılmışız!`,
        happy: `${name} ${avg}★ — güzel bir tercih.`,
        neutral: `${name} ${avg}★ — idare eder sayılır.`,
        sad: `${name} ${avg}★… Bu puan can sıkıcı.`
    };
    return { mood, message: messages[mood] };
}

function getMascotState(opts = {}) {
    if (opts.restaurant) return getRestaurantMood(opts.restaurant);

    const pout = allWishlist.length ? getWishlistPoutState() : null;

    if (currentView === 'wishlist') {
        if (!allWishlist.length) {
            return { mood: 'neutral', message: 'İstek listesi boş — ekleyince heyecanlanırım!' };
        }
        if (pout) return pout;
    } else if (pout?.mood === 'pout') {
        return pout;
    }

    return getOverallRatingMood();
}

function updateMascotMood(opts = {}) {
    const el = document.getElementById('mascot');
    if (!el) return;

    const detailOpen = !document.getElementById('detail-modal')?.classList.contains('hidden');
    if (opts.restaurant) mascotContextRestaurant = opts.restaurant;
    else if (!detailOpen) mascotContextRestaurant = null;

    const activeRestaurant = opts.restaurant || (detailOpen ? mascotContextRestaurant : null);
    const state = getMascotState({ restaurant: activeRestaurant || undefined });
    el.dataset.mood = state.mood;
    el.dataset.message = state.message;
    showMascotBubble(state.message);
}

function showMascotBubble(text, { force = false } = {}) {
    const bubble = document.getElementById('mascot-bubble');
    if (!bubble || !text) return;
    bubble.textContent = text;
    bubble.classList.remove('hidden');
    bubble.classList.add('show');
    clearTimeout(mascotBubbleTimer);
    mascotBubbleTimer = setTimeout(() => {
        bubble.classList.add('hidden');
        bubble.classList.remove('show');
    }, force ? 3200 : 2400);
}

initApp();
