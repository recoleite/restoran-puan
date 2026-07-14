const API = '';
const APP_URL = '/app';
const THEME_STORAGE_KEY = 'restoranTheme';
const ALLOWED_THEMES = [
    'rose', 'cherry', 'sunset', 'cream', 'lavender', 'ocean', 'sky', 'forest',
    'dark', 'cherry-dark', 'sunset-dark', 'cream-dark', 'lavender-dark', 'ocean-dark', 'sky-dark', 'forest-dark'
];

function applyAuthTheme(theme) {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    const pick = theme || stored || 'rose';
    const safe = ALLOWED_THEMES.includes(pick) ? pick : 'rose';
    document.documentElement.setAttribute('data-theme', safe);
    try { localStorage.setItem(THEME_STORAGE_KEY, safe); } catch { /* ignore */ }
}

applyAuthTheme();

const nativeFetch = window.fetch.bind(window);
window.fetch = (url, options = {}) => {
    const headers = new Headers(options.headers || {});
    const token = localStorage.getItem('authToken');
    if (typeof url === 'string' && !url.startsWith('http') && token) {
        headers.set('Authorization', `Bearer ${token}`);
    }
    return nativeFetch(url, { ...options, headers, credentials: 'same-origin' });
};

function switchAuthTab(tab) {
    document.getElementById('auth-tab-login').classList.toggle('active', tab === 'login');
    document.getElementById('auth-tab-register').classList.toggle('active', tab === 'register');
    document.getElementById('login-form').classList.toggle('hidden', tab !== 'login');
    document.getElementById('register-form').classList.toggle('hidden', tab !== 'register');
    document.getElementById('login-error').classList.add('hidden');
}

function showAuthError(msg) {
    const el = document.getElementById('login-error');
    el.textContent = msg;
    el.classList.remove('hidden');
}

function redirectToApp() {
    window.location.replace(APP_URL);
}

async function initAuthPage() {
    const meRes = await fetch(`${API}/auth/me`);
    if (!meRes.ok) {
        localStorage.removeItem('authToken');
        return;
    }
    const data = await meRes.json().catch(() => null);
    if (data?.settings?.theme) applyAuthTheme(data.settings.theme);
    if (data?.user) redirectToApp();
}

async function login() {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const res = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        showAuthError(data.error || 'Giriş başarısız');
        return;
    }
    localStorage.setItem('authToken', data.token);
    if (data.settings?.theme) applyAuthTheme(data.settings.theme);
    redirectToApp();
}

async function register() {
    const inviteCode = document.getElementById('register-invite').value.trim();
    if (!inviteCode) {
        showAuthError('Davet kodu gerekli');
        return;
    }
    const body = {
        email: document.getElementById('register-email').value.trim(),
        password: document.getElementById('register-password').value,
        coupleName1: document.getElementById('register-name1').value.trim(),
        coupleName2: document.getElementById('register-name2').value.trim(),
        inviteCode
    };
    const res = await fetch(`${API}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        showAuthError(data.error || 'Kayıt başarısız');
        return;
    }
    localStorage.setItem('authToken', data.token);
    if (data.settings?.theme) applyAuthTheme(data.settings.theme);
    redirectToApp();
}

document.getElementById('login-password')?.addEventListener('keydown', e => { if (e.key === 'Enter') login(); });
document.getElementById('register-password')?.addEventListener('keydown', e => { if (e.key === 'Enter') register(); });

initAuthPage();
