const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const COUPLES_DIR = path.join(DATA_DIR, 'couples');

function ensureCouplesDir() {
    if (!fs.existsSync(COUPLES_DIR)) fs.mkdirSync(COUPLES_DIR, { recursive: true });
}

function coupleFile(coupleId) {
    return path.join(COUPLES_DIR, `${coupleId}.json`);
}

function defaultCoupleData() {
    return { messages: [] };
}

function getCoupleId(db, userId) {
    return db.settings?.coupleId || userId;
}

function shareCodeForCoupleId(coupleId) {
    return crypto.createHash('sha256').update(String(coupleId)).digest('hex').slice(0, 8).toUpperCase();
}

function findCoupleIdByShareCode(code) {
    if (!code || code.length < 6) return null;
    ensureCouplesDir();
    const normalized = code.trim().toUpperCase();
    for (const file of fs.readdirSync(COUPLES_DIR)) {
        if (!file.endsWith('.json')) continue;
        const id = file.replace(/\.json$/, '');
        if (shareCodeForCoupleId(id) === normalized) return id;
    }
    for (const file of fs.readdirSync(path.join(DATA_DIR, 'users'))) {
        if (!file.endsWith('.json')) continue;
        const userId = file.replace(/\.json$/, '');
        if (shareCodeForCoupleId(userId) === normalized) return userId;
    }
    return null;
}

function loadCoupleChat(coupleId) {
    ensureCouplesDir();
    const file = coupleFile(coupleId);
    if (!fs.existsSync(file)) return defaultCoupleData();
    try {
        const data = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (!Array.isArray(data.messages)) data.messages = [];
        return data;
    } catch {
        return defaultCoupleData();
    }
}

function saveCoupleChat(coupleId, data) {
    ensureCouplesDir();
    fs.writeFileSync(coupleFile(coupleId), JSON.stringify(data, null, 2));
}

function listMessages(coupleId, since = '') {
    const data = loadCoupleChat(coupleId);
    if (!since) return data.messages;
    return data.messages.filter(m => m.createdAt > since);
}

function addMessage(coupleId, message) {
    const data = loadCoupleChat(coupleId);
    data.messages.push(message);
    if (data.messages.length > 500) {
        data.messages = data.messages.slice(-500);
    }
    saveCoupleChat(coupleId, data);
    return message;
}

module.exports = {
    addMessage,
    findCoupleIdByShareCode,
    getCoupleId,
    listMessages,
    shareCodeForCoupleId
};
