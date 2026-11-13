// Shapes of the rows the API returns. The React app imports these types too,
// so the server and the browser always agree on the data.

// One SQL statement the server ran for a request (shown in the SQL inspector).
export interface SqlLogEntry {
  sql: string;
  params: unknown[];
  rows?: number; // SELECT: rows returned
  affected?: number; // INSERT / UPDATE / DELETE: rows affected
  error?: string;
  ms?: number;
}

export type PropertyType = 'apartment' | 'studio' | 'house' | 'villa' | 'cabin' | 'room';
export type Flag = 0 | 1; // MySQL returns booleans as 0 / 1

export interface User {
  id: number;
  name: string;
  email: string;
}

export interface City {
  city: string;
  listing_count: number;
  from_price: number;
}

export interface Amenity {
  id: number;
  name: string;
}

export interface Meta {
  cities: City[];
  amenities: Amenity[];
  propertyTypes: PropertyType[];
  covers: string[];
}

export interface ListingSummary {
  id: number;
  title: string;
  city: string;
  property_type: PropertyType;
  price_per_night: number;
  max_guests: number;
  bedrooms: number;
  bathrooms: number;
  cover: string;
  host_name: string;
  avg_rating: number | null;
  review_count: number;
  is_favorite: Flag;
}

export interface SearchResult {
  listings: ListingSummary[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ListingDetail extends ListingSummary {
  host_id: number;
  description: string;
  is_active: Flag;
  host_since: string;
}

export interface Review {
  id: number;
  rating: number;
  comment: string;
  created_at: string;
  guest_name: string;
}

export interface DateRange {
  check_in: string;
  check_out: string;
}

export interface ListingPage {
  listing: ListingDetail;
  amenities: Amenity[];
  reviews: Review[];
  booked: DateRange[];
}

export type TripPhase = 'upcoming' | 'current' | 'past' | 'cancelled';

export interface Trip {
  id: number;
  listing_id: number;
  check_in: string;
  check_out: string;
  guests: number;
  nightly_price: number;
  status: 'confirmed' | 'cancelled';
  nights: number;
  total_price: number;
  phase: TripPhase;
  title: string;
  city: string;
  cover: string;
  max_guests: number;
  host_name: string;
  review_rating: number | null;
  review_comment: string | null;
}

export interface HostListing {
  id: number;
  title: string;
  city: string;
  property_type: PropertyType;
  price_per_night: number;
  cover: string;
  is_active: Flag;
  booking_count: number;
  upcoming_count: number;
  nights_booked: number;
  revenue: number;
  avg_rating: number | null;
  review_count: number;
}

export interface Reservation {
  id: number;
  check_in: string;
  check_out: string;
  guests: number;
  status: 'confirmed' | 'cancelled';
  nights: number;
  total_price: number;
  listing_id: number;
  title: string;
  guest_name: string;
}

export interface HostDashboard {
  listings: HostListing[];
  reservations: Reservation[];
}
