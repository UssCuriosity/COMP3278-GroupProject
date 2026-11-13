// Create a listing (/host/new) or edit one (/host/edit/:id).
import { Link, useNavigate, useParams } from 'react-router';
import { type ListingPage, type Meta, api } from '../api';
import { Loading } from '../App';
import { useAuth } from '../auth';
import { capitalize, coverUrl } from '../format';
import { useListing, useMeta, useRefresh } from '../hooks';
import { AsyncForm, EmptyState, Field, toast } from '../ui';

export function ListingForm() {
  const { id } = useParams();
  const { user } = useAuth();
  const meta = useMeta();
  const existing = useListing(id);

  if (!meta.data) return <Loading query={meta} />;
  if (id && !existing.data) return <Loading query={existing} />;
  if (existing.data && existing.data.listing.host_id !== user?.id) {
    return (
      <EmptyState
        title="Not your listing"
        text="You can only edit listings that you host."
        action={
          <Link className="btn btn-primary" to="/host">
            Back to dashboard
          </Link>
        }
      />
    );
  }

  return (
    <>
      <div className="page-head">
        <h1>{id ? 'Edit listing' : 'New listing'}</h1>
      </div>
      <div className="panel">
        <Form key={id ?? 'new'} meta={meta.data} editingId={id} page={existing.data} />
      </div>
    </>
  );
}

function Form({ meta, editingId, page }: { meta: Meta; editingId?: string; page?: ListingPage }) {
  const navigate = useNavigate();
  const refresh = useRefresh();
  const listing = page?.listing;
  const chosen = new Set(page?.amenities.map((amenity) => amenity.id));

  const number = (name: string, value: number | undefined, min: number, max: number, step: number | 'any' = 1) => <input type="number" name={name} required min={min} max={max} step={step} defaultValue={value} />;

  return (
    <AsyncForm
      className="listing-form stack"
      onSubmit={async (data) => {
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
        // INSERT INTO listings / UPDATE listings (plus the amenity links, in one transaction)
        if (editingId) await api('PUT', `/host/listings/${editingId}`, payload);
        else await api('POST', '/host/listings', payload);
        await refresh();
        toast(editingId ? 'Listing updated.' : 'Listing published.');
        navigate('/host');
      }}
    >
      <Field label="Title">
        <input type="text" name="title" required minLength={5} maxLength={120} placeholder="e.g. Rooftop studio in Sheung Wan" defaultValue={listing?.title} />
      </Field>
      <div className="form-row">
        <Field label="City">
          <input type="text" name="city" required maxLength={80} list="city-options" placeholder="Hong Kong" defaultValue={listing?.city} />
        </Field>
        <Field label="Property type">
          <select name="property_type" defaultValue={listing?.property_type ?? 'apartment'}>
            {meta.propertyTypes.map((type) => (
              <option key={type} value={type}>
                {capitalize(type)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Price per night (HK$)">{number('price_per_night', listing?.price_per_night, 1, 99999, 'any')}</Field>
      </div>
      <datalist id="city-options">
        {meta.cities.map((city) => (
          <option key={city.city} value={city.city} />
        ))}
      </datalist>
      <div className="form-row">
        <Field label="Max guests">{number('max_guests', listing?.max_guests ?? 2, 1, 16)}</Field>
        <Field label="Bedrooms">{number('bedrooms', listing?.bedrooms ?? 1, 0, 20)}</Field>
        <Field label="Bathrooms">{number('bathrooms', listing?.bathrooms ?? 1, 0, 20)}</Field>
      </div>
      <Field label="Description">
        <textarea name="description" rows={5} required minLength={20} maxLength={2000} placeholder="What makes your place special?" defaultValue={listing?.description} />
      </Field>

      <div>
        <span className="field-label">Amenities</span>
        <div className="check-grid" style={{ marginTop: 8 }}>
          {meta.amenities.map((amenity) => (
            <label key={amenity.id} className="check">
              <input type="checkbox" name="amenity_ids" value={amenity.id} defaultChecked={chosen.has(amenity.id)} />
              {amenity.name}
            </label>
          ))}
        </div>
      </div>

      <div>
        <span className="field-label">Cover illustration</span>
        <div className="cover-grid" style={{ marginTop: 8 }}>
          {meta.covers.map((cover) => (
            <label key={cover} className="cover-option" title={cover.replace('-', ', ')}>
              <input type="radio" name="cover" value={cover} required defaultChecked={cover === (listing?.cover ?? meta.covers[0])} />
              <img src={coverUrl(cover)} alt={cover.replace('-', ' at ')} loading="lazy" />
            </label>
          ))}
        </div>
      </div>

      <div className="form-actions">
        <Link className="btn btn-ghost" to="/host">
          Cancel
        </Link>
        <button className="btn btn-primary" type="submit">
          {editingId ? 'Save changes' : 'Publish listing'}
        </button>
      </div>
    </AsyncForm>
  );
}
