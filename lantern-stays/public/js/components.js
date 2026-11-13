// Building blocks shared by several pages.
import { api } from './api.js';
import { h, icon, money, plural, capitalize, toast, openModal, asyncForm, field, todayISO, addDays } from './dom.js';
import { state, setUser, navigate, toHash, refresh } from './store.js';

export const coverUrl = (cover) => `/img/covers/${encodeURIComponent(cover)}.svg`;

export function rating(avg, count) {
  if (!count) return h('span', { class: 'rating rating-new' }, 'New');
  return h(
    'span',
    { class: 'rating', title: `${avg} out of 5` },
    icon('star', { size: 14, filled: true }),
    h('strong', {}, Number(avg).toFixed(1)),
    h('span', { class: 'muted' }, `(${count})`)
  );
}

export function stars(value) {
  return h(
    'span',
    { class: 'stars', 'aria-label': `${value} out of 5 stars` },
    [1, 2, 3, 4, 5].map((i) => h('span', { class: i <= value ? 'star-on' : 'star-off' }, icon('star', { size: 15, filled: true })))
  );
}

// Heart button: INSERT / DELETE a row in the favorites table.
export function favoriteButton(listing, { onChange } = {}) {
  let saved = Boolean(listing.is_favorite);
  const button = h('button', { class: 'fav-btn', type: 'button' });
  const paint = () => {
    button.classList.toggle('is-saved', saved);
    button.setAttribute('aria-label', saved ? 'Remove from saved' : 'Save this stay');
    button.replaceChildren(icon('heart', { size: 18, filled: saved }));
  };
  paint();
  button.addEventListener('click', async (event) => {
    event.preventDefault();
    event.stopPropagation();
    const wasLoggedOut = !state.user;
    if (!(await ensureLogin())) return;
    try {
      const result = await api(saved ? 'DELETE' : 'PUT', `/favorites/${listing.id}`);
      saved = result.is_favorite;
      paint();
      toast(saved ? 'Saved to your list.' : 'Removed from your list.');
      if (onChange) onChange(saved);
      if (wasLoggedOut) refresh();
    } catch (error) {
      toast(error.message, 'error');
    }
  });
  return button;
}

// A listing tile. `stay` (check_in, check_out, guests) is carried into the link.
export function listingCard(listing, { stay = {}, nights = 0, onFavoriteChange } = {}) {
  return h(
    'a',
    { class: 'card', href: toHash(`/listing/${listing.id}`, stay) },
    h(
      'div',
      { class: 'card-cover' },
      h('img', { src: coverUrl(listing.cover), alt: '', loading: 'lazy' }),
      favoriteButton(listing, { onChange: onFavoriteChange })
    ),
    h(
      'div',
      { class: 'card-body' },
      h('div', { class: 'card-top' }, h('span', { class: 'card-place' }, `${listing.city} · ${capitalize(listing.property_type)}`), rating(listing.avg_rating, listing.review_count)),
      h('h3', { class: 'card-title' }, listing.title),
      h('p', { class: 'card-meta' }, `${plural(listing.max_guests, 'guest')} · ${plural(listing.bedrooms, 'bedroom')} · ${plural(listing.bathrooms, 'bath')}`),
      h(
        'p',
        { class: 'card-price' },
        h('strong', {}, money(listing.price_per_night)),
        ' / night',
        nights > 0 && h('span', { class: 'muted' }, ` · ${money(listing.price_per_night * nights)} total`)
      )
    )
  );
}

export function emptyState({ title, text, action }) {
  return h('div', { class: 'empty' }, h('h2', {}, title), text && h('p', {}, text), action);
}

// "Where / check-in / check-out / guests" form used on the home and search pages.
export function searchForm(meta, values = {}, { extra = {} } = {}) {
  const today = todayISO();
  const checkIn = h('input', { type: 'date', name: 'check_in', min: today, value: values.check_in || '' });
  const checkOut = h('input', { type: 'date', name: 'check_out', min: values.check_in ? addDays(values.check_in, 1) : addDays(today, 1), value: values.check_out || '' });
  linkDateInputs(checkIn, checkOut);

  const form = h(
    'form',
    { class: 'search-form' },
    field(
      'Where',
      h(
        'select',
        { name: 'city', value: values.city || '' },
        h('option', { value: '' }, 'Anywhere'),
        meta.cities.map((c) => h('option', { value: c.city }, c.city))
      )
    ),
    field('Check in', checkIn),
    field('Check out', checkOut),
    field('Guests', h('input', { type: 'number', name: 'guests', min: 1, max: 16, placeholder: 'Any', value: values.guests || '' })),
    h('button', { class: 'btn btn-primary search-submit', type: 'submit' }, icon('search'), 'Search')
  );
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    if (Boolean(data.check_in) !== Boolean(data.check_out)) {
      toast('Please pick both a check-in and a check-out date.', 'error');
      return;
    }
    navigate('/search', { ...extra, ...data });
  });
  return form;
}

// Keeps check-out after check-in.
export function linkDateInputs(checkIn, checkOut) {
  checkIn.addEventListener('change', () => {
    if (!checkIn.value) return;
    const earliest = addDays(checkIn.value, 1);
    checkOut.min = earliest;
    if (!checkOut.value || checkOut.value < earliest) checkOut.value = earliest;
    checkOut.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

// ---- log in / sign up --------------------------------------------------------
// Demo accounts created by db/seed.sql (they all share this demo password).
const DEMO_PASSWORD = 'lantern123';
const DEMO_ACCOUNTS = [
  { label: 'Alice (guest)', email: 'alice@example.com' },
  { label: 'Ben (host)', email: 'ben@example.com' },
];

let authOpen = null;

// Resolves to true once the user is logged in, false if they close the dialog.
export function ensureLogin() {
  return state.user ? Promise.resolve(true) : openAuthDialog('login');
}

export function openAuthDialog(mode = 'login') {
  if (authOpen) return authOpen;
  const body = h('div', {});
  const modal = openModal({ title: 'Welcome to Lantern Stays', content: body });

  const show = (current) => {
    const isLogin = current === 'login';
    const email = h('input', { type: 'email', name: 'email', required: true, autocomplete: 'username', placeholder: 'you@example.com' });
    const password = h('input', { type: 'password', name: 'password', required: true, minlength: isLogin ? 1 : 8, autocomplete: isLogin ? 'current-password' : 'new-password' });
    const form = asyncForm(
      { class: 'stack' },
      async (data) => {
        const payload = Object.fromEntries(data);
        const { user } = await api('POST', isLogin ? '/auth/login' : '/auth/register', payload);
        modal.close();
        setUser(user);
        toast(isLogin ? `Welcome back, ${user.name.split(' ')[0]}!` : `Account created. Welcome, ${user.name.split(' ')[0]}!`);
      },
      !isLogin && field('Full name', h('input', { type: 'text', name: 'name', required: true, maxlength: 100, autocomplete: 'name' })),
      field('Email', email),
      field('Password', password, !isLogin && 'At least 8 characters.'),
      h('button', { class: 'btn btn-primary btn-block', type: 'submit' }, isLogin ? 'Log in' : 'Create account')
    );

    body.replaceChildren(
      h(
        'div',
        { class: 'tabs' },
        h('button', { class: `tab${isLogin ? ' is-active' : ''}`, type: 'button', onclick: () => show('login') }, 'Log in'),
        h('button', { class: `tab${isLogin ? '' : ' is-active'}`, type: 'button', onclick: () => show('register') }, 'Sign up')
      ),
      form,
      h(
          'div',
          { class: 'demo-box', hidden: !isLogin },
          h('span', { class: 'muted' }, 'Demo accounts:'),
          DEMO_ACCOUNTS.map((account) =>
            h(
              'button',
              {
                class: 'chip chip-button',
                type: 'button',
                onclick: () => {
                  email.value = account.email;
                  password.value = DEMO_PASSWORD;
                  form.requestSubmit();
                },
              },
              account.label
            )
          )
        )
    );
    (isLogin ? email : form.querySelector('[name="name"]')).focus();
  };
  show(mode);

  authOpen = modal.closed.then(() => {
    authOpen = null;
    return Boolean(state.user);
  });
  return authOpen;
}
