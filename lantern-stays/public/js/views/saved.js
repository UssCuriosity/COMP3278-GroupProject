// Saved stays (the favorites table).
import { api } from '../api.js';
import { h, plural } from '../dom.js';
import { refresh } from '../store.js';
import { listingCard, emptyState } from '../components.js';

export async function render(root) {
  const { listings } = await api('GET', '/favorites');

  root.append(h('div', { class: 'page-head' }, h('h1', {}, 'Saved stays'), h('span', { class: 'muted' }, plural(listings.length, 'stay'))));

  if (listings.length === 0) {
    root.append(
      emptyState({ title: 'Nothing saved yet', text: 'Tap the heart on any stay to keep it here.', action: h('a', { class: 'btn btn-primary', href: '#/search' }, 'Explore stays') })
    );
    return;
  }
  // Un-saving a stay here removes its card straight away.
  root.append(h('div', { class: 'card-grid' }, listings.map((listing) => listingCard(listing, { onFavoriteChange: (saved) => !saved && refresh() }))));
}
