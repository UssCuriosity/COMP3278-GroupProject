// One listing: details, amenities, reviews and the booking form.
import { api } from '../api.js';
import { h, icon, money, plural, capitalize, formatDate, formatRange, nightsBetween, todayISO, addDays, toast, field } from '../dom.js';
import { state, navigate, toHash } from '../store.js';
import { coverUrl, rating, stars, favoriteButton, ensureLogin, linkDateInputs } from '../components.js';

export async function render(root, { params, query }) {
  const id = params[0];
  const { listing, amenities, reviews, booked } = await api('GET', `/listings/${id}`);
  const isMine = state.user && state.user.id === listing.host_id;

  root.append(
    h('button', { class: 'back-link', type: 'button', onclick: () => (history.length > 1 ? history.back() : navigate('/search')) }, icon('arrowLeft', { size: 16 }), 'Back'),
    h(
      'div',
      { class: 'listing-head' },
      h(
        'div',
        {},
        h('h1', {}, listing.title),
        h('p', { class: 'listing-sub' }, rating(listing.avg_rating, listing.review_count), h('span', {}, icon('pin', { size: 15 }), ` ${listing.city}`), h('span', {}, capitalize(listing.property_type)))
      ),
      !isMine && favoriteButton(listing)
    ),
    h('img', { class: 'listing-cover', src: coverUrl(listing.cover), alt: '' }),
    h(
      'div',
      { class: 'listing-layout' },
      h(
        'div',
        { class: 'listing-main' },
        h(
          'section',
          { class: 'block' },
          h('h2', {}, `${capitalize(listing.property_type)} hosted by ${listing.host_name}`),
          h(
            'ul',
            { class: 'facts' },
            h('li', {}, icon('users'), plural(listing.max_guests, 'guest')),
            h('li', {}, icon('bed'), plural(listing.bedrooms, 'bedroom')),
            h('li', {}, icon('bath'), plural(listing.bathrooms, 'bathroom'))
          ),
          h('p', { class: 'description' }, listing.description)
        ),
        h(
          'section',
          { class: 'block' },
          h('h2', {}, 'What this place offers'),
          amenities.length ? h('ul', { class: 'amenities' }, amenities.map((amenity) => h('li', {}, icon('check', { size: 16 }), amenity.name))) : h('p', { class: 'muted' }, 'No amenities listed.')
        ),
        h(
          'section',
          { class: 'block' },
          h('h2', {}, reviews.length ? `${plural(reviews.length, 'review')} · ${Number(listing.avg_rating).toFixed(1)} average` : 'No reviews yet'),
          reviews.length
            ? h(
                'div',
                { class: 'reviews' },
                reviews.map((review) =>
                  h(
                    'article',
                    { class: 'review' },
                    h('div', { class: 'review-head' }, h('span', { class: 'avatar avatar-sm' }, review.guest_name[0]), h('div', {}, h('strong', {}, review.guest_name), h('span', { class: 'muted' }, formatDate(review.created_at))), stars(review.rating)),
                    h('p', {}, review.comment)
                  )
                )
              )
            : h('p', { class: 'muted' }, 'Guests can leave a review after their stay.')
        )
      ),
      bookingCard(listing, booked, query, isMine)
    )
  );
}

function bookingCard(listing, booked, query, isMine) {
  const today = todayISO();
  const checkIn = h('input', { type: 'date', name: 'check_in', min: today, required: true, value: query.check_in || '' });
  const checkOut = h('input', { type: 'date', name: 'check_out', min: query.check_in ? addDays(query.check_in, 1) : addDays(today, 1), required: true, value: query.check_out || '' });
  const guests = h(
    'select',
    { name: 'guests', value: String(Math.min(Number(query.guests) || 1, listing.max_guests)) },
    Array.from({ length: listing.max_guests }, (_, i) => h('option', { value: String(i + 1) }, plural(i + 1, 'guest')))
  );
  linkDateInputs(checkIn, checkOut);

  const summary = h('div', { class: 'price-summary' });
  const reserve = h('button', { class: 'btn btn-primary btn-block', type: 'submit' }, 'Reserve');

  const paint = () => {
    const ready = checkIn.value && checkOut.value && checkOut.value > checkIn.value;
    // Remember the chosen stay in the address bar (survives logging in or a refresh).
    history.replaceState(null, '', toHash(`/listing/${listing.id}`, { check_in: checkIn.value, check_out: checkOut.value, guests: guests.value }));
    if (!ready) {
      summary.replaceChildren(h('p', { class: 'muted' }, 'Pick your dates to see the total.'));
      return;
    }
    const nights = nightsBetween(checkIn.value, checkOut.value);
    const clash = booked.some((range) => range.check_in < checkOut.value && range.check_out > checkIn.value);
    summary.replaceChildren(
      h('div', { class: 'price-row' }, h('span', {}, `${money(listing.price_per_night)} × ${plural(nights, 'night')}`), h('span', {}, money(listing.price_per_night * nights))),
      h('div', { class: 'price-row price-total' }, h('span', {}, 'Total'), h('span', {}, money(listing.price_per_night * nights))),
      clash ? h('p', { class: 'notice notice-warn' }, 'These dates overlap an existing booking.') : ''
    );
  };
  [checkIn, checkOut, guests].forEach((input) => input.addEventListener('change', paint));

  const form = h('form', { class: 'stack' }, h('div', { class: 'date-pair' }, field('Check in', checkIn), field('Check out', checkOut)), field('Guests', guests), summary, reserve);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const stay = { listing_id: listing.id, check_in: checkIn.value, check_out: checkOut.value, guests: Number(guests.value) };
    if (!(await ensureLogin())) return;
    reserve.disabled = true;
    try {
      await api('POST', '/bookings', stay);
      toast('Booking confirmed. Enjoy your stay!');
      navigate('/trips');
    } catch (error) {
      toast(error.message, 'error');
      reserve.disabled = false;
    }
  });

  let content;
  if (isMine) {
    content = [h('p', { class: 'notice' }, 'This is your listing.'), h('a', { class: 'btn btn-primary btn-block', href: `#/host/edit/${listing.id}` }, 'Edit listing')];
  } else if (!listing.is_active) {
    content = [h('p', { class: 'notice notice-warn' }, 'The host has paused this listing. It is not accepting bookings right now.')];
  } else {
    content = [form];
    paint();
  }

  return h(
    'aside',
    { class: 'booking-card' },
    h('p', { class: 'booking-price' }, h('strong', {}, money(listing.price_per_night)), ' / night'),
    content,
    booked.length > 0 &&
      h(
        'div',
        { class: 'booked' },
        h('h3', {}, icon('calendar', { size: 15 }), ' Already booked'),
        h('ul', {}, booked.map((range) => h('li', {}, formatRange(range.check_in, range.check_out))))
      )
  );
}
