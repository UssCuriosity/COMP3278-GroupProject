// Home page: search box, destinations and the best-rated stays.
import { api } from '../api.js';
import { h, money, plural } from '../dom.js';
import { loadMeta, toHash } from '../store.js';
import { searchForm, listingCard, coverUrl } from '../components.js';

const CITY_COVERS = {
  'Hong Kong': 'harbour-dusk',
  Tokyo: 'skyline-night',
  Seoul: 'village-night',
  Taipei: 'mountain-dusk',
  Bangkok: 'beach-dusk',
  Singapore: 'harbour-night',
};
const FALLBACK_COVERS = ['village-day', 'forest-day', 'mountain-day', 'beach-day', 'skyline-day', 'harbour-day'];

export async function render(root) {
  const [meta, top] = await Promise.all([loadMeta({ fresh: true }), api('GET', '/listings?sort=rating')]);

  root.append(
    h(
      'section',
      { class: 'hero' },
      h('img', { class: 'hero-art', src: coverUrl('harbour-dusk'), alt: '' }),
      h(
        'div',
        { class: 'hero-content' },
        h('p', { class: 'eyebrow' }, 'Homes, cabins and hideaways across Asia'),
        h('h1', {}, 'Find a place that feels like yours.'),
        searchForm(meta)
      )
    ),

    h(
      'section',
      { class: 'section' },
      h('div', { class: 'section-head' }, h('h2', {}, 'Popular destinations'), h('a', { class: 'link', href: '#/search' }, 'Browse all stays')),
      h(
        'div',
        { class: 'city-grid' },
        meta.cities.map((city, index) =>
          h(
            'a',
            { class: 'city-card', href: toHash('/search', { city: city.city }) },
            h('img', { src: coverUrl(CITY_COVERS[city.city] || FALLBACK_COVERS[index % FALLBACK_COVERS.length]), alt: '', loading: 'lazy' }),
            h('div', { class: 'city-card-text' }, h('strong', {}, city.city), h('span', {}, `${plural(city.listing_count, 'stay')} · from ${money(city.from_price)}`))
          )
        )
      )
    ),

    h(
      'section',
      { class: 'section' },
      h('div', { class: 'section-head' }, h('h2', {}, 'Top-rated stays'), h('a', { class: 'link', href: toHash('/search', { sort: 'rating' }) }, 'See more')),
      h('div', { class: 'card-grid' }, top.listings.slice(0, 8).map((listing) => listingCard(listing)))
    )
  );
}
