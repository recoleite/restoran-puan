const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

let sharp;
try {
    sharp = require('sharp');
} catch {
    sharp = null;
}

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const PHOTOS_DIR = path.join(DATA_DIR, 'photos');
const JWT_SECRET = process.env.JWT_SECRET || 'restoran-puan-dev-secret-change-me';

function isDataUrl(value) {
    return typeof value === 'string' && value.startsWith('data:');
}

function isPhotoUrl(value) {
    return typeof value === 'string' && value.startsWith('/photos/');
}

function ensureUserPhotoDir(userId) {
    const dir = path.join(PHOTOS_DIR, userId);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
}

function photoSig(userId, filename) {
    return crypto.createHmac('sha256', JWT_SECRET).update(`${userId}/${filename}`).digest('hex').slice(0, 20);
}

function photoUrl(userId, filename) {
    return `/photos/${userId}/${encodeURIComponent(filename)}?sig=${photoSig(userId, filename)}`;
}

function verifyPhotoAccess(userId, filename, sig) {
    return sig === photoSig(userId, filename);
}

function resolvePhotoPath(userId, filename) {
    const dir = path.join(PHOTOS_DIR, userId);
    const resolved = path.resolve(dir, filename);
    if (!resolved.startsWith(path.resolve(dir))) return null;
    return resolved;
}

function dataUrlToBuffer(dataUrl) {
    const match = dataUrl.match(/^data:[^;]+;base64,(.+)$/);
    if (!match) return null;
    return Buffer.from(match[1], 'base64');
}

async function writeJpeg(input, outputPath, maxSize, quality = 82) {
    if (!sharp) {
        if (Buffer.isBuffer(input)) fs.writeFileSync(outputPath, input);
        else fs.copyFileSync(input, outputPath);
        return;
    }
    await sharp(input)
        .rotate()
        .resize(maxSize, maxSize, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality, mozjpeg: true })
        .toFile(outputPath);
}

async function savePhotoFromDataUrl(userId, dataUrl) {
    if (!isDataUrl(dataUrl)) return dataUrl;
    const buf = dataUrlToBuffer(dataUrl);
    if (!buf) return dataUrl;

    const filename = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}.jpg`;
    const dir = ensureUserPhotoDir(userId);
    await writeJpeg(buf, path.join(dir, filename), 1024, 82);
    return photoUrl(userId, filename);
}

async function saveCoverForRestaurant(userId, restaurantId, source) {
    const filename = `cover-${restaurantId}.jpg`;
    const dir = ensureUserPhotoDir(userId);
    const outputPath = path.join(dir, filename);

    if (isDataUrl(source)) {
        const buf = dataUrlToBuffer(source);
        if (!buf) return null;
        await writeJpeg(buf, outputPath, 640, 78);
    } else if (isPhotoUrl(source)) {
        const parsed = parsePhotoUrl(source);
        if (!parsed || parsed.userId !== userId) return null;
        const inputPath = resolvePhotoPath(userId, parsed.filename);
        if (!inputPath || !fs.existsSync(inputPath)) return null;
        await writeJpeg(inputPath, outputPath, 640, 78);
    } else {
        return null;
    }

    return photoUrl(userId, filename);
}

function parsePhotoUrl(url) {
    try {
        const u = new URL(url, 'http://local');
        const match = u.pathname.match(/^\/photos\/([^/]+)\/(.+)$/);
        if (!match) return null;
        return { userId: match[1], filename: decodeURIComponent(match[2]) };
    } catch {
        return null;
    }
}

async function normalizePhotoList(userId, photos = []) {
    const saved = [];
    for (const photo of photos) {
        saved.push(await savePhotoFromDataUrl(userId, photo));
    }
    return saved;
}

async function applyPhotosToRestaurant(userId, restaurant, { photos = [], coverPhoto = null } = {}) {
    if (photos.length) {
        restaurant.visits = restaurant.visits || [];
        if (restaurant.visits[0]) {
            restaurant.visits[0].photos = await normalizePhotoList(userId, photos);
        }
    }

    if (coverPhoto) {
        restaurant.coverPhoto = await saveCoverForRestaurant(userId, restaurant.id, coverPhoto);
    } else if (photos.length) {
        const first = (restaurant.visits?.[0]?.photos || [])[0];
        if (first) restaurant.coverPhoto = await saveCoverForRestaurant(userId, restaurant.id, first);
    }

    restaurant.photos = [];
    return restaurant;
}

async function migrateRestaurantPhotos(userId, restaurant) {
    let changed = false;

    for (const visit of restaurant.visits || []) {
        if (!visit.photos?.length) continue;
        const next = [];
        for (const photo of visit.photos) {
            if (isDataUrl(photo)) {
                next.push(await savePhotoFromDataUrl(userId, photo));
                changed = true;
            } else {
                next.push(photo);
            }
        }
        visit.photos = next;
    }

    if (restaurant.photos?.length) {
        for (const photo of restaurant.photos) {
            if (isDataUrl(photo)) {
                await savePhotoFromDataUrl(userId, photo);
                changed = true;
            }
        }
        restaurant.photos = [];
        changed = true;
    }

    const firstPhoto = (restaurant.visits || []).flatMap(v => v.photos || [])[0] || null;

    if (isDataUrl(restaurant.coverPhoto)) {
        restaurant.coverPhoto = await saveCoverForRestaurant(userId, restaurant.id, restaurant.coverPhoto);
        changed = true;
    } else if (!restaurant.coverPhoto && firstPhoto) {
        restaurant.coverPhoto = await saveCoverForRestaurant(userId, restaurant.id, firstPhoto);
        if (restaurant.coverPhoto) changed = true;
    } else if (restaurant.coverPhoto && isDataUrl(restaurant.coverPhoto)) {
        restaurant.coverPhoto = await saveCoverForRestaurant(userId, restaurant.id, restaurant.coverPhoto);
        changed = true;
    }

    return changed;
}

async function migrateUserDbPhotos(userId, db) {
    let changed = false;
    for (const restaurant of db.restaurants || []) {
        if (await migrateRestaurantPhotos(userId, restaurant)) changed = true;
    }
    return changed;
}

function getListCoverPhoto(restaurant) {
    const cover = restaurant.coverPhoto;
    if (isPhotoUrl(cover)) return cover;
    if (isDataUrl(cover) && cover.length < 120000) return cover;
    const first = (restaurant.visits || []).flatMap(v => v.photos || [])[0];
    if (isPhotoUrl(first)) return first;
    return null;
}

module.exports = {
    PHOTOS_DIR,
    applyPhotosToRestaurant,
    getListCoverPhoto,
    isDataUrl,
    isPhotoUrl,
    migrateUserDbPhotos,
    normalizePhotoList,
    parsePhotoUrl,
    photoUrl,
    resolvePhotoPath,
    saveCoverForRestaurant,
    savePhotoFromDataUrl,
    verifyPhotoAccess
};
