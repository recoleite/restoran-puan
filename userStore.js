const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const USERS_DIR = path.join(DATA_DIR, 'users');
const USERS_INDEX = path.join(USERS_DIR, 'index.json');
const LEGACY_DATA_FILE = process.env.DATA_FILE || path.join(__dirname, 'data.json');
const JWT_SECRET = process.env.JWT_SECRET || 'restoran-puan-dev-secret-change-me';
const INVITE_CODE = process.env.INVITE_CODE || 'reconisa2026';

function ensureDirs() {
    if (!fs.existsSync(USERS_DIR)) fs.mkdirSync(USERS_DIR, { recursive: true });
    if (!fs.existsSync(USERS_INDEX)) fs.writeFileSync(USERS_INDEX, '[]');
}

function readUsersIndex() {
    ensureDirs();
    try {
        return JSON.parse(fs.readFileSync(USERS_INDEX, 'utf8'));
    } catch {
        return [];
    }
}

function writeUsersIndex(users) {
    ensureDirs();
    fs.writeFileSync(USERS_INDEX, JSON.stringify(users, null, 2));
}

function userDbPath(userId) {
    return path.join(USERS_DIR, `${userId}.json`);
}

function defaultUserDb() {
    return {
        restaurants: [],
        wishlist: [],
        nameRegistry: [],
        settings: { coupleName1: '', coupleName2: '', theme: 'rose' }
    };
}

function hashPassword(password, salt) {
    return crypto.scryptSync(password, salt, 64).toString('hex');
}

function createPasswordHash(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    return { salt, hash: hashPassword(password, salt) };
}

function verifyPassword(password, salt, hash) {
    const attempt = hashPassword(password, salt);
    return crypto.timingSafeEqual(Buffer.from(attempt, 'hex'), Buffer.from(hash, 'hex'));
}

function signToken(userId) {
    const payload = {
        userId,
        exp: Date.now() + 30 * 24 * 60 * 60 * 1000
    };
    const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = crypto.createHmac('sha256', JWT_SECRET).update(data).digest('base64url');
    return `${data}.${sig}`;
}

function verifyToken(token) {
    if (!token) return null;
    const [data, sig] = token.split('.');
    if (!data || !sig) return null;
    const expected = crypto.createHmac('sha256', JWT_SECRET).update(data).digest('base64url');
    if (sig !== expected) return null;
    try {
        const payload = JSON.parse(Buffer.from(data, 'base64url').toString());
        if (!payload.userId || payload.exp < Date.now()) return null;
        return payload;
    } catch {
        return null;
    }
}

function findUserByEmail(email) {
    const normalized = email.trim().toLowerCase();
    return readUsersIndex().find(u => u.email === normalized);
}

function findUserById(userId) {
    return readUsersIndex().find(u => u.id === userId);
}

function createUser({ email, password, displayName = '', coupleName1 = '', coupleName2 = '' }) {
    const normalized = email.trim().toLowerCase();
    if (!normalized || !normalized.includes('@')) throw new Error('Geçerli bir e-posta girin');
    if (!password || password.length < 6) throw new Error('Şifre en az 6 karakter olmalı');
    if (findUserByEmail(normalized)) throw new Error('Bu e-posta zaten kayıtlı');

    const { salt, hash } = createPasswordHash(password);
    const user = {
        id: Date.now().toString(),
        email: normalized,
        displayName: displayName.trim(),
        salt,
        passwordHash: hash,
        createdAt: new Date().toISOString()
    };

    const users = readUsersIndex();
    users.push(user);
    writeUsersIndex(users);

    const db = defaultUserDb();
    db.settings.coupleName1 = coupleName1.trim();
    db.settings.coupleName2 = coupleName2.trim();
    saveUserDb(user.id, db);

    return user;
}

function loadUserDb(userId) {
    const file = userDbPath(userId);
    if (!fs.existsSync(file)) return defaultUserDb();
    try {
        const db = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (!db.restaurants) db.restaurants = [];
        if (!db.wishlist) db.wishlist = [];
        if (!db.nameRegistry) db.nameRegistry = [];
        if (!db.settings) db.settings = defaultUserDb().settings;
        return db;
    } catch {
        return defaultUserDb();
    }
}

function saveUserDb(userId, db) {
    ensureDirs();
    fs.writeFileSync(userDbPath(userId), JSON.stringify(db, null, 2));
}

function migrateLegacyDataIfNeeded(migrateRestaurant) {
    ensureDirs();
    if (readUsersIndex().length > 0) return;
    if (!fs.existsSync(LEGACY_DATA_FILE)) return;

    try {
        const legacy = JSON.parse(fs.readFileSync(LEGACY_DATA_FILE, 'utf8'));
        if (!legacy.restaurants?.length && !legacy.wishlist?.length) return;

        const email = (process.env.OWNER_EMAIL || 'reco@reconisa.com').trim().toLowerCase();
        const password = legacy.settings?.password || 'bizim123';
        const user = createUser({
            email,
            password,
            displayName: 'Reco',
            coupleName1: legacy.settings?.coupleName1 || 'Reco',
            coupleName2: legacy.settings?.coupleName2 || 'Nisa'
        });

        const db = loadUserDb(user.id);
        db.restaurants = (legacy.restaurants || []).map(migrateRestaurant);
        db.wishlist = legacy.wishlist || [];
        db.nameRegistry = legacy.nameRegistry || [];
        db.settings = {
            coupleName1: legacy.settings?.coupleName1 || '',
            coupleName2: legacy.settings?.coupleName2 || '',
            theme: legacy.settings?.theme || 'rose'
        };
        saveUserDb(user.id, db);
        console.log(`Eski veriler ${email} hesabına taşındı.`);
    } catch (err) {
        console.error('Legacy migration failed:', err.message);
    }
}

function checkInviteCode(code) {
    return (code || '').trim() === INVITE_CODE;
}

function sanitizeUser(user) {
    return {
        id: user.id,
        email: user.email,
        displayName: user.displayName || ''
    };
}

function updateUserPassword(userId, newPassword) {
    const users = readUsersIndex();
    const index = users.findIndex(u => u.id === userId);
    if (index === -1) throw new Error('Kullanıcı bulunamadı');
    const { salt, hash } = createPasswordHash(newPassword);
    users[index].salt = salt;
    users[index].passwordHash = hash;
    writeUsersIndex(users);
}

module.exports = {
    INVITE_CODE,
    checkInviteCode,
    createUser,
    findUserByEmail,
    findUserById,
    loadUserDb,
    migrateLegacyDataIfNeeded,
    saveUserDb,
    sanitizeUser,
    signToken,
    verifyPassword,
    verifyToken,
    updateUserPassword
};
