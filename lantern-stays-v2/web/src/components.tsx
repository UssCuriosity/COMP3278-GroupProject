// Components shared by several pages.
import { type FormEvent, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router';
import { type ListingSummary, type Meta, api } from './api';
import { useAuth } from './auth';
import { addDays, capitalize, coverUrl, money, plural, todayISO } from './format';
import { useAction } from './hooks';
import { Icon, Rating } from './ui';

export function Header() {
  const { user, openAuth, logout } = useAuth();
  const { pathname } = useLocation();
  const link = (to: string, label: string, alsoActive = false) => (
    <NavLink to={to} className={({ isActive }) => `nav-link${isActive || alsoActive ? ' is-active' : ''}`}>
      {label}
    </NavLink>
  );
  return (
    <header className="site-header">
      <div className="header-inner">
        <Link className="brand" to="/">
          <img src="/img/favicon.svg" alt="" width={30} height={30} />
          <span>Lantern Stays</span>
        </Link>
        <nav className="nav">
          {link('/search', 'Explore', pathname.startsWith('/listing'))}
          {link('/trips', 'Trips')}
          {link('/saved', 'Saved')}
          {link('/host', 'Host')}
        </nav>
        {user ? (
          <div className="user">
            <span className="avatar">
              {user.name
                .split(/\s+/)
                .map((word) => word[0])
                .join('')
                .slice(0, 2)
                .toUpperCase()}
            </span>
            <span className="user-name">{user.name}</span>
            <button className="btn btn-ghost btn-sm" type="button" onClick={logout}>
              Log out
            </button>
          </div>
        ) : (
          <div className="user">
            <button className="btn btn-ghost btn-sm" type="button" onClick={() => openAuth('login')}>
              Log in
            </button>
            <button className="btn btn-primary btn-sm" type="button" onClick={() => openAuth('register')}>
              Sign up
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

// Heart button: INSERT / DELETE a row in the favorites table.
export function FavoriteButton({ listing }: { listing: Pick<ListingSummary, 'id' | 'is_favorite'> }) {
  const { ensureLogin } = useAuth();
  const run = useAction();
  const saved = Boolean(listing.is_favorite);
  return (
    <button
      className={`fav-btn${saved ? ' is-saved' : ''}`}
      type="button"
      aria-label={saved ? 'Remove from saved' : 'Save this stay'}
      onClick={async (event) => {
        event.preventDefault(); // the button sits inside a link
        if (!(await ensureLogin())) return;
        await run(() => api(saved ? 'DELETE' : 'PUT', `/favorites/${listing.id}`), saved ? 'Removed from your list.' : 'Saved to your list.');
      }}
    >
      <Icon name="heart" filled={saved} />
    </button>
  );
}

// A listing tile. `stay` (dates, guests) is carried into the link.
export function ListingCard({ listing, stay = '', nights = 0 }: { listing: ListingSummary; stay?: string; nights?: number }) {
  return (
    <Link className="card" to={`/listing/${listing.id}${stay ? `?${stay}` : ''}`}>
      <div className="card-cover">
        <img src={coverUrl(listing.cover)} alt="" loading="lazy" />
        <FavoriteButton listing={listing} />
      </div>
      <div className="card-body">
        <div className="card-top">
          <span className="card-place">
            {listing.city} · {capitalize(listing.property_type)}
          </span>
          <Rating avg={listing.avg_rating} count={listing.review_count} />
        </div>
        <h3 className="card-title">{listing.title}</h3>
        <p className="card-meta">
          {plural(listing.max_guests, 'guest')} · {plural(listing.bedrooms, 'bedroom')} · {plural(listing.bathrooms, 'bath')}
        </p>
        <p className="card-price">
          <strong>{money(listing.price_per_night)}</strong> / night
          {nights > 0 && <span className="muted"> · {money(listing.price_per_night * nights)} total</span>}
        </p>
      </div>
    </Link>
  );
}

// "Where / check-in / check-out / guests" form on the home and search pages.
// `keep` carries the current filters (sort, type ...) into the new search.
export function SearchForm({ meta, values, keep }: { meta: Meta; values?: URLSearchParams; keep?: URLSearchParams }) {
  const navigate = useNavigate();
  const today = todayISO();
  const [city, setCity] = useState(values?.get('city') ?? '');
  const [checkIn, setCheckIn] = useState(values?.get('check_in') ?? '');
  const [checkOut, setCheckOut] = useState(values?.get('check_out') ?? '');
  const [guests, setGuests] = useState(values?.get('guests') ?? '');
  const [problem, setProblem] = useState('');

  function changeCheckIn(value: string) {
    setCheckIn(value);
    // keep check-out after check-in
    if (value && (!checkOut || checkOut <= value)) setCheckOut(addDays(value, 1));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (Boolean(checkIn) !== Boolean(checkOut)) {
      setProblem('Please pick both a check-in and a check-out date.');
      return;
    }
    const params = new URLSearchParams(keep);
    params.delete('page');
    for (const [key, value] of Object.entries({ city, check_in: checkIn, check_out: checkOut, guests })) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    navigate(`/search?${params}`);
  }

  return (
    <form className="search-form" onSubmit={submit}>
      <label className="field">
        <span className="field-label">Where</span>
        <select name="city" value={city} onChange={(e) => setCity(e.target.value)}>
          <option value="">Anywhere</option>
          {meta.cities.map((c) => (
            <option key={c.city} value={c.city}>
              {c.city}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span className="field-label">Check in</span>
        <input type="date" name="check_in" min={today} value={checkIn} onChange={(e) => changeCheckIn(e.target.value)} />
      </label>
      <label className="field">
        <span className="field-label">Check out</span>
        <input type="date" name="check_out" min={checkIn ? addDays(checkIn, 1) : addDays(today, 1)} value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
      </label>
      <label className="field">
        <span className="field-label">Guests</span>
        <input type="number" name="guests" min={1} max={16} placeholder="Any" value={guests} onChange={(e) => setGuests(e.target.value)} />
      </label>
      <button className="btn btn-primary search-submit" type="submit">
        <Icon name="search" />
        Search
      </button>
      {problem && (
        <p className="form-error" role="alert" style={{ gridColumn: '1 / -1' }}>
          {problem}
        </p>
      )}
    </form>
  );
}
