// Saved stays (the favorites table).
import { Link } from 'react-router';
import { Loading } from '../App';
import { ListingCard } from '../components';
import { plural } from '../format';
import { useFavorites } from '../hooks';
import { EmptyState } from '../ui';

export function Saved() {
  const query = useFavorites();
  if (!query.data) return <Loading query={query} />;
  const { listings } = query.data;

  return (
    <>
      <div className="page-head">
        <h1>Saved stays</h1>
        <span className="muted">{plural(listings.length, 'stay')}</span>
      </div>
      {listings.length ? (
        <div className="card-grid">
          {listings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="Nothing saved yet"
          text="Tap the heart on any stay to keep it here."
          action={
            <Link className="btn btn-primary" to="/search">
              Explore stays
            </Link>
          }
        />
      )}
    </>
  );
}
