const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const PUSH_DIR = path.join(DATA_DIR, 'push-subscriptions');

function ensureDir() {
    if (!fs.existsSync(PUSH_DIR)) fs.mkdirSync(PUSH_DIR, { recursive: true });
}

function userFile(userId) {
    return path.join(PUSH_DIR, `${userId}.json`);
}

function listUserSubscriptions(userId) {
    ensureDir();
    const file = userFile(userId);
    if (!fs.existsSync(file)) return [];
    try {
        const data = JSON.parse(fs.readFileSync(file, 'utf8'));
        return Array.isArray(data) ? data : [];
    } catch {
        return [];
    }
}

function saveUserSubscriptions(userId, subs) {
    ensureDir();
    fs.writeFileSync(userFile(userId), JSON.stringify(subs, null, 2));
}

function upsertSubscription(userId, sub) {
    const subs = listUserSubscriptions(userId);
    const idx = subs.findIndex(s => s.endpoint === sub.endpoint);
    const entry = { ...sub, userId, updatedAt: new Date().toISOString() };
    if (idx >= 0) subs[idx] = entry;
    else subs.push(entry);
    saveUserSubscriptions(userId, subs);
    return entry;
}

function removeSubscription(userId, endpoint) {
    const subs = listUserSubscriptions(userId).filter(s => s.endpoint !== endpoint);
    saveUserSubscriptions(userId, subs);
}

function getCoupleUserIds(coupleId) {
    const ids = new Set([coupleId]);
    const usersDir = path.join(DATA_DIR, 'users');
    if (!fs.existsSync(usersDir)) return [...ids];
    for (const file of fs.readdirSync(usersDir)) {
        if (!file.endsWith('.json')) continue;
        const userId = file.replace(/\.json$/, '');
        try {
            const db = JSON.parse(fs.readFileSync(path.join(usersDir, file), 'utf8'));
            const cid = db.settings?.coupleId || userId;
            if (cid === coupleId) ids.add(userId);
        } catch { /* skip */ }
    }
    return [...ids];
}

function listCoupleSubscriptions(coupleId, excludeDeviceId = '') {
    const userIds = getCoupleUserIds(coupleId);
    const out = [];
    for (const uid of userIds) {
        for (const sub of listUserSubscriptions(uid)) {
            if (excludeDeviceId && sub.deviceId === excludeDeviceId) continue;
            out.push(sub);
        }
    }
    return out;
}

module.exports = {
    getCoupleUserIds,
    listCoupleSubscriptions,
    removeSubscription,
    upsertSubscription
};
