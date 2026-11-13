// Search results with filters and pagination. All filter values live in the
// URL, so every change simply navigates to a new /search?... address.
import { useSearchParams } from 'react-router';
import { Loading } from '../App';
import { ListingCard, SearchForm } from '../components';
import { capitalize, formatRange, nightsBetween, plural } from '../format';
import { useMeta, useSearch } from '../hooks';
import { EmptyState } from '../ui';

const SORTS = [
  ['rating', 'Top rated'],
  ['price_asc', 'Price: low to high'],
  ['price_desc', 'Price: high to low'],
  ['newest', 'Newest'],
] as const;

export function Search() {
  const [params, setParams] = useSearchParams();
  const meta = useMeta();
  const results = useSearch(params.toString());

  // Change some filters; any change except "page" goes back to page 1.
  function update(changes: Record<string, string>) {
    const next = new URLSearchParams(params);
    if (!('page' in changes)) next.delete('page');
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setParams(next);
  }

  if (!meta.data) return <Loading query={meta} />;

  const get = (key: string) => params.get(key) ?? '';
  const selectedAmenities = new Set(get('amenities').split(',').filter(Boolean));
  const hasDates = Boolean(get('check_in') && get('check_out'));
  const nights = hasDates ? nightsBetween(get('check_in'), get('check_out')) : 0;
  const stay = new URLSearchParams(['check_in', 'check_out', 'guests'].flatMap((key) => (get(key) ? [[key, get(key)]] : []))).toString();
  const filtersActive = ['type', 'min_price', 'max_price', 'amenities'].some((key) => get(key));
  const data = results.data;
  const pageCount = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  const priceInput = (name: string, placeholder: string) => (
    <input key={`${name}-${get(name)}`} type="number" min={0} step={50} placeholder={placeholder} defaultValue={get(name)} onBlur={(e) => e.target.value !== get(name) && update({ [name]: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} />
  );

  return (
    <>
      <div className="search-bar">
        <SearchForm key={params.toString()} meta={meta.data} values={params} keep={params} />
      </div>
      <div className="search-layout">
        <aside className="filters">
          <div className="filter-group">
            <h3>Sort by</h3>
            <select value={get('sort') || 'rating'} onChange={(e) => update({ sort: e.target.value })}>
              {SORTS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <h3>Property type</h3>
            <div className="chip-row">
              {['', ...meta.data.propertyTypes].map((type) => (
                <button key={type} className={`chip chip-button${get('type') === type ? ' is-on' : ''}`} type="button" onClick={() => update({ type })}>
                  {type ? capitalize(type) : 'Any'}
                </button>
              ))}
            </div>
          </div>
          <div className="filter-group">
            <h3>Price per night (HK$)</h3>
            <div className="price-range">
              {priceInput('min_price', 'Min')}
              <span>–</span>
              {priceInput('max_price', 'Max')}
            </div>
          </div>
          <div className="filter-group">
            <h3>Amenities</h3>
            <p className="field-hint">Shows stays that have all selected amenities.</p>
            <div className="chip-row">
              {meta.data.amenities.map((amenity) => {
                const id = String(amenity.id);
                const on = selectedAmenities.has(id);
                return (
                  <button
                    key={id}
                    className={`chip chip-button${on ? ' is-on' : ''}`}
                    type="button"
                    aria-pressed={on}
                    onClick={() => {
                      const next = new Set(selectedAmenities);
                      if (on) next.delete(id);
                      else next.add(id);
                      update({ amenities: [...next].join(',') });
                    }}
                  >
                    {amenity.name}
                  </button>
                );
              })}
            </div>
          </div>
          {filtersActive && (
            <button className="btn btn-ghost btn-sm" type="button" onClick={() => update({ type: '', min_price: '', max_price: '', amenities: '' })}>
              Clear filters
            </button>
          )}
        </aside>

        <section className="results">
          {!data ? (
            <Loading query={results} />
          ) : (
            <div className={results.isPlaceholderData ? 'is-refreshing' : ''}>
              <div className="results-head">
                <h1>
                  {plural(data.total, 'stay')} {get('city') ? `in ${get('city')}` : 'anywhere'}
                  {hasDates && ` · ${formatRange(get('check_in'), get('check_out'))}`}
                  {get('guests') && ` · ${plural(Number(get('guests')), 'guest')}`}
                </h1>
                {hasDates && <p className="muted">Only places that are free for your whole stay are shown.</p>}
              </div>
              {data.listings.length ? (
                <div className="card-grid">
                  {data.listings.map((listing) => (
                    <ListingCard key={listing.id} listing={listing} stay={stay} nights={nights} />
                  ))}
                </div>
              ) : (
                <EmptyState title="No stays match" text="Try different dates, a wider price range or fewer amenities." />
              )}
              {pageCount > 1 && (
                <nav className="pagination" aria-label="Pages">
                  <button className="btn btn-ghost btn-sm" type="button" disabled={data.page <= 1} onClick={() => update({ page: String(data.page - 1) })}>
                    Previous
                  </button>
                  <span>
                    Page {data.page} of {pageCount}
                  </span>
                  <button className="btn btn-ghost btn-sm" type="button" disabled={data.page >= pageCount} onClick={() => update({ page: String(data.page + 1) })}>
                    Next
                  </button>
                </nav>
              )}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
