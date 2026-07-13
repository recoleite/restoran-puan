const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, 'data.json');

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(__dirname));

const DEFAULT_CATEGORIES = () => ({
    food: { my: 3, partner: 3 },
    service: { my: 3, partner: 3 },
    atmosphere: { my: 3, partner: 3 },
    price: { my: 3, partner: 3 }
});

let db = {
    restaurants: [],
    wishlist: [],
    nameRegistry: [],
    settings: { password: 'bizim123', authEnabled: true, coupleName1: '', coupleName2: '', theme: 'rose' }
};

if (fs.existsSync(DATA_FILE)) {
    try {
        db = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    } catch {
        db = { restaurants: [], wishlist: [], nameRegistry: [], settings: { password: 'bizim123', authEnabled: true, coupleName1: '', coupleName2: '', theme: 'rose' } };
    }
}

if (!db.restaurants) db.restaurants = [];
if (!db.wishlist) db.wishlist = [];
if (!db.nameRegistry) db.nameRegistry = [];
if (!db.settings) db.settings = { password: 'bizim123', authEnabled: true, coupleName1: '', coupleName2: '' };
if (db.settings.coupleName1 === undefined) db.settings.coupleName1 = '';
if (db.settings.coupleName2 === undefined) db.settings.coupleName2 = '';
if (!db.settings.theme) db.settings.theme = 'rose';

function saveToDisk() {
    fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
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

db.restaurants = db.restaurants.map(migrateRestaurant);
saveToDisk();

const clampRating = (val) => Math.min(5, Math.max(1, Math.round(Number(val) || 1)));

const findRestaurant = (id) => db.restaurants.findIndex(r => r.id === id);

const upsertNameRegistry = (name, cuisine = '', location = '') => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const existing = db.nameRegistry.findIndex(n => n.name.toLowerCase() === trimmed.toLowerCase());
    if (existing !== -1) {
        db.nameRegistry[existing] = {
            name: trimmed,
            cuisine: cuisine.trim() || db.nameRegistry[existing].cuisine,
            location: location.trim() || db.nameRegistry[existing].location
        };
    } else {
        db.nameRegistry.push({ name: trimmed, cuisine: cuisine.trim(), location: location.trim() });
    }
    db.nameRegistry.sort((a, b) => a.name.localeCompare(b.name, 'tr'));
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
app.get('/auth/status', (req, res) => {
    res.json({ authEnabled: db.settings.authEnabled !== false });
});

app.get('/health', (req, res) => {
    res.json({ ok: true });
});

app.post('/auth/login', (req, res) => {
    const { password } = req.body;
    if (!db.settings.authEnabled) return res.json({ success: true });
    if (password === db.settings.password) return res.json({ success: true });
    res.status(401).json({ error: 'Yanlış şifre' });
});

app.patch('/auth/password', (req, res) => {
    const { password, newPassword } = req.body;
    if (db.settings.authEnabled && password !== db.settings.password) {
        return res.status(401).json({ error: 'Mevcut şifre yanlış' });
    }
    if (newPassword?.trim()) {
        db.settings.password = newPassword.trim();
        saveToDisk();
    }
    res.json({ success: true });
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
    const allVisits = db.restaurants.flatMap(r =>
        (r.visits || []).map(v => ({ ...v, restaurantName: r.name, restaurantId: r.id }))
    );
    const monthVisits = allVisits.filter(v => v.date?.startsWith(thisMonth)).length;

    let topRestaurant = null;
    let topRated = null;
    if (db.restaurants.length) {
        topRestaurant = [...db.restaurants].sort((a, b) => b.visitCount - a.visitCount)[0];
        topRated = [...db.restaurants].sort((a, b) => {
            const avgA = (a.myRating + a.partnerRating) / 2;
            const avgB = (b.myRating + b.partnerRating) / 2;
            return avgB - avgA;
        })[0];
    }

    const cuisineCounts = {};
    db.restaurants.forEach(r => {
        const c = r.cuisine?.trim();
        if (c) cuisineCounts[c] = (cuisineCounts[c] || 0) + 1;
    });
    const topCuisine = Object.entries(cuisineCounts).sort((a, b) => b[1] - a[1])[0];
    const avgRating = db.restaurants.length
        ? (db.restaurants.reduce((s, r) => s + (r.myRating + r.partnerRating) / 2, 0) / db.restaurants.length).toFixed(1)
        : null;

    res.json({
        restaurantCount: db.restaurants.length,
        visitCount: db.restaurants.reduce((s, r) => s + (r.visitCount || 0), 0),
        favoriteCount: db.restaurants.filter(r => r.favorite).length,
        wishlistCount: db.wishlist.length,
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
        coupleName1: db.settings.coupleName1 || '',
        coupleName2: db.settings.coupleName2 || '',
        theme: db.settings.theme || 'rose'
    });
});

app.patch('/settings', (req, res) => {
    const { coupleName1, coupleName2, theme } = req.body;
    if (coupleName1 !== undefined) db.settings.coupleName1 = String(coupleName1).trim();
    if (coupleName2 !== undefined) db.settings.coupleName2 = String(coupleName2).trim();
    if (theme !== undefined && ['rose', 'dark', 'cream', 'lavender'].includes(theme)) {
        db.settings.theme = theme;
    }
    saveToDisk();
    res.json({
        coupleName1: db.settings.coupleName1,
        coupleName2: db.settings.coupleName2,
        theme: db.settings.theme
    });
});

// --- YEDEKLEME ---
app.get('/backup/export', (req, res) => {
    res.json({
        exportedAt: new Date().toISOString(),
        version: 1,
        restaurants: db.restaurants,
        wishlist: db.wishlist,
        nameRegistry: db.nameRegistry,
        settings: db.settings
    });
});

app.post('/backup/import', (req, res) => {
    const data = req.body;
    if (!data || !Array.isArray(data.restaurants)) {
        return res.status(400).json({ error: 'Geçersiz yedek dosyası' });
    }

    const keepPassword = db.settings.password;
    const keepAuth = db.settings.authEnabled;

    db.restaurants = data.restaurants.map(migrateRestaurant);
    db.wishlist = Array.isArray(data.wishlist) ? data.wishlist : [];
    db.nameRegistry = Array.isArray(data.nameRegistry) ? data.nameRegistry : [];

    if (data.settings && typeof data.settings === 'object') {
        db.settings = {
            password: data.settings.password || keepPassword,
            authEnabled: data.settings.authEnabled ?? keepAuth,
            coupleName1: data.settings.coupleName1 ?? '',
            coupleName2: data.settings.coupleName2 ?? '',
            theme: ['rose', 'dark', 'cream', 'lavender'].includes(data.settings.theme) ? data.settings.theme : 'rose'
        };
    }

    saveToDisk();
    res.json({
        success: true,
        restaurantCount: db.restaurants.length,
        visitCount: db.restaurants.reduce((s, r) => s + (r.visitCount || 0), 0)
    });
});

// --- İSTEK LİSTESİ ---
app.get('/wishlist', (req, res) => {
    res.json([...db.wishlist].sort((a, b) => (b.addedAt || '').localeCompare(a.addedAt || '')));
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
    db.wishlist.unshift(item);
    upsertNameRegistry(item.name, item.cuisine, item.location);
    saveToDisk();
    res.status(201).json(item);
});

app.patch('/wishlist/:id', (req, res) => {
    const index = db.wishlist.findIndex(w => w.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Kayıt bulunamadı' });
    const fields = req.body;
    db.wishlist[index] = {
        ...db.wishlist[index],
        ...(fields.name !== undefined && { name: fields.name.trim() }),
        ...(fields.cuisine !== undefined && { cuisine: fields.cuisine.trim() }),
        ...(fields.location !== undefined && { location: fields.location.trim() }),
        ...(fields.notes !== undefined && { notes: fields.notes.trim() }),
        ...(fields.lat !== undefined && { lat: fields.lat }),
        ...(fields.lng !== undefined && { lng: fields.lng })
    };
    saveToDisk();
    res.json(db.wishlist[index]);
});

app.delete('/wishlist/:id', (req, res) => {
    const index = db.wishlist.findIndex(w => w.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Kayıt bulunamadı' });
    db.wishlist.splice(index, 1);
    saveToDisk();
    res.json({ success: true });
});

app.post('/wishlist/:id/visit', (req, res) => {
    const index = db.wishlist.findIndex(w => w.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Kayıt bulunamadı' });
    const w = db.wishlist[index];
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
    db.restaurants.unshift(newRestaurant);
    db.wishlist.splice(index, 1);
    saveToDisk();
    res.status(201).json(newRestaurant);
});

// --- ZAMAN ÇİZELGESİ ---
app.get('/timeline', (req, res) => {
    const events = db.restaurants.flatMap(r =>
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
    let names = db.nameRegistry;
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
    let list = [...db.restaurants];
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
    const restaurant = db.restaurants.find(r => r.id === req.params.id);
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

    db.restaurants.unshift(newRestaurant);
    upsertNameRegistry(newRestaurant.name, newRestaurant.cuisine, newRestaurant.location);
    saveToDisk();
    res.status(201).json(newRestaurant);
});

app.patch('/restaurants/:id', (req, res) => {
    const index = findRestaurant(req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Restoran bulunamadı' });

    const current = db.restaurants[index];
    const fields = req.body;

    db.restaurants[index] = {
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

    syncRestaurantFromVisits(db.restaurants[index]);
    const updated = db.restaurants[index];
    upsertNameRegistry(updated.name, updated.cuisine, updated.location);
    saveToDisk();
    res.json(updated);
});

app.post('/restaurants/:id/favorite', (req, res) => {
    const index = findRestaurant(req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Restoran bulunamadı' });
    db.restaurants[index].favorite = !db.restaurants[index].favorite;
    db.restaurants[index].updatedAt = new Date().toISOString();
    saveToDisk();
    res.json(db.restaurants[index]);
});

// Ziyaret ekle (detaylı)
app.post('/restaurants/:id/visits', (req, res) => {
    const index = findRestaurant(req.params.id);
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

    db.restaurants[index].visits = db.restaurants[index].visits || [];
    db.restaurants[index].visits.unshift(visit);
    syncRestaurantFromVisits(db.restaurants[index]);
    db.restaurants[index].updatedAt = new Date().toISOString();
    saveToDisk();
    res.json(db.restaurants[index]);
});

app.patch('/restaurants/:id/visits/:visitId', (req, res) => {
    const index = findRestaurant(req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Restoran bulunamadı' });

    const visits = db.restaurants[index].visits || [];
    const vIndex = visits.findIndex(v => v.id === req.params.visitId);
    if (vIndex === -1) return res.status(404).json({ error: 'Ziyaret bulunamadı' });

    visits[vIndex] = { ...visits[vIndex], ...req.body };
    syncRestaurantFromVisits(db.restaurants[index]);
    saveToDisk();
    res.json(db.restaurants[index]);
});

app.delete('/restaurants/:id/visits/:visitId', (req, res) => {
    const index = findRestaurant(req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Restoran bulunamadı' });

    db.restaurants[index].visits = (db.restaurants[index].visits || []).filter(v => v.id !== req.params.visitId);
    if (db.restaurants[index].visits.length === 0) {
        return res.status(400).json({ error: 'Son ziyaret silinemez' });
    }
    syncRestaurantFromVisits(db.restaurants[index]);
    saveToDisk();
    res.json(db.restaurants[index]);
});

// Hızlı +1 (eski uyumluluk)
app.post('/restaurants/:id/visit', (req, res) => {
    const index = findRestaurant(req.params.id);
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

    db.restaurants[index].visits = db.restaurants[index].visits || [];
    db.restaurants[index].visits.unshift(visit);
    syncRestaurantFromVisits(db.restaurants[index]);
    saveToDisk();
    res.json(db.restaurants[index]);
});

app.delete('/restaurants/:id', (req, res) => {
    const index = findRestaurant(req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Restoran bulunamadı' });
    db.restaurants.splice(index, 1);
    saveToDisk();
    res.json({ success: true });
});

app.listen(PORT, () => {
    console.log(`Restoran Puanlama sunucusu http://localhost:${PORT} adresinde çalışıyor`);
});
