// My trips: change or cancel upcoming stays, review finished ones.
import { useState } from 'react';
import { Link } from 'react-router';
import { type Trip, type TripPhase, api } from '../api';
import { Loading } from '../App';
import { addDays, coverUrl, formatRange, money, plural, todayISO } from '../format';
import { useAction, useRefresh, useTrips } from '../hooks';
import { AsyncForm, ConfirmDialog, type ConfirmRequest, EmptyState, Field, Modal, Stars, toast } from '../ui';

const PHASE_LABELS: Record<TripPhase, string> = { upcoming: 'Upcoming', current: 'Staying now', past: 'Completed', cancelled: 'Cancelled' };

type Dialog = { kind: 'change' | 'review'; trip: Trip } | { kind: 'confirm'; request: ConfirmRequest } | null;

export function Trips() {
  const query = useTrips();
  const run = useAction();
  const [dialog, setDialog] = useState<Dialog>(null);
  if (!query.data) return <Loading query={query} />;

  const bookings = query.data.bookings;
  const upcoming = bookings.filter((b) => b.phase === 'upcoming' || b.phase === 'current').reverse(); // soonest first
  const past = bookings.filter((b) => b.phase === 'past');
  const cancelled = bookings.filter((b) => b.phase === 'cancelled');
  const close = () => setDialog(null);

  // UPDATE bookings SET status = 'cancelled'
  const cancel = (trip: Trip) =>
    setDialog({
      kind: 'confirm',
      request: {
        title: 'Cancel this booking?',
        message: `${trip.title}, ${formatRange(trip.check_in, trip.check_out)}. The dates become available to other guests.`,
        confirmLabel: 'Cancel booking',
        onConfirm: () => run(() => api('POST', `/bookings/${trip.id}/cancel`), 'Booking cancelled.'),
      },
    });

  // DELETE FROM reviews
  const deleteReview = (trip: Trip) =>
    setDialog({
      kind: 'confirm',
      request: {
        title: 'Delete your review?',
        message: 'Your rating and comment will be removed from the listing.',
        confirmLabel: 'Delete review',
        onConfirm: () => run(() => api('DELETE', `/bookings/${trip.id}/review`), 'Review deleted.'),
      },
    });

  const actions = (trip: Trip) => {
    if (trip.phase === 'upcoming') {
      return (
        <div className="actions">
          <button className="btn btn-ghost btn-sm" type="button" onClick={() => setDialog({ kind: 'change', trip })}>
            Change dates
          </button>
          <button className="btn btn-ghost btn-sm btn-danger-text" type="button" onClick={() => cancel(trip)}>
            Cancel booking
          </button>
        </div>
      );
    }
    if (trip.phase === 'cancelled') {
      return (
        <div className="actions">
          {/* DELETE FROM bookings */}
          <button className="btn btn-ghost btn-sm btn-danger-text" type="button" onClick={() => run(() => api('DELETE', `/bookings/${trip.id}`), 'Removed from your history.')}>
            Remove from history
          </button>
        </div>
      );
    }
    if (trip.phase === 'past' && trip.review_rating === null) {
      return (
        <div className="actions">
          <button className="btn btn-primary btn-sm" type="button" onClick={() => setDialog({ kind: 'review', trip })}>
            Write a review
          </button>
        </div>
      );
    }
    if (trip.phase === 'past' && trip.review_rating !== null) {
      return (
        <div className="my-review">
          <div className="my-review-head">
            <span className="muted">Your review</span>
            <Stars value={trip.review_rating} />
          </div>
          <p>{trip.review_comment}</p>
          <div className="actions">
            <button className="btn btn-ghost btn-sm" type="button" onClick={() => setDialog({ kind: 'review', trip })}>
              Edit review
            </button>
            <button className="btn btn-ghost btn-sm btn-danger-text" type="button" onClick={() => deleteReview(trip)}>
              Delete review
            </button>
          </div>
        </div>
      );
    }
    return null;
  };

  const group = (title: string, items: Trip[], emptyText: string) => (
    <section className="section">
      <h2>
        {title} ({items.length})
      </h2>
      {items.length ? (
        <div className="trip-list">
          {items.map((trip) => (
            <article key={trip.id} className={`trip trip-${trip.phase}`}>
              <Link className="trip-cover" to={`/listing/${trip.listing_id}`}>
                <img src={coverUrl(trip.cover)} alt="" loading="lazy" />
              </Link>
              <div className="trip-body">
                <div className="trip-top">
                  <span className={`status status-${trip.phase}`}>{PHASE_LABELS[trip.phase]}</span>
                  <span className="muted">Booking #{trip.id}</span>
                </div>
                <h3>
                  <Link to={`/listing/${trip.listing_id}`}>{trip.title}</Link>
                </h3>
                <p className="muted">
                  {trip.city} · hosted by {trip.host_name}
                </p>
                <p className="trip-facts">
                  <strong>{formatRange(trip.check_in, trip.check_out)}</strong> · {plural(trip.guests, 'guest')} · {plural(trip.nights, 'night')} × {money(trip.nightly_price)} = <strong>{money(trip.total_price)}</strong>
                </p>
                {actions(trip)}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="muted">{emptyText}</p>
      )}
    </section>
  );

  return (
    <>
      <div className="page-head">
        <h1>Your trips</h1>
        <Link className="btn btn-ghost" to="/search">
          Find another stay
        </Link>
      </div>

      {bookings.length === 0 ? (
        <EmptyState
          title="No trips yet"
          text="When you book a stay it will appear here."
          action={
            <Link className="btn btn-primary" to="/search">
              Explore stays
            </Link>
          }
        />
      ) : (
        <>
          {group('Upcoming', upcoming, 'Nothing booked at the moment.')}
          {group('Past stays', past, 'Finished stays show up here, ready for your review.')}
          {cancelled.length > 0 && group('Cancelled', cancelled, '')}
        </>
      )}

      {dialog?.kind === 'change' && <ChangeDialog trip={dialog.trip} onClose={close} />}
      {dialog?.kind === 'review' && <ReviewDialog trip={dialog.trip} onClose={close} />}
      {dialog?.kind === 'confirm' && <ConfirmDialog request={dialog.request} onClose={close} />}
    </>
  );
}

// UPDATE bookings SET check_in, check_out, guests
function ChangeDialog({ trip, onClose }: { trip: Trip; onClose: () => void }) {
  const refresh = useRefresh();
  const [checkIn, setCheckIn] = useState(trip.check_in);
  const [checkOut, setCheckOut] = useState(trip.check_out);
  return (
    <Modal title="Change your booking" onClose={onClose}>
      <AsyncForm
        onSubmit={async (data) => {
          await api('PATCH', `/bookings/${trip.id}`, { check_in: checkIn, check_out: checkOut, guests: Number(data.get('guests')) });
          await refresh();
          onClose();
          toast('Booking updated.');
        }}
      >
        <p className="modal-text">{trip.title}</p>
        <div className="date-pair">
          <Field label="Check in">
            <input
              type="date"
              name="check_in"
              required
              min={todayISO()}
              value={checkIn}
              onChange={(e) => {
                setCheckIn(e.target.value);
                if (e.target.value && checkOut <= e.target.value) setCheckOut(addDays(e.target.value, 1));
              }}
            />
          </Field>
          <Field label="Check out">
            <input type="date" name="check_out" required min={checkIn ? addDays(checkIn, 1) : undefined} value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
          </Field>
        </div>
        <Field label="Guests">
          <select name="guests" defaultValue={trip.guests}>
            {Array.from({ length: trip.max_guests }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {plural(i + 1, 'guest')}
              </option>
            ))}
          </select>
        </Field>
        <p className="field-hint">The price stays at {money(trip.nightly_price)} per night, as booked.</p>
        <div className="modal-actions">
          <button className="btn btn-primary" type="submit">
            Save changes
          </button>
        </div>
      </AsyncForm>
    </Modal>
  );
}

// INSERT INTO reviews / UPDATE reviews
function ReviewDialog({ trip, onClose }: { trip: Trip; onClose: () => void }) {
  const refresh = useRefresh();
  const editing = trip.review_rating !== null;
  return (
    <Modal title={editing ? 'Edit your review' : 'Review your stay'} onClose={onClose}>
      <AsyncForm
        onSubmit={async (data) => {
          await api(editing ? 'PUT' : 'POST', `/bookings/${trip.id}/review`, { rating: Number(data.get('rating')), comment: data.get('comment') });
          await refresh();
          onClose();
          toast(editing ? 'Review updated.' : 'Thanks for your review!');
        }}
      >
        <p className="modal-text">{trip.title}</p>
        <div className="star-picker" role="radiogroup" aria-label="Rating">
          {[5, 4, 3, 2, 1].flatMap((value) => [
            <input key={`input-${value}`} type="radio" name="rating" id={`rating-${value}`} value={value} defaultChecked={value === (trip.review_rating ?? 5)} />,
            <label key={`label-${value}`} htmlFor={`rating-${value}`} title={plural(value, 'star')}>
              ★
            </label>,
          ])}
        </div>
        <Field label="Your review">
          <textarea name="comment" rows={4} required minLength={10} maxLength={1000} placeholder="What was the stay like?" defaultValue={trip.review_comment ?? ''} />
        </Field>
        <div className="modal-actions">
          <button className="btn btn-primary" type="submit">
            {editing ? 'Save review' : 'Post review'}
          </button>
        </div>
      </AsyncForm>
    </Modal>
  );
}
