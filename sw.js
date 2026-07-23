/* Service worker — kilit ekranı sohbet bildirimleri */
self.addEventListener('push', event => {
    let data = { title: 'Yeni mesaj', body: 'Sohbette yeni bir mesaj var.', url: '/app.html#chat' };
    try {
        if (event.data) data = { ...data, ...event.data.json() };
    } catch { /* defaults */ }

    event.waitUntil(
        self.registration.showNotification(data.title || 'Sohbet', {
            body: data.body || '',
            icon: '/icons/icon-192.png',
            badge: '/icons/icon-192.png',
            tag: 'restoran-chat',
            renotify: true,
            data: { url: data.url || '/app.html#chat' }
        })
    );
});

self.addEventListener('notificationclick', event => {
    event.notification.close();
    const url = event.notification.data?.url || '/app.html#chat';
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
            for (const client of list) {
                if (client.url.includes('/app.html') && 'focus' in client) {
                    client.postMessage({ type: 'open-chat' });
                    return client.focus();
                }
            }
            if (clients.openWindow) return clients.openWindow(url);
        })
    );
});
