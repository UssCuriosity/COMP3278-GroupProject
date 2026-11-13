// Host dashboard: statistics per listing, reservations, and listing management.
import { api } from '../api.js';
import { h, icon, money, plural, capitalize, formatRange, todayISO, toast, confirmDialog, runAction } from '../dom.js';
import { refresh } from '../store.js';
import { coverUrl, rating, emptyState } from '../components.js';

export async function render(root) {
  const { listings, reservations } = await api('GET', '/host/dashboard');
  const sum = (key) => listings.reduce((total, listing) => total + Number(listing[key]), 0);

  root.append(h('div', { class: 'page-head' }, h('h1', {}, 'Host dashboard'), h('a', { class: 'btn btn-primary', href: '#/host/new' }, icon('plus', { size: 16 }), 'New listing')));

  if (listings.length === 0) {
    root.append(
      emptyState({ title: 'Become a host', text: 'Publish your first place and start receiving bookings.', action: h('a', { class: 'btn btn-primary', href: '#/host/new' }, 'Create a listing') })
    );
    return;
  }

  const tile = (label, value, note) => h('div', { class: 'tile' }, h('span', { class: 'tile-label' }, label), h('strong', { class: 'tile-value' }, value), note && h('span', { class: 'tile-note' }, note));

  root.append(
    h(
      'div',
      { class: 'tiles' },
      tile('Listings', String(listings.length), `${listings.filter((l) => l.is_active).length} active`),
      tile('Upcoming reservations', String(sum('upcoming_count'))),
      tile('Nights booked', String(sum('nights_booked')), 'confirmed stays'),
      tile('Revenue', money(sum('revenue')), 'confirmed stays')
    ),

    h(
      'section',
      { class: 'section' },
      h('h2', {}, 'Your listings'),
      h(
        'div',
        { class: 'table-wrap' },
        h(
          'table',
          { class: 'table' },
          h('thead', {}, h('tr', {}, ['Listing', 'Price', 'Bookings', 'Nights', 'Revenue', 'Rating', ''].map((heading) => h('th', {}, heading)))),
          h('tbody', {}, listings.map(listingRow))
        )
      )
    ),

    h(
      'section',
      { class: 'section' },
      h('h2', {}, `Current and upcoming reservations (${reservations.length})`),
      reservations.length
        ? h(
            'div',
            { class: 'table-wrap' },
            h(
              'table',
              { class: 'table' },
              h('thead', {}, h('tr', {}, ['Guest', 'Listing', 'Dates', 'Guests', 'Total', 'Status'].map((heading) => h('th', {}, heading)))),
              h('tbody', {}, reservations.map(reservationRow))
            )
          )
        : h('p', { class: 'muted' }, 'No reservations coming up.')
    )
  );
}

function listingRow(listing) {
  return h(
    'tr',
    { class: listing.is_active ? '' : 'row-paused' },
    h(
      'td',
      {},
      h(
        'a',
        { class: 'row-listing', href: `#/listing/${listing.id}` },
        h('img', { src: coverUrl(listing.cover), alt: '', loading: 'lazy' }),
        h('span', {}, h('strong', {}, listing.title), h('span', { class: 'muted' }, `${listing.city} · ${capitalize(listing.property_type)}`), !listing.is_active && h('span', { class: 'status status-cancelled' }, 'Paused'))
      )
    ),
    h('td', {}, money(listing.price_per_night)),
    h('td', {}, String(listing.booking_count), listing.upcoming_count > 0 && h('span', { class: 'muted' }, ` (${listing.upcoming_count} upcoming)`)),
    h('td', {}, String(listing.nights_booked)),
    h('td', {}, h('strong', {}, money(listing.revenue))),
    h('td', {}, rating(listing.avg_rating, listing.review_count)),
    h(
      'td',
      {},
      h(
        'div',
        { class: 'row-actions' },
        h('a', { class: 'icon-btn', href: `#/host/edit/${listing.id}`, title: 'Edit listing', 'aria-label': `Edit ${listing.title}` }, icon('edit')),
        h(
          'button',
          {
            class: 'icon-btn',
            type: 'button',
            title: listing.is_active ? 'Pause (hide from search)' : 'Activate (show in search)',
            'aria-label': `${listing.is_active ? 'Pause' : 'Activate'} ${listing.title}`,
            onclick: (event) => setActive(listing, event.currentTarget),
          },
          icon(listing.is_active ? 'pause' : 'play')
        ),
        h('button', { class: 'icon-btn icon-btn-danger', type: 'button', title: 'Delete listing', 'aria-label': `Delete ${listing.title}`, onclick: (event) => remove(listing, event.currentTarget) }, icon('trash'))
      )
    )
  );
}

function reservationRow(reservation) {
  const staying = reservation.check_in <= todayISO();
  const phase = reservation.status === 'cancelled' ? 'cancelled' : staying ? 'current' : 'upcoming';
  const label = { cancelled: 'Cancelled', current: 'Staying now', upcoming: 'Confirmed' }[phase];
  return h(
    'tr',
    {},
    h('td', {}, h('strong', {}, reservation.guest_name)),
    h('td', {}, h('a', { class: 'link', href: `#/listing/${reservation.listing_id}` }, reservation.title)),
    h('td', {}, formatRange(reservation.check_in, reservation.check_out), h('span', { class: 'muted' }, ` · ${plural(reservation.nights, 'night')}`)),
    h('td', {}, String(reservation.guests)),
    h('td', {}, money(reservation.total_price)),
    h('td', {}, h('span', { class: `status status-${phase}` }, label))
  );
}

// UPDATE listings SET is_active
async function setActive(listing, button) {
  const next = !listing.is_active;
  if (await runAction(button, () => api('PATCH', `/host/listings/${listing.id}/active`, { is_active: next }))) {
    toast(next ? 'Listing is live again.' : 'Listing paused. It no longer appears in search.');
    refresh();
  }
}

// DELETE FROM listings (MySQL refuses if the listing has bookings)
async function remove(listing, button) {
  const yes = await confirmDialog({ title: 'Delete this listing?', message: `"${listing.title}" will be removed permanently.`, confirmLabel: 'Delete listing', danger: true });
  if (!yes) return;
  if (await runAction(button, () => api('DELETE', `/host/listings/${listing.id}`))) {
    toast('Listing deleted.');
    refresh();
  }
}
