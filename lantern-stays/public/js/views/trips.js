// My trips: change or cancel upcoming stays, review finished ones.
import { api } from '../api.js';
import { h, money, plural, formatRange, todayISO, addDays, toast, openModal, confirmDialog, runAction, asyncForm, field } from '../dom.js';
import { refresh } from '../store.js';
import { coverUrl, stars, emptyState, linkDateInputs } from '../components.js';

const PHASE_LABELS = { upcoming: 'Upcoming', current: 'Staying now', past: 'Completed', cancelled: 'Cancelled' };

export async function render(root) {
  const { bookings } = await api('GET', '/bookings');

  const upcoming = bookings.filter((b) => b.phase === 'upcoming' || b.phase === 'current').reverse(); // soonest first
  const past = bookings.filter((b) => b.phase === 'past');
  const cancelled = bookings.filter((b) => b.phase === 'cancelled');

  root.append(h('div', { class: 'page-head' }, h('h1', {}, 'Your trips'), h('a', { class: 'btn btn-ghost', href: '#/search' }, 'Find another stay')));

  if (bookings.length === 0) {
    root.append(emptyState({ title: 'No trips yet', text: 'When you book a stay it will appear here.', action: h('a', { class: 'btn btn-primary', href: '#/search' }, 'Explore stays') }));
    return;
  }

  const group = (title, items, emptyText) =>
    h('section', { class: 'section' }, h('h2', {}, `${title} (${items.length})`), items.length ? h('div', { class: 'trip-list' }, items.map(tripCard)) : h('p', { class: 'muted' }, emptyText));

  root.append(group('Upcoming', upcoming, 'Nothing booked at the moment.'), group('Past stays', past, 'Finished stays show up here, ready for your review.'));
  if (cancelled.length > 0) root.append(group('Cancelled', cancelled, ''));
}

function tripCard(booking) {
  return h(
    'article',
    { class: `trip trip-${booking.phase}` },
    h('a', { class: 'trip-cover', href: `#/listing/${booking.listing_id}` }, h('img', { src: coverUrl(booking.cover), alt: '', loading: 'lazy' })),
    h(
      'div',
      { class: 'trip-body' },
      h('div', { class: 'trip-top' }, h('span', { class: `status status-${booking.phase}` }, PHASE_LABELS[booking.phase]), h('span', { class: 'muted' }, `Booking #${booking.id}`)),
      h('h3', {}, h('a', { href: `#/listing/${booking.listing_id}` }, booking.title)),
      h('p', { class: 'muted' }, `${booking.city} · hosted by ${booking.host_name}`),
      h(
        'p',
        { class: 'trip-facts' },
        h('strong', {}, formatRange(booking.check_in, booking.check_out)),
        ` · ${plural(booking.guests, 'guest')} · ${plural(booking.nights, 'night')} × ${money(booking.nightly_price)} = `,
        h('strong', {}, money(booking.total_price))
      ),
      tripActions(booking)
    )
  );
}

function tripActions(booking) {
  if (booking.phase === 'upcoming') {
    return h(
      'div',
      { class: 'actions' },
      h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => changeDialog(booking) }, 'Change dates'),
      h('button', { class: 'btn btn-ghost btn-sm btn-danger-text', type: 'button', onclick: (event) => cancel(booking, event.currentTarget) }, 'Cancel booking')
    );
  }
  if (booking.phase === 'cancelled') {
    return h(
      'div',
      { class: 'actions' },
      h('button', { class: 'btn btn-ghost btn-sm btn-danger-text', type: 'button', onclick: (event) => remove(booking, event.currentTarget) }, 'Remove from history')
    );
  }
  if (booking.phase === 'past') {
    if (booking.review_rating === null) {
      return h('div', { class: 'actions' }, h('button', { class: 'btn btn-primary btn-sm', type: 'button', onclick: () => reviewDialog(booking) }, 'Write a review'));
    }
    return h(
      'div',
      { class: 'my-review' },
      h('div', { class: 'my-review-head' }, h('span', { class: 'muted' }, 'Your review'), stars(booking.review_rating)),
      h('p', {}, booking.review_comment),
      h(
        'div',
        { class: 'actions' },
        h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => reviewDialog(booking) }, 'Edit review'),
        h('button', { class: 'btn btn-ghost btn-sm btn-danger-text', type: 'button', onclick: (event) => deleteReview(booking, event.currentTarget) }, 'Delete review')
      )
    );
  }
  return null;
}

// UPDATE bookings SET check_in, check_out, guests
function changeDialog(booking) {
  const today = todayISO();
  const checkIn = h('input', { type: 'date', name: 'check_in', min: today, required: true, value: booking.check_in });
  const checkOut = h('input', { type: 'date', name: 'check_out', min: addDays(booking.check_in, 1), required: true, value: booking.check_out });
  linkDateInputs(checkIn, checkOut);
  const guests = h(
    'select',
    { name: 'guests', value: String(booking.guests) },
    Array.from({ length: booking.max_guests }, (_, i) => h('option', { value: String(i + 1) }, plural(i + 1, 'guest')))
  );

  const modal = openModal({
    title: 'Change your booking',
    content: asyncForm(
      { class: 'stack' },
      async (data) => {
        await api('PATCH', `/bookings/${booking.id}`, { ...Object.fromEntries(data), guests: Number(data.get('guests')) });
        modal.close();
        toast('Booking updated.');
        refresh();
      },
      h('p', { class: 'modal-text' }, booking.title),
      h('div', { class: 'date-pair' }, field('Check in', checkIn), field('Check out', checkOut)),
      field('Guests', guests),
      h('p', { class: 'field-hint' }, `The price stays at ${money(booking.nightly_price)} per night, as booked.`),
      h('div', { class: 'modal-actions' }, h('button', { class: 'btn btn-primary', type: 'submit' }, 'Save changes'))
    ),
  });
}

// UPDATE bookings SET status = 'cancelled'
async function cancel(booking, button) {
  const yes = await confirmDialog({
    title: 'Cancel this booking?',
    message: `${booking.title}, ${formatRange(booking.check_in, booking.check_out)}. The dates become available to other guests.`,
    confirmLabel: 'Cancel booking',
    danger: true,
  });
  if (!yes) return;
  if (await runAction(button, () => api('POST', `/bookings/${booking.id}/cancel`))) {
    toast('Booking cancelled.');
    refresh();
  }
}

// DELETE FROM bookings
async function remove(booking, button) {
  if (await runAction(button, () => api('DELETE', `/bookings/${booking.id}`))) {
    toast('Removed from your history.');
    refresh();
  }
}

// INSERT INTO reviews / UPDATE reviews
function reviewDialog(booking) {
  const editing = booking.review_rating !== null;
  const current = booking.review_rating || 5;
  const modal = openModal({
    title: editing ? 'Edit your review' : 'Review your stay',
    content: asyncForm(
      { class: 'stack' },
      async (data) => {
        const payload = { rating: Number(data.get('rating')), comment: data.get('comment') };
        await api(editing ? 'PUT' : 'POST', `/bookings/${booking.id}/review`, payload);
        modal.close();
        toast(editing ? 'Review updated.' : 'Thanks for your review!');
        refresh();
      },
      h('p', { class: 'modal-text' }, booking.title),
      h(
        'fieldset',
        { class: 'star-picker' },
        h('legend', { class: 'field-label' }, 'Rating'),
        [5, 4, 3, 2, 1].map((value) => [
          h('input', { type: 'radio', name: 'rating', id: `rating-${value}`, value: String(value), checked: value === current }),
          h('label', { htmlFor: `rating-${value}`, title: plural(value, 'star') }, '★'),
        ])
      ),
      field('Your review', h('textarea', { name: 'comment', rows: 4, required: true, minlength: 10, maxlength: 1000, placeholder: 'What was the stay like?', value: booking.review_comment || '' })),
      h('div', { class: 'modal-actions' }, h('button', { class: 'btn btn-primary', type: 'submit' }, editing ? 'Save review' : 'Post review'))
    ),
  });
}

// DELETE FROM reviews
async function deleteReview(booking, button) {
  const yes = await confirmDialog({ title: 'Delete your review?', message: 'Your rating and comment will be removed from the listing.', confirmLabel: 'Delete review', danger: true });
  if (!yes) return;
  if (await runAction(button, () => api('DELETE', `/bookings/${booking.id}/review`))) {
    toast('Review deleted.');
    refresh();
  }
}
