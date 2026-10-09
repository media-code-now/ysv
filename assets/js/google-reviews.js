/*
 * Google reviews widget: loads live rating + reviews via the Maps JavaScript API (Places library).
 * Setup: put a browser API key (Maps JavaScript API + Places API (New) enabled, restricted to
 * ysvhairsalon.com/*) in data-api-key on the [data-google-reviews] element. data-place-id is optional;
 * without it the widget looks the salon up by data-query.
 * With no key, or on any error, the static fallback markup inside the element stays as is.
 */
(() => {
  const root = document.querySelector('[data-google-reviews]');
  if (!root) return;
  const { apiKey, placeId, query, profileUrl } = root.dataset;
  if (!apiKey || apiKey.startsWith('YOUR_')) return;

  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  const stars = (rating) => {
    const s = el('span', 'stars');
    s.setAttribute('role', 'img');
    s.setAttribute('aria-label', `${rating.toFixed(1)} out of 5 stars`);
    s.style.setProperty('--fill', `${(rating / 5) * 100}%`);
    s.textContent = '★★★★★';
    return s;
  };

  function loadMaps() {
    if (window.google?.maps?.importLibrary) return Promise.resolve();
    return new Promise((resolve, reject) => {
      window.__ysvMapsReady = resolve;
      const s = document.createElement('script');
      s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&loading=async&callback=__ysvMapsReady`;
      s.async = true;
      s.onerror = reject;
      document.head.append(s);
    });
  }

  async function render() {
    await loadMaps();
    const { Place } = await google.maps.importLibrary('places');
    let place;
    if (placeId) {
      place = new Place({ id: placeId });
    } else {
      const { places } = await Place.searchByText({ textQuery: query, fields: ['id'] });
      if (!places?.length) throw new Error('Place not found');
      place = places[0];
    }
    await place.fetchFields({ fields: ['displayName', 'rating', 'userRatingCount', 'reviews', 'googleMapsURI'] });
    if (!place.rating) throw new Error('No rating');

    const mapsUrl = place.googleMapsURI || profileUrl;
    const writeUrl = `https://search.google.com/local/writereview?placeid=${encodeURIComponent(place.id)}`;

    const summary = el('div', 'rv-summary');
    summary.append(el('b', 'rv-score', place.rating.toFixed(1)), stars(place.rating));
    const count = el('a', 'rv-count', `${place.userRatingCount ?? ''} Google reviews`);
    count.href = mapsUrl;
    summary.append(count);

    const grid = el('div', 'rv-grid');
    for (const r of (place.reviews || []).slice(0, 6)) {
      const text = r.text || r.originalText;
      if (!text) continue;
      const card = el('figure', 'rv-card');
      const head = el('figcaption', 'rv-head');
      const who = el('a', 'rv-author');
      who.href = r.authorAttribution?.uri || mapsUrl;
      who.rel = 'nofollow noopener';
      who.target = '_blank';
      if (r.authorAttribution?.photoURI) {
        const img = el('img');
        img.src = r.authorAttribution.photoURI;
        img.alt = '';
        img.width = img.height = 40;
        img.loading = 'lazy';
        img.referrerPolicy = 'no-referrer';
        who.append(img);
      }
      const meta = el('span');
      meta.append(el('strong', null, r.authorAttribution?.displayName || 'Google user'), el('small', null, r.relativePublishTimeDescription || ''));
      who.append(meta);
      head.append(who, stars(r.rating || 0));
      const quote = el('blockquote', null, text);
      card.append(head, quote);
      grid.append(card);
    }

    const actions = el('div', 'rv-actions');
    const all = el('a', 'btn ghost', 'Read all reviews on Google');
    all.href = mapsUrl;
    const write = el('a', 'btn solid', 'Leave a review');
    write.href = writeUrl;
    actions.append(write, all);

    const body = root.querySelector('[data-reviews-body]');
    body.replaceChildren(summary, grid, actions, el('p', 'rv-attrib', 'Reviews from Google'));
    root.classList.add('is-live');
  }

  // Only call the API when the section is about to scroll into view.
  const io = new IntersectionObserver((entries) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    io.disconnect();
    render().catch((err) => console.warn('Google reviews widget:', err));
  }, { rootMargin: '400px' });
  io.observe(root);
})();
