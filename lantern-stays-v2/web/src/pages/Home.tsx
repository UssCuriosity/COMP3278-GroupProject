// Home page: search box, destinations and the best-rated stays.
import { Link } from 'react-router';
import { ListingCard, SearchForm } from '../components';
import { coverUrl, money, plural } from '../format';
import { useMeta, useSearch } from '../hooks';
import { Loading } from '../App';

const CITY_COVERS: Record<string, string> = {
  'Hong Kong': 'harbour-dusk',
  Tokyo: 'skyline-night',
  Seoul: 'village-night',
  Taipei: 'mountain-dusk',
  Bangkok: 'beach-dusk',
  Singapore: 'harbour-night',
};
const FALLBACK_COVERS = ['village-day', 'forest-day', 'mountain-day', 'beach-day', 'skyline-day', 'harbour-day'];

export function Home() {
  const meta = useMeta();
  const top = useSearch('sort=rating&page_size=8');
  if (!meta.data) return <Loading query={meta} />;

  return (
    <>
      <section className="hero">
        <img className="hero-art" src={coverUrl('harbour-dusk')} alt="" />
        <div className="hero-content">
          <p className="eyebrow">Homes, cabins and hideaways across Asia</p>
          <h1>Find a place that feels like yours.</h1>
          <SearchForm meta={meta.data} />
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Popular destinations</h2>
          <Link className="link" to="/search">
            Browse all stays
          </Link>
        </div>
        <div className="city-grid">
          {meta.data.cities.map((city, index) => (
            <Link key={city.city} className="city-card" to={`/search?city=${encodeURIComponent(city.city)}`}>
              <img src={coverUrl(CITY_COVERS[city.city] ?? FALLBACK_COVERS[index % FALLBACK_COVERS.length] ?? 'skyline-day')} alt="" loading="lazy" />
              <div className="city-card-text">
                <strong>{city.city}</strong>
                <span>
                  {plural(city.listing_count, 'stay')} · from {money(city.from_price)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Top-rated stays</h2>
          <Link className="link" to="/search?sort=rating">
            See more
          </Link>
        </div>
        {top.data ? (
          <div className="card-grid">
            {top.data.listings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        ) : (
          <Loading query={top} />
        )}
      </section>
    </>
  );
}
