// Host dashboard: statistics per listing, reservations, and listing management.
import { useState } from 'react';
import { Link } from 'react-router';
import { type HostListing, type Reservation, api } from '../api';
import { Loading } from '../App';
import { capitalize, coverUrl, formatRange, money, plural, todayISO } from '../format';
import { useAction, useDashboard } from '../hooks';
import { ConfirmDialog, type ConfirmRequest, EmptyState, Icon, Rating } from '../ui';

export function Host() {
  const query = useDashboard();
  const run = useAction();
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  if (!query.data) return <Loading query={query} />;

  const { listings, reservations } = query.data;
  const sum = (key: 'upcoming_count' | 'nights_booked' | 'revenue') => listings.reduce((total, listing) => total + Number(listing[key]), 0);

  // UPDATE listings SET is_active
  const setActive = (listing: HostListing) =>
    run(() => api('PATCH', `/host/listings/${listing.id}/active`, { is_active: !listing.is_active }), listing.is_active ? 'Listing paused. It no longer appears in search.' : 'Listing is live again.');

  // DELETE FROM listings (MySQL refuses if the listing has bookings)
  const remove = (listing: HostListing) =>
    setConfirm({
      title: 'Delete this listing?',
      message: `"${listing.title}" will be removed permanently.`,
      confirmLabel: 'Delete listing',
      onConfirm: () => run(() => api('DELETE', `/host/listings/${listing.id}`), 'Listing deleted.'),
    });

  const newListing = (
    <Link className="btn btn-primary" to="/host/new">
      <Icon name="plus" size={16} />
      New listing
    </Link>
  );

  return (
    <>
      <div className="page-head">
        <h1>Host dashboard</h1>
        {newListing}
      </div>

      {listings.length === 0 ? (
        <EmptyState title="Become a host" text="Publish your first place and start receiving bookings." action={newListing} />
      ) : (
        <>
          <div className="tiles">
            <Tile label="Listings" value={String(listings.length)} note={`${listings.filter((l) => l.is_active).length} active`} />
            <Tile label="Upcoming reservations" value={String(sum('upcoming_count'))} />
            <Tile label="Nights booked" value={String(sum('nights_booked'))} note="confirmed stays" />
            <Tile label="Revenue" value={money(sum('revenue'))} note="confirmed stays" />
          </div>

          <section className="section">
            <h2>Your listings</h2>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    {['Listing', 'Price', 'Bookings', 'Nights', 'Revenue', 'Rating', ''].map((heading) => (
                      <th key={heading}>{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {listings.map((listing) => (
                    <tr key={listing.id} className={listing.is_active ? '' : 'row-paused'}>
                      <td>
                        <Link className="row-listing" to={`/listing/${listing.id}`}>
                          <img src={coverUrl(listing.cover)} alt="" loading="lazy" />
                          <span>
                            <strong>{listing.title}</strong>
                            <span className="muted">
                              {listing.city} · {capitalize(listing.property_type)}
                            </span>
                            {!listing.is_active && <span className="status status-cancelled">Paused</span>}
                          </span>
                        </Link>
                      </td>
                      <td>{money(listing.price_per_night)}</td>
                      <td>
                        {listing.booking_count}
                        {listing.upcoming_count > 0 && <span className="muted"> ({listing.upcoming_count} upcoming)</span>}
                      </td>
                      <td>{listing.nights_booked}</td>
                      <td>
                        <strong>{money(listing.revenue)}</strong>
                      </td>
                      <td>
                        <Rating avg={listing.avg_rating} count={listing.review_count} />
                      </td>
                      <td>
                        <div className="row-actions">
                          <Link className="icon-btn" to={`/host/edit/${listing.id}`} title="Edit listing" aria-label={`Edit ${listing.title}`}>
                            <Icon name="edit" />
                          </Link>
                          <button className="icon-btn" type="button" title={listing.is_active ? 'Pause (hide from search)' : 'Activate (show in search)'} aria-label={`${listing.is_active ? 'Pause' : 'Activate'} ${listing.title}`} onClick={() => setActive(listing)}>
                            <Icon name={listing.is_active ? 'pause' : 'play'} />
                          </button>
                          <button className="icon-btn icon-btn-danger" type="button" title="Delete listing" aria-label={`Delete ${listing.title}`} onClick={() => remove(listing)}>
                            <Icon name="trash" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="section">
            <h2>Current and upcoming reservations ({reservations.length})</h2>
            {reservations.length ? (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      {['Guest', 'Listing', 'Dates', 'Guests', 'Total', 'Status'].map((heading) => (
                        <th key={heading}>{heading}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {reservations.map((reservation) => (
                      <ReservationRow key={reservation.id} reservation={reservation} />
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="muted">No reservations coming up.</p>
            )}
          </section>
        </>
      )}

      {confirm && <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />}
    </>
  );
}

function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="tile">
      <span className="tile-label">{label}</span>
      <strong className="tile-value">{value}</strong>
      {note && <span className="tile-note">{note}</span>}
    </div>
  );
}

function ReservationRow({ reservation }: { reservation: Reservation }) {
  const phase = reservation.status === 'cancelled' ? 'cancelled' : reservation.check_in <= todayISO() ? 'current' : 'upcoming';
  const label = { cancelled: 'Cancelled', current: 'Staying now', upcoming: 'Confirmed' }[phase];
  return (
    <tr>
      <td>
        <strong>{reservation.guest_name}</strong>
      </td>
      <td>
        <Link className="link" to={`/listing/${reservation.listing_id}`}>
          {reservation.title}
        </Link>
      </td>
      <td>
        {formatRange(reservation.check_in, reservation.check_out)}
        <span className="muted"> · {plural(reservation.nights, 'night')}</span>
      </td>
      <td>{reservation.guests}</td>
      <td>{money(reservation.total_price)}</td>
      <td>
        <span className={`status status-${phase}`}>{label}</span>
      </td>
    </tr>
  );
}
