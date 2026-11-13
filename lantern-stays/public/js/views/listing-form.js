// Create a listing (#/host/new) or edit one (#/host/edit/:id).
import { api } from '../api.js';
import { h, capitalize, toast, asyncForm, field } from '../dom.js';
import { state, loadMeta, navigate } from '../store.js';
import { coverUrl, emptyState } from '../components.js';

export async function render(root, { params }) {
  const editingId = params[0];
  const meta = await loadMeta();

  let listing = { title: '', description: '', city: '', property_type: 'apartment', price_per_night: '', max_guests: 2, bedrooms: 1, bathrooms: 1, cover: meta.covers[0] };
  let chosenAmenities = new Set();
  if (editingId) {
    const data = await api('GET', `/listings/${editingId}`);
    if (data.listing.host_id !== state.user.id) {
      root.append(emptyState({ title: 'Not your listing', text: 'You can only edit listings that you host.', action: h('a', { class: 'btn btn-primary', href: '#/host' }, 'Back to dashboard') }));
      return;
    }
    listing = data.listing;
    chosenAmenities = new Set(data.amenities.map((amenity) => amenity.id));
  }

  const number = (name, value, min, max, step = 1) => h('input', { type: 'number', name, required: true, min, max, step, value: String(value) });

  const form = asyncForm(
    { class: 'listing-form stack' },
    async (data) => {
      const payload = {
        title: data.get('title'),
        description: data.get('description'),
        city: data.get('city'),
        property_type: data.get('property_type'),
        price_per_night: Number(data.get('price_per_night')),
        max_guests: Number(data.get('max_guests')),
        bedrooms: Number(data.get('bedrooms')),
        bathrooms: Number(data.get('bathrooms')),
        cover: data.get('cover'),
        amenity_ids: data.getAll('amenity_ids').map(Number),
      };
      if (editingId) await api('PUT', `/host/listings/${editingId}`, payload);
      else await api('POST', '/host/listings', payload);
      toast(editingId ? 'Listing updated.' : 'Listing published.');
      navigate('/host');
    },
    field('Title', h('input', { type: 'text', name: 'title', required: true, minlength: 5, maxlength: 120, placeholder: 'e.g. Rooftop studio in Sheung Wan', value: listing.title })),
    h(
      'div',
      { class: 'form-row' },
      field('City', h('input', { type: 'text', name: 'city', required: true, maxlength: 80, list: 'city-options', placeholder: 'Hong Kong', value: listing.city })),
      field('Property type', h('select', { name: 'property_type', value: listing.property_type }, meta.propertyTypes.map((type) => h('option', { value: type }, capitalize(type))))),
      field('Price per night (HK$)', number('price_per_night', listing.price_per_night, 1, 99999, 'any'))
    ),
    h('datalist', { id: 'city-options' }, meta.cities.map((city) => h('option', { value: city.city }))),
    h('div', { class: 'form-row' }, field('Max guests', number('max_guests', listing.max_guests, 1, 16)), field('Bedrooms', number('bedrooms', listing.bedrooms, 0, 20)), field('Bathrooms', number('bathrooms', listing.bathrooms, 0, 20))),
    field('Description', h('textarea', { name: 'description', rows: 5, required: true, minlength: 20, maxlength: 2000, placeholder: 'What makes your place special?', value: listing.description })),
    h(
      'fieldset',
      { class: 'fieldset' },
      h('legend', { class: 'field-label' }, 'Amenities'),
      h(
        'div',
        { class: 'check-grid' },
        meta.amenities.map((amenity) => h('label', { class: 'check' }, h('input', { type: 'checkbox', name: 'amenity_ids', value: String(amenity.id), checked: chosenAmenities.has(amenity.id) }), amenity.name))
      )
    ),
    h(
      'fieldset',
      { class: 'fieldset' },
      h('legend', { class: 'field-label' }, 'Cover illustration'),
      h(
        'div',
        { class: 'cover-grid' },
        meta.covers.map((cover) =>
          h(
            'label',
            { class: 'cover-option', title: cover.replace('-', ', ') },
            h('input', { type: 'radio', name: 'cover', value: cover, checked: cover === listing.cover, required: true }),
            h('img', { src: coverUrl(cover), alt: cover.replace('-', ' at '), loading: 'lazy' })
          )
        )
      )
    ),
    h('div', { class: 'form-actions' }, h('a', { class: 'btn btn-ghost', href: '#/host' }, 'Cancel'), h('button', { class: 'btn btn-primary', type: 'submit' }, editingId ? 'Save changes' : 'Publish listing'))
  );

  root.append(h('div', { class: 'page-head' }, h('h1', {}, editingId ? 'Edit listing' : 'New listing')), h('div', { class: 'panel' }, form));
}
