const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const userStore = require('./userStore');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(__dirname));

const DEFAULT_CATEGORIES = () => ({
    food: { my: 3, partner: 3 },
    service: { my: 3, partner: 3 },
    atmosphere: { my: 3, partner: 3 },
    price: { my: 3, partner: 3 }
});

function persist(req) {
    userStore.saveUserDb(req.userId, req.db);
}

const migrateRestaurant = (r) => {
    const visit = {
        id: `${r.id}-v1`,
        date: r.lastVisited || new Date().toISOString().split('T')[0],
        notes: r.notes || '',
        photos: r.photos || [],
        dishes: [],
        budget: 0,
        tags: []
    };

    const visits = r.visits?.length ? r.visits : [visit];
    return {
        ...r,
        favorite: r.favorite ?? false,
        lat: r.lat ?? null,
        lng: r.lng ?? null,
        categories: r.categories ?? DEFAULT_CATEGORIES(),
        visits,
        visitCount: visits.length,
        photos: visits.flatMap(v => v.photos || []).length ? visits.flatMap(v => v.photos || []) : (r.photos ?? [])
    };
};

const clampRating = (val) => Math.min(5, Math.max(1, Math.round(Number(val) || 1)));

const findRestaurant = (userDb, id) => userDb.restaurants.findIndex(r => r.id === id);

const upsertNameRegistry = (userDb, name, cuisine = '', location = '') => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const existing = userDb.nameRegistry.findIndex(n => n.name.toLowerCase() === trimmed.toLowerCase());
    if (existing !== -1) {
        userDb.nameRegistry[existing] = {
            name: trimmed,
            cuisine: cuisine.trim() || userDb.nameRegistry[existing].cuisine,
            location: location.trim() || userDb.nameRegistry[existing].location
        };
    } else {
        userDb.nameRegistry.push({ name: trimmed, cuisine: cuisine.trim(), location: location.trim() });
    }
    userDb.nameRegistry.sort((a, b) => a.name.localeCompare(b.name, 'tr'));
};

const syncRestaurantFromVisits = (restaurant) => {
    if (!restaurant.visits?.length) return restaurant;
    const sorted = [...restaurant.visits].sort((a, b) => b.date.localeCompare(a.date));
    restaurant.visitCount = restaurant.visits.length;
    restaurant.lastVisited = sorted[0].date;
    const allPhotos = restaurant.visits.flatMap(v => v.photos || []);
    restaurant.photos = allPhotos.length ? allPhotos : restaurant.photos || [];
    restaurant.notes = sorted[0].notes || restaurant.notes || '';
    return restaurant;
};

const parseCategories = (categories) => {
    if (!categories || typeof categories !== 'object') return DEFAULT_CATEGORIES();
    const result = DEFAULT_CATEGORIES();
    for (const key of Object.keys(result)) {
        if (categories[key]) {
            result[key] = {
                my: clampRating(categories[key].my),
                partner: clampRating(categories[key].partner)
            };
        }
    }
    return result;
};

const sortRestaurants = (list, sortBy = 'rating') => {
    const sorted = [...list];
    switch (sortBy) {
        case 'visits':
            return sorted.sort((a, b) => b.visitCount - a.visitCount);
        case 'date':
            return sorted.sort((a, b) => (b.lastVisited || '').localeCompare(a.lastVisited || ''));
        case 'name':
            return sorted.sort((a, b) => a.name.localeCompare(b.name, 'tr'));
        default:
            return sorted.sort((a, b) => {
                const avgA = (a.myRating + a.partnerRating) / 2;
                const avgB = (b.myRating + b.partnerRating) / 2;
                return avgB - avgA;
            });
    }
};

// --- AUTH ---
userStore.migrateLegacyDataIfNeeded(migrateRestaurant);

function attachUserDb(req) {
    req.db = userStore.loadUserDb(req.userId);
    req.db.restaurants = (req.db.restaurants || []).map(migrateRestaurant);
}

function requireAuth(req, res, next) {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    const payload = userStore.verifyToken(token);
    if (!payload) return res.status(401).json({ error: 'Giriş gerekli' });
    req.userId = payload.userId;
    attachUserDb(req);
    next();
}

app.get('/auth/status', (req, res) => {
    res.json({
        multiUser: true,
        inviteRequired: !!userStore.INVITE_CODE
    });
});

app.get('/health', (req, res) => {
    res.json({ ok: true });
});

app.post('/auth/register', (req, res) => {
    try {
        const { email, password, displayName, coupleName1, coupleName2, inviteCode } = req.body;
        if (!userStore.checkInviteCode(inviteCode || '')) {
            return res.status(403).json({ error: 'Geçersiz davet kodu' });
        }
        const user = userStore.createUser({ email, password, displayName, coupleName1, coupleName2 });
        const token = userStore.signToken(user.id);
        const db = userStore.loadUserDb(user.id);
        res.status(201).json({
            token,
            user: userStore.sanitizeUser(user),
            settings: db.settings
        });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.post('/auth/login', (req, res) => {
    const { email, password } = req.body;
    const user = userStore.findUserByEmail(email || '');
    if (!user || !userStore.verifyPassword(password || '', user.salt, user.passwordHash)) {
        return res.status(401).json({ error: 'E-posta veya şifre yanlış' });
    }
    const token = userStore.signToken(user.id);
    const db = userStore.loadUserDb(user.id);
    res.json({
        token,
        user: userStore.sanitizeUser(user),
        settings: db.settings
    });
});

app.get('/auth/me', requireAuth, (req, res) => {
    const user = userStore.findUserById(req.userId);
    if (!user) return res.status(401).json({ error: 'Kullanıcı bulunamadı' });
    res.json({
        user: userStore.sanitizeUser(user),
        settings: req.db.settings
    });
});

app.patch('/auth/password', requireAuth, (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const user = userStore.findUserById(req.userId);
    if (!user || !userStore.verifyPassword(currentPassword || '', user.salt, user.passwordHash)) {
        return res.status(401).json({ error: 'Mevcut şifre yanlış' });
    }
    if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ error: 'Yeni şifre en az 6 karakter olmalı' });
    }
    userStore.updateUserPassword(req.userId, newPassword);
    res.json({ success: true });
});

const protectedPaths = ['/stats', '/settings', '/backup', '/wishlist', '/timeline', '/names', '/restaurants', '/geocode'];
app.use((req, res, next) => {
    if (!protectedPaths.some(p => req.path === p || req.path.startsWith(`${p}/`))) return next();
    return requireAuth(req, res, next);
});

// --- GEOCODE ---
function parseCoordsFromText(text) {
    const trimmed = text.trim();

    const direct = trimmed.match(/^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/);
    if (direct) {
        const lat = parseFloat(direct[1]);
        const lng = parseFloat(direct[2]);
        if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
            return { lat, lng, display: `${lat}, ${lng}` };
        }
    }

    if (/google\.com\/maps|maps\.google|goo\.gl\/maps|maps\.app\.goo\.gl/i.test(trimmed)) {
        const precise = trimmed.match(/!3d(-?\d+\.?\d+)!4d(-?\d+\.?\d+)/);
        if (precise) {
            return { lat: parseFloat(precise[1]), lng: parseFloat(precise[2]), display: 'Google Maps' };
        }
        const at = trimmed.match(/@(-?\d+\.?\d+),(-?\d+\.?\d+)/);
        if (at) {
            return { lat: parseFloat(at[1]), lng: parseFloat(at[2]), display: 'Google Maps' };
        }
        const qParam = trimmed.match(/[?&]q=(-?\d+\.?\d+),(-?\d+\.?\d+)/);
        if (qParam) {
            return { lat: parseFloat(qParam[1]), lng: parseFloat(qParam[2]), display: 'Google Maps' };
        }
        return { needsResolve: true, url: trimmed };
    }

    return null;
}

async function resolveGoogleShortUrl(url) {
    const response = await fetch(url, {
        redirect: 'follow',
        headers: { 'User-Agent': 'RestoranPuan/1.0 (personal app)' }
    });
    return response.url;
}

async function nominatimSearch(query) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=3&countrycodes=tr`;
    const response = await fetch(url, {
        headers: { 'User-Agent': 'RestoranPuan/1.0 (personal couple app)' }
    });
    if (!response.ok) throw new Error(`Nominatim ${response.status}`);
    return response.json();
}

app.get('/geocode', async (req, res) => {
    const q = (req.query.q || '').trim();
    const name = (req.query.name || '').trim();
    if (!q) return res.status(400).json({ error: 'Konum gerekli' });

    try {
        let parsed = parseCoordsFromText(q);
        if (parsed?.needsResolve) {
            const resolved = await resolveGoogleShortUrl(parsed.url);
            parsed = parseCoordsFromText(resolved);
        }
        if (parsed?.lat != null && parsed?.lng != null) {
            return res.json({ lat: parsed.lat, lng: parsed.lng, display: parsed.display || q });
        }

        const queries = [];
        if (name) {
            queries.push(`${name}, ${q}, Türkiye`);
            queries.push(`${name} ${q}, Türkiye`);
        }
        queries.push(`${q}, Türkiye`, q);

        const seen = new Set();
        for (const query of queries) {
            if (seen.has(query)) continue;
            seen.add(query);
            const data = await nominatimSearch(query);
            if (data[0]) {
                return res.json({
                    lat: parseFloat(data[0].lat),
                    lng: parseFloat(data[0].lon),
                    display: data[0].display_name
                });
            }
        }

        res.status(404).json({ error: 'Konum bulunamadı — Google Maps linki yapıştırmayı deneyin' });
    } catch (err) {
        console.error('Geocode error:', err.message);
        res.status(500).json({ error: 'Konum aranırken hata oluştu' });
    }
});

// --- İSTATİSTİK ---
app.get('/stats', (req, res) => {
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const allVisits = req.db.restaurants.flatMap(r =>
        (r.visits || []).map(v => ({ ...v, restaurantName: r.name, restaurantId: r.id }))
    );
    const monthVisits = allVisits.filter(v => v.date?.startsWith(thisMonth)).length;

    let topRestaurant = null;
    let topRated = null;
    if (req.db.restaurants.length) {
        topRestaurant = [...req.db.restaurants].sort((a, b) => b.visitCount - a.visitCount)[0];
        topRated = [...req.db.restaurants].sort((a, b) => {
            const avgA = (a.myRating + a.partnerRating) / 2;
            const avgB = (b.myRating + b.partnerRating) / 2;
            return avgB - avgA;
        })[0];
    }

    const cuisineCounts = {};
    req.db.restaurants.forEach(r => {
        const c = r.cuisine?.trim();
        if (c) cuisineCounts[c] = (cuisineCounts[c] || 0) + 1;
    });
    const topCuisine = Object.entries(cuisineCounts).sort((a, b) => b[1] - a[1])[0];
    const avgRating = req.db.restaurants.length
        ? (req.db.restaurants.reduce((s, r) => s + (r.myRating + r.partnerRating) / 2, 0) / req.db.restaurants.length).toFixed(1)
        : null;

    res.json({
        restaurantCount: req.db.restaurants.length,
        visitCount: req.db.restaurants.reduce((s, r) => s + (r.visitCount || 0), 0),
        favoriteCount: req.db.restaurants.filter(r => r.favorite).length,
        wishlistCount: req.db.wishlist.length,
        monthVisits,
        avgRating,
        topRestaurant: topRestaurant ? { name: topRestaurant.name, visits: topRestaurant.visitCount } : null,
        topRated: topRated ? { name: topRated.name, rating: ((topRated.myRating + topRated.partnerRating) / 2).toFixed(1) } : null,
        topCuisine: topCuisine ? { name: topCuisine[0], count: topCuisine[1] } : null
    });
});

// --- AYARLAR ---
app.get('/settings', (req, res) => {
    res.json({
        coupleName1: req.db.settings.coupleName1 || '',
        coupleName2: req.db.settings.coupleName2 || '',
        theme: req.db.settings.theme || 'rose'
    });
});

app.patch('/settings', (req, res) => {
    const { coupleName1, coupleName2, theme } = req.body;
    if (coupleName1 !== undefined) req.db.settings.coupleName1 = String(coupleName1).trim();
    if (coupleName2 !== undefined) req.db.settings.coupleName2 = String(coupleName2).trim();
    if (theme !== undefined && ['rose', 'dark', 'cream', 'lavender'].includes(theme)) {
        req.db.settings.theme = theme;
    }
    persist(req);
    res.json({
        coupleName1: req.db.settings.coupleName1,
        coupleName2: req.db.settings.coupleName2,
        theme: req.db.settings.theme
    });
});

// --- YEDEKLEME ---
app.get('/backup/export', (req, res) => {
    res.json({
        exportedAt: new Date().toISOString(),
        version: 1,
        restaurants: req.db.restaurants,
        wishlist: req.db.wishlist,
        nameRegistry: req.db.nameRegistry,
        settings: req.db.settings
    });
});

app.post('/backup/import', (req, res) => {
    const data = req.body;
    if (!data || !Array.isArray(data.restaurants)) {
        return res.status(400).json({ error: 'Geçersiz yedek dosyası' });
    }

    req.db.restaurants = data.restaurants.map(migrateRestaurant);
    req.db.wishlist = Array.isArray(data.wishlist) ? data.wishlist : [];
    req.db.nameRegistry = Array.isArray(data.nameRegistry) ? data.nameRegistry : [];

    if (data.settings && typeof data.settings === 'object') {
        req.db.settings = {
            coupleName1: data.settings.coupleName1 ?? req.db.settings.coupleName1 ?? '',
            coupleName2: data.settings.coupleName2 ?? req.db.settings.coupleName2 ?? '',
            theme: ['rose', 'dark', 'cream', 'lavender'].includes(data.settings.theme) ? data.settings.theme : (req.db.settings.theme || 'rose')
        };
    }

    persist(req);
    res.json({
        success: true,
        restaurantCount: req.db.restaurants.length,
        visitCount: req.db.restaurants.reduce((s, r) => s + (r.visitCount || 0), 0)
    });
});

// --- İSTEK LİSTESİ ---
app.get('/wishlist', (req, res) => {
    res.json([...req.db.wishlist].sort((a, b) => (b.addedAt || '').localeCompare(a.addedAt || '')));
});

app.post('/wishlist', (req, res) => {
    const { name, cuisine, location, notes, lat, lng } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Restoran adı zorunludur' });
    const item = {
        id: Date.now().toString(),
        name: name.trim(),
        cuisine: cuisine?.trim() || '',
        location: location?.trim() || '',
        notes: notes?.trim() || '',
        lat: lat ?? null,
        lng: lng ?? null,
        addedAt: new Date().toISOString()
    };
    req.db.wishlist.unshift(item);
    upsertNameRegistry(req.db, item.name, item.cuisine, item.location);
    persist(req);
    res.status(201).json(item);
});

app.patch('/wishlist/:id', (req, res) => {
    const index = req.db.wishlist.findIndex(w => w.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Kayıt bulunamadı' });
    const fields = req.body;
    req.db.wishlist[index] = {
        ...req.db.wishlist[index],
        ...(fields.name !== undefined && { name: fields.name.trim() }),
        ...(fields.cuisine !== undefined && { cuisine: fields.cuisine.trim() }),
        ...(fields.location !== undefined && { location: fields.location.trim() }),
        ...(fields.notes !== undefined && { notes: fields.notes.trim() }),
        ...(fields.lat !== undefined && { lat: fields.lat }),
        ...(fields.lng !== undefined && { lng: fields.lng })
    };
    persist(req);
    res.json(req.db.wishlist[index]);
});

app.delete('/wishlist/:id', (req, res) => {
    const index = req.db.wishlist.findIndex(w => w.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Kayıt bulunamadı' });
    req.db.wishlist.splice(index, 1);
    persist(req);
    res.json({ success: true });
});

app.post('/wishlist/:id/visit', (req, res) => {
    const index = req.db.wishlist.findIndex(w => w.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Kayıt bulunamadı' });
    const w = req.db.wishlist[index];
    const now = new Date().toISOString();
    const id = Date.now().toString();
    const newRestaurant = {
        id,
        name: w.name,
        cuisine: w.cuisine,
        location: w.location,
        lat: w.lat,
        lng: w.lng,
        myRating: 3,
        partnerRating: 3,
        categories: DEFAULT_CATEGORIES(),
        favorite: false,
        visitCount: 1,
        notes: w.notes || '',
        photos: [],
        visits: [{
            id: `${id}-v1`,
            date: now.split('T')[0],
            notes: w.notes || '',
            photos: [],
            dishes: [],
            budget: 0,
            tags: []
        }],
        lastVisited: now.split('T')[0],
        createdAt: now,
        updatedAt: now
    };
    req.db.restaurants.unshift(newRestaurant);
    req.db.wishlist.splice(index, 1);
    persist(req);
    res.status(201).json(newRestaurant);
});

// --- ZAMAN ÇİZELGESİ ---
app.get('/timeline', (req, res) => {
    const events = req.db.restaurants.flatMap(r =>
        (r.visits || []).map(v => ({
            id: v.id,
            date: v.date,
            restaurantId: r.id,
            restaurantName: r.name,
            cuisine: r.cuisine,
            location: r.location,
            notes: v.notes,
            photos: v.photos || [],
            dishes: v.dishes || [],
            tags: v.tags || [],
            isSpecial: (v.tags || []).some(t => ['İlk buluşma', 'Doğum günü', 'Yıldönümü', 'Özel gün', 'Kutlama'].includes(t))
        }))
    );
    events.sort((a, b) => b.date.localeCompare(a.date));
    res.json(events);
});

// --- İSİM KAYITLARI ---
app.get('/names', (req, res) => {
    const search = (req.query.search || '').trim().toLowerCase();
    let names = req.db.nameRegistry;
    if (search) {
        names = names.filter(n =>
            n.name.toLowerCase().includes(search) ||
            n.cuisine.toLowerCase().includes(search) ||
            n.location.toLowerCase().includes(search)
        );
    }
    res.json(names);
});

// --- RESTORANLAR ---
app.get('/restaurants', (req, res) => {
    let list = [...req.db.restaurants];
    const { search, sort, favorite, cuisine } = req.query;

    if (search) {
        const q = search.toLowerCase();
        list = list.filter(r =>
            r.name.toLowerCase().includes(q) ||
            r.cuisine.toLowerCase().includes(q) ||
            r.location.toLowerCase().includes(q)
        );
    }
    if (favorite === 'true') list = list.filter(r => r.favorite);
    if (cuisine) list = list.filter(r => r.cuisine.toLowerCase().includes(cuisine.toLowerCase()));

    res.json(sortRestaurants(list, sort));
});

app.get('/restaurants/:id', (req, res) => {
    const restaurant = req.db.restaurants.find(r => r.id === req.params.id);
    if (!restaurant) return res.status(404).json({ error: 'Restoran bulunamadı' });
    res.json(restaurant);
});

app.post('/restaurants', (req, res) => {
    const {
        name, cuisine, location, myRating, partnerRating, notes, lastVisited,
        photos, favorite, lat, lng, categories, dishes, budget, tags
    } = req.body;

    if (!name?.trim()) return res.status(400).json({ error: 'Restoran adı zorunludur' });

    const now = new Date().toISOString();
    const date = lastVisited || now.split('T')[0];
    const visitId = Date.now().toString();

    const newRestaurant = {
        id: visitId,
        name: name.trim(),
        cuisine: cuisine?.trim() || '',
        location: location?.trim() || '',
        lat: lat ?? null,
        lng: lng ?? null,
        myRating: clampRating(myRating ?? 3),
        partnerRating: clampRating(partnerRating ?? 3),
        categories: parseCategories(categories),
        favorite: !!favorite,
        visitCount: 1,
        notes: notes?.trim() || '',
        photos: Array.isArray(photos) ? photos : [],
        visits: [{
            id: `${visitId}-v1`,
            date,
            notes: notes?.trim() || '',
            photos: Array.isArray(photos) ? photos : [],
            dishes: Array.isArray(dishes) ? dishes : [],
            budget: Number(budget) || 0,
            tags: Array.isArray(tags) ? tags : []
        }],
        lastVisited: date,
        createdAt: now,
        updatedAt: now
    };

    req.db.restaurants.unshift(newRestaurant);
    upsertNameRegistry(req.db, newRestaurant.name, newRestaurant.cuisine, newRestaurant.location);
    persist(req);
    res.status(201).json(newRestaurant);
});

app.patch('/restaurants/:id', (req, res) => {
    const index = findRestaurant(req.db, req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Restoran bulunamadı' });

    const current = req.db.restaurants[index];
    const fields = req.body;

    req.db.restaurants[index] = {
        ...current,
        ...(fields.name !== undefined && { name: fields.name.trim() }),
        ...(fields.cuisine !== undefined && { cuisine: fields.cuisine.trim() }),
        ...(fields.location !== undefined && { location: fields.location.trim() }),
        ...(fields.lat !== undefined && { lat: fields.lat }),
        ...(fields.lng !== undefined && { lng: fields.lng }),
        ...(fields.myRating !== undefined && { myRating: clampRating(fields.myRating) }),
        ...(fields.partnerRating !== undefined && { partnerRating: clampRating(fields.partnerRating) }),
        ...(fields.categories !== undefined && { categories: parseCategories(fields.categories) }),
        ...(fields.favorite !== undefined && { favorite: !!fields.favorite }),
        ...(fields.notes !== undefined && { notes: fields.notes.trim() }),
        ...(fields.photos !== undefined && { photos: Array.isArray(fields.photos) ? fields.photos : current.photos }),
        ...(fields.visitCount !== undefined && { visitCount: Math.max(0, Number(fields.visitCount) || 0) }),
        ...(fields.lastVisited !== undefined && { lastVisited: fields.lastVisited }),
        ...(fields.visits !== undefined && { visits: fields.visits }),
        updatedAt: new Date().toISOString()
    };

    syncRestaurantFromVisits(req.db.restaurants[index]);
    const updated = req.db.restaurants[index];
    upsertNameRegistry(req.db, updated.name, updated.cuisine, updated.location);
    persist(req);
    res.json(updated);
});

app.post('/restaurants/:id/favorite', (req, res) => {
    const index = findRestaurant(req.db, req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Restoran bulunamadı' });
    req.db.restaurants[index].favorite = !req.db.restaurants[index].favorite;
    req.db.restaurants[index].updatedAt = new Date().toISOString();
    persist(req);
    res.json(req.db.restaurants[index]);
});

// Ziyaret ekle (detaylı)
app.post('/restaurants/:id/visits', (req, res) => {
    const index = findRestaurant(req.db, req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Restoran bulunamadı' });

    const { date, notes, photos, dishes, budget, tags } = req.body;
    const visit = {
        id: Date.now().toString(),
        date: date || new Date().toISOString().split('T')[0],
        notes: notes?.trim() || '',
        photos: Array.isArray(photos) ? photos : [],
        dishes: Array.isArray(dishes) ? dishes : [],
        budget: Number(budget) || 0,
        tags: Array.isArray(tags) ? tags : []
    };

    req.db.restaurants[index].visits = req.db.restaurants[index].visits || [];
    req.db.restaurants[index].visits.unshift(visit);
    syncRestaurantFromVisits(req.db.restaurants[index]);
    req.db.restaurants[index].updatedAt = new Date().toISOString();
    persist(req);
    res.json(req.db.restaurants[index]);
});

app.patch('/restaurants/:id/visits/:visitId', (req, res) => {
    const index = findRestaurant(req.db, req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Restoran bulunamadı' });

    const visits = req.db.restaurants[index].visits || [];
    const vIndex = visits.findIndex(v => v.id === req.params.visitId);
    if (vIndex === -1) return res.status(404).json({ error: 'Ziyaret bulunamadı' });

    visits[vIndex] = { ...visits[vIndex], ...req.body };
    syncRestaurantFromVisits(req.db.restaurants[index]);
    persist(req);
    res.json(req.db.restaurants[index]);
});

app.delete('/restaurants/:id/visits/:visitId', (req, res) => {
    const index = findRestaurant(req.db, req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Restoran bulunamadı' });

    req.db.restaurants[index].visits = (req.db.restaurants[index].visits || []).filter(v => v.id !== req.params.visitId);
    if (req.db.restaurants[index].visits.length === 0) {
        return res.status(400).json({ error: 'Son ziyaret silinemez' });
    }
    syncRestaurantFromVisits(req.db.restaurants[index]);
    persist(req);
    res.json(req.db.restaurants[index]);
});

// Hızlı +1 (eski uyumluluk)
app.post('/restaurants/:id/visit', (req, res) => {
    const index = findRestaurant(req.db, req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Restoran bulunamadı' });

    const today = new Date().toISOString().split('T')[0];
    const visit = {
        id: Date.now().toString(),
        date: today,
        notes: '',
        photos: [],
        dishes: [],
        budget: 0,
        tags: []
    };

    req.db.restaurants[index].visits = req.db.restaurants[index].visits || [];
    req.db.restaurants[index].visits.unshift(visit);
    syncRestaurantFromVisits(req.db.restaurants[index]);
    persist(req);
    res.json(req.db.restaurants[index]);
});

app.delete('/restaurants/:id', (req, res) => {
    const index = findRestaurant(req.db, req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Restoran bulunamadı' });
    req.db.restaurants.splice(index, 1);
    persist(req);
    res.json({ success: true });
});

app.listen(PORT, () => {
    console.log(`Restoran Puanlama sunucusu http://localhost:${PORT} adresinde çalışıyor`);
});
