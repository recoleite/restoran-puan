#!/usr/bin/env node
/**
 * İstek listesinden isimle kayıt siler (Render Shell veya lokal).
 * Örnek:
 *   node scripts/prune-wishlist.js "ndn emojiler gitti cnm" "sanane cnm"
 */
const userStore = require('../userStore');

function buildNameList(userDb) {
    const map = new Map();
    const add = (name, cuisine = '', location = '') => {
        const trimmed = (name || '').trim();
        if (!trimmed) return;
        map.set(trimmed.toLowerCase(), { name: trimmed, cuisine, location });
    };
    for (const w of userDb.wishlist || []) add(w.name, w.cuisine, w.location);
    for (const r of userDb.restaurants || []) add(r.name, r.cuisine, r.location);
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'tr'));
}

const targets = process.argv.slice(2).map(n => n.trim().toLowerCase()).filter(Boolean);
if (!targets.length) {
    console.error('Kullanım: node scripts/prune-wishlist.js "mekan adı" ...');
    process.exit(1);
}

let totalRemoved = 0;
for (const userId of userStore.listUserIds()) {
    const db = userStore.loadUserDb(userId);
    const before = db.wishlist?.length || 0;
    db.wishlist = (db.wishlist || []).filter(w => !targets.includes((w.name || '').trim().toLowerCase()));
    const removed = before - db.wishlist.length;
    if (removed > 0) {
        db.nameRegistry = buildNameList(db);
        userStore.saveUserDb(userId, db);
        totalRemoved += removed;
        console.log(`Kullanıcı ${userId}: ${removed} kayıt silindi`);
    }
}

console.log(totalRemoved ? `Toplam ${totalRemoved} kayıt kaldırıldı.` : 'Eşleşen kayıt bulunamadı.');
