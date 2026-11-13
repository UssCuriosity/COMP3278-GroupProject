// Search results with filters. All filter values live in the URL, so every
// change simply navigates to a new #/search?... address and re-runs the query.
import { api } from '../api.js';
import { h, plural, capitalize, formatRange, nightsBetween } from '../dom.js';
import { loadMeta, navigate } from '../store.js';
import { searchForm, listingCard, emptyState } from '../components.js';

const SORTS = [
  ['rating', 'Top rated'],
  ['price_asc', 'Price: low to high'],
  ['price_desc', 'Price: high to low'],
  ['newest', 'Newest'],
];

export async function render(root, { query }) {
  const meta = await loadMeta();
  const selectedAmenities = new Set((query.amenities || '').split(',').filter(Boolean));
  const update = (changes) => navigate('/search', { ...query, ...changes });

  const params = new URLSearchParams(query).toString();
  const { listings } = await api('GET', `/listings${params ? `?${params}` : ''}`);

  const hasDates = Boolean(query.check_in && query.check_out);
  const nights = hasDates ? nightsBetween(query.check_in, query.check_out) : 0;
  const stay = { check_in: query.check_in, check_out: query.check_out, guests: query.guests };
  const filtersActive = ['type', 'min_price', 'max_price', 'amenities'].some((key) => query[key]);

  const priceInput = (name, placeholder) =>
    h('input', { type: 'number', min: 0, step: 50, placeholder, value: query[name] || '', onchange: (event) => update({ [name]: event.target.value }) });

  const filters = h(
    'aside',
    { class: 'filters' },
    h(
      'div',
      { class: 'filter-group' },
      h('h3', {}, 'Sort by'),
      h('select', { value: query.sort || 'rating', onchange: (event) => update({ sort: event.target.value }) }, SORTS.map(([value, label]) => h('option', { value }, label)))
    ),
    h(
      'div',
      { class: 'filter-group' },
      h('h3', {}, 'Property type'),
      h(
        'div',
        { class: 'chip-row' },
        ['', ...meta.propertyTypes].map((type) =>
          h('button', { class: `chip chip-button${(query.type || '') === type ? ' is-on' : ''}`, type: 'button', onclick: () => update({ type }) }, type ? capitalize(type) : 'Any')
        )
      )
    ),
    h('div', { class: 'filter-group' }, h('h3', {}, 'Price per night (HK$)'), h('div', { class: 'price-range' }, priceInput('min_price', 'Min'), h('span', {}, '–'), priceInput('max_price', 'Max'))),
    h(
      'div',
      { class: 'filter-group' },
      h('h3', {}, 'Amenities'),
      h('p', { class: 'field-hint' }, 'Shows stays that have all selected amenities.'),
      h(
        'div',
        { class: 'chip-row' },
        meta.amenities.map((amenity) => {
          const id = String(amenity.id);
          const on = selectedAmenities.has(id);
          return h(
            'button',
            {
              class: `chip chip-button${on ? ' is-on' : ''}`,
              type: 'button',
              'aria-pressed': String(on),
              onclick: () => {
                const next = new Set(selectedAmenities);
                if (on) next.delete(id);
                else next.add(id);
                update({ amenities: [...next].join(',') });
              },
            },
            amenity.name
          );
        })
      )
    ),
    filtersActive && h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => update({ type: '', min_price: '', max_price: '', amenities: '' }) }, 'Clear filters')
  );

  const summary = [plural(listings.length, 'stay'), query.city ? `in ${query.city}` : 'anywhere', hasDates && `· ${formatRange(query.check_in, query.check_out)}`, query.guests && `· ${plural(Number(query.guests), 'guest')}`]
    .filter(Boolean)
    .join(' ');

  root.append(
    h('div', { class: 'search-bar' }, searchForm(meta, query, { extra: { sort: query.sort, type: query.type, min_price: query.min_price, max_price: query.max_price, amenities: query.amenities } })),
    h(
      'div',
      { class: 'search-layout' },
      filters,
      h(
        'section',
        { class: 'results' },
        h('div', { class: 'results-head' }, h('h1', {}, summary), hasDates && h('p', { class: 'muted' }, 'Only places that are free for your whole stay are shown.')),
        listings.length
          ? h('div', { class: 'card-grid' }, listings.map((listing) => listingCard(listing, { stay, nights })))
          : emptyState({ title: 'No stays match', text: 'Try different dates, a wider price range or fewer amenities.' })
      )
    )
  );
}
