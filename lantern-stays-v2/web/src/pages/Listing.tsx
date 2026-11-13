// One listing: details, amenities, reviews and the booking form.
import { useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { type ListingPage, api, errorMessage } from '../api';
import { Loading } from '../App';
import { useAuth } from '../auth';
import { FavoriteButton } from '../components';
import { addDays, capitalize, coverUrl, formatDate, formatRange, money, nightsBetween, plural, todayISO } from '../format';
import { useListing } from '../hooks';
import { Field, Icon, Rating, Stars, toast } from '../ui';

export function Listing() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const query = useListing(id);
  if (!query.data) return <Loading query={query} />;

  const { listing, amenities, reviews } = query.data;
  const isMine = user?.id === listing.host_id;

  return (
    <>
      <button className="back-link" type="button" onClick={() => (history.length > 1 ? navigate(-1) : navigate('/search'))}>
        <Icon name="arrowLeft" size={16} />
        Back
      </button>
      <div className="listing-head">
        <div>
          <h1>{listing.title}</h1>
          <p className="listing-sub">
            <Rating avg={listing.avg_rating} count={listing.review_count} />
            <span>
              <Icon name="pin" size={15} /> {listing.city}
            </span>
            <span>{capitalize(listing.property_type)}</span>
          </p>
        </div>
        {!isMine && <FavoriteButton listing={listing} />}
      </div>
      <img className="listing-cover" src={coverUrl(listing.cover)} alt="" />

      <div className="listing-layout">
        <div className="listing-main">
          <section className="block">
            <h2>
              {capitalize(listing.property_type)} hosted by {listing.host_name}
            </h2>
            <ul className="facts">
              <li>
                <Icon name="users" />
                {plural(listing.max_guests, 'guest')}
              </li>
              <li>
                <Icon name="bed" />
                {plural(listing.bedrooms, 'bedroom')}
              </li>
              <li>
                <Icon name="bath" />
                {plural(listing.bathrooms, 'bathroom')}
              </li>
            </ul>
            <p className="description">{listing.description}</p>
          </section>

          <section className="block">
            <h2>What this place offers</h2>
            {amenities.length ? (
              <ul className="amenities">
                {amenities.map((amenity) => (
                  <li key={amenity.id}>
                    <Icon name="check" size={16} />
                    {amenity.name}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">No amenities listed.</p>
            )}
          </section>

          <section className="block">
            <h2>{reviews.length && listing.avg_rating !== null ? `${plural(reviews.length, 'review')} · ${listing.avg_rating.toFixed(1)} average` : 'No reviews yet'}</h2>
            {reviews.length ? (
              <div className="reviews">
                {reviews.map((review) => (
                  <article key={review.id} className="review">
                    <div className="review-head">
                      <span className="avatar avatar-sm">{review.guest_name[0]}</span>
                      <div>
                        <strong>{review.guest_name}</strong>
                        <span className="muted">{formatDate(review.created_at)}</span>
                      </div>
                      <Stars value={review.rating} />
                    </div>
                    <p>{review.comment}</p>
                  </article>
                ))}
              </div>
            ) : (
              <p className="muted">Guests can leave a review after their stay.</p>
            )}
          </section>
        </div>

        <BookingCard page={query.data} isMine={isMine} />
      </div>
    </>
  );
}

function BookingCard({ page: { listing, booked }, isMine }: { page: ListingPage; isMine: boolean }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { ensureLogin } = useAuth();
  const [params, setParams] = useSearchParams();
  const [busy, setBusy] = useState(false);
  const today = todayISO();

  // The chosen stay lives in the address bar, so it survives logging in or a refresh.
  const checkIn = params.get('check_in') ?? '';
  const checkOut = params.get('check_out') ?? '';
  const guests = Math.min(Number(params.get('guests')) || 1, listing.max_guests);
  function change(changes: Record<string, string>) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setParams(next, { replace: true });
  }

  const ready = Boolean(checkIn && checkOut && checkOut > checkIn);
  const nights = ready ? nightsBetween(checkIn, checkOut) : 0;
  const clash = ready && booked.some((range) => range.check_in < checkOut && range.check_out > checkIn);

  async function reserve(event: FormEvent) {
    event.preventDefault();
    if (!(await ensureLogin())) return;
    setBusy(true);
    try {
      await api('POST', '/bookings', { listing_id: listing.id, check_in: checkIn, check_out: checkOut, guests });
      await queryClient.invalidateQueries();
      toast('Booking confirmed. Enjoy your stay!');
      navigate('/trips');
    } catch (error) {
      toast(errorMessage(error), 'error');
      setBusy(false);
    }
  }

  return (
    <aside className="booking-card">
      <p className="booking-price">
        <strong>{money(listing.price_per_night)}</strong> / night
      </p>

      {isMine ? (
        <>
          <p className="notice">This is your listing.</p>
          <Link className="btn btn-primary btn-block" to={`/host/edit/${listing.id}`}>
            Edit listing
          </Link>
        </>
      ) : !listing.is_active ? (
        <p className="notice notice-warn">The host has paused this listing. It is not accepting bookings right now.</p>
      ) : (
        <form className="stack" onSubmit={reserve}>
          <div className="date-pair">
            <Field label="Check in">
              <input
                type="date"
                name="check_in"
                required
                min={today}
                value={checkIn}
                onChange={(e) => {
                  const value = e.target.value;
                  change({ check_in: value, check_out: value && (!checkOut || checkOut <= value) ? addDays(value, 1) : checkOut });
                }}
              />
            </Field>
            <Field label="Check out">
              <input type="date" name="check_out" required min={checkIn ? addDays(checkIn, 1) : addDays(today, 1)} value={checkOut} onChange={(e) => change({ check_out: e.target.value })} />
            </Field>
          </div>
          <Field label="Guests">
            <select name="guests" value={guests} onChange={(e) => change({ guests: e.target.value })}>
              {Array.from({ length: listing.max_guests }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {plural(i + 1, 'guest')}
                </option>
              ))}
            </select>
          </Field>
          <div className="price-summary">
            {ready ? (
              <>
                <div className="price-row">
                  <span>
                    {money(listing.price_per_night)} × {plural(nights, 'night')}
                  </span>
                  <span>{money(listing.price_per_night * nights)}</span>
                </div>
                <div className="price-row price-total">
                  <span>Total</span>
                  <span>{money(listing.price_per_night * nights)}</span>
                </div>
                {clash && <p className="notice notice-warn">These dates overlap an existing booking.</p>}
              </>
            ) : (
              <p className="muted">Pick your dates to see the total.</p>
            )}
          </div>
          <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
            Reserve
          </button>
        </form>
      )}

      {booked.length > 0 && (
        <div className="booked">
          <h3>
            <Icon name="calendar" size={15} /> Already booked
          </h3>
          <ul>
            {booked.map((range) => (
              <li key={range.check_in}>{formatRange(range.check_in, range.check_out)}</li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  );
}
