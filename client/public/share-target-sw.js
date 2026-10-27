self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'POST' || url.origin !== self.location.origin || url.pathname !== '/share-target') return;
  event.respondWith((async () => {
    try {
      const form = await event.request.formData();
      const files = form.getAll('images').filter((value) => value instanceof File);
      if (files.length > 3 || files.some((file) => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024)) {
        throw new Error('INVALID_IMAGES');
      }
      const cacheName = 'prode-share-inbox-v1';
      await caches.delete(cacheName);
      const cache = await caches.open(cacheName);
      const meta = {
        title: String(form.get('title') || '').slice(0, 2048),
        text: String(form.get('text') || '').slice(0, 4096),
        url: String(form.get('url') || '').slice(0, 2048),
        files: files.map((file) => ({ name: file.name.slice(0, 160), type: file.type })),
        receivedAt: Date.now(),
      };
      await cache.put('/__prode_share__/meta', new Response(JSON.stringify(meta), { headers: { 'Content-Type': 'application/json' } }));
      for (let index = 0; index < files.length; index += 1) {
        await cache.put(`/__prode_share__/image/${index}`, new Response(files[index], { headers: { 'Content-Type': files[index].type } }));
      }
      return Response.redirect(new URL('/inicio?shared=1', self.location.origin), 303);
    } catch {
      return Response.redirect(new URL('/inicio?sharedError=1', self.location.origin), 303);
    }
  })());
});
