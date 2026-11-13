// Zod schemas: the single definition of what valid input looks like.
// Routes validate with them, and the TypeScript types are derived from them.
import { z } from 'zod';

export const PROPERTY_TYPES = ['apartment', 'studio', 'house', 'villa', 'cabin', 'room'] as const;

// Cover illustrations shipped in web/public/img/covers/<name>.svg
export const COVERS = ['skyline', 'harbour', 'beach', 'mountain', 'forest', 'village'].flatMap((scene) =>
  ['day', 'dusk', 'night'].map((time) => `${scene}-${time}`)
);

export const MAX_NIGHTS = 30;
export const SORTS = ['rating', 'price_asc', 'price_desc', 'newest'] as const;

const DAY_MS = 86_400_000;
export const nightsBetween = (checkIn: string, checkOut: string) => Math.round((Date.parse(checkOut) - Date.parse(checkIn)) / DAY_MS);

// ---- small building blocks -------------------------------------------------
const id = (label: string) => z.coerce.number({ error: `${label} must be a number.` }).int().positive();
const isoDate = (label: string) => z.iso.date({ error: `${label} must be a valid date.` });
const wholeNumber = (label: string, min: number, max: number) =>
  z.coerce
    .number({ error: `${label} must be a whole number.` })
    .int(`${label} must be a whole number.`)
    .min(min, `${label} must be between ${min} and ${max}.`)
    .max(max, `${label} must be between ${min} and ${max}.`);
const text = (label: string, min: number, max: number) =>
  z
    .string({ error: `${label} is required.` })
    .trim()
    .min(min, min > 1 ? `${label} must be at least ${min} characters.` : `${label} is required.`)
    .max(max, `${label} must be at most ${max} characters.`);

// ---- URL parameters ---------------------------------------------------------
export const idParams = z.object({ id: id('Id') });

// ---- auth -------------------------------------------------------------------
const email = z.email({ error: 'Please enter a valid email address.' }).max(254).transform((value) => value.toLowerCase());

export const registerBody = z.object({
  name: text('Name', 1, 100),
  email,
  password: z.string({ error: 'Password is required.' }).min(8, 'Password must be at least 8 characters.').max(200),
});

export const loginBody = z.object({
  email,
  password: z.string({ error: 'Password is required.' }),
});

// ---- search -----------------------------------------------------------------
export const searchQuery = z
  .object({
    city: text('City', 1, 80).optional(),
    type: z.enum(PROPERTY_TYPES, { error: 'Property type is not a valid choice.' }).optional(),
    guests: wholeNumber('Guests', 1, 16).optional(),
    min_price: z.coerce.number({ error: 'Minimum price must be a number.' }).min(0).optional(),
    max_price: z.coerce.number({ error: 'Maximum price must be a number.' }).min(0).optional(),
    check_in: isoDate('Check-in').optional(),
    check_out: isoDate('Check-out').optional(),
    // "1,9" -> [1, 9]
    amenities: z
      .string()
      .transform((value) => [...new Set(value.split(',').filter(Boolean).map(Number))])
      .refine((ids) => ids.every((n) => Number.isInteger(n) && n > 0), 'Amenities must be a list of ids.')
      .optional(),
    sort: z.enum(SORTS).default('rating'),
    page: wholeNumber('Page', 1, 10_000).default(1),
    page_size: wholeNumber('Page size', 1, 50).default(12),
  })
  .refine((q) => Boolean(q.check_in) === Boolean(q.check_out), 'Please pick both a check-in and a check-out date.')
  .refine((q) => !q.check_in || !q.check_out || q.check_out > q.check_in, 'Check-out must be after check-in.');

export type SearchQuery = z.infer<typeof searchQuery>;

// ---- bookings ---------------------------------------------------------------
const stay = {
  check_in: isoDate('Check-in'),
  check_out: isoDate('Check-out'),
  guests: wholeNumber('Guests', 1, 16),
};
const validStay = (s: { check_in: string; check_out: string }, ctx: z.RefinementCtx) => {
  if (s.check_out <= s.check_in) ctx.addIssue({ code: 'custom', message: 'Check-out must be after check-in.' });
  else if (nightsBetween(s.check_in, s.check_out) > MAX_NIGHTS) ctx.addIssue({ code: 'custom', message: `A stay can be at most ${MAX_NIGHTS} nights.` });
};

export const createBookingBody = z.object({ listing_id: id('Listing'), ...stay }).superRefine(validStay);
export const changeBookingBody = z.object(stay).superRefine(validStay);

export type CreateBookingInput = z.infer<typeof createBookingBody>;
export type ChangeBookingInput = z.infer<typeof changeBookingBody>;

export const reviewBody = z.object({
  rating: wholeNumber('Rating', 1, 5),
  comment: text('Comment', 10, 1000),
});
export type ReviewInput = z.infer<typeof reviewBody>;

// ---- hosting ----------------------------------------------------------------
export const listingBody = z.object({
  title: text('Title', 5, 120),
  description: text('Description', 20, 2000),
  city: text('City', 1, 80),
  property_type: z.enum(PROPERTY_TYPES, { error: 'Property type is not a valid choice.' }),
  price_per_night: z.coerce
    .number({ error: 'Price per night must be a number.' })
    .min(1, 'Price per night must be between 1 and 99999.')
    .max(99_999, 'Price per night must be between 1 and 99999.')
    .transform((value) => Math.round(value * 100) / 100),
  max_guests: wholeNumber('Guests', 1, 16),
  bedrooms: wholeNumber('Bedrooms', 0, 20),
  bathrooms: wholeNumber('Bathrooms', 0, 20),
  cover: z.string().refine((value) => COVERS.includes(value), 'Cover is not a valid choice.'),
  amenity_ids: z
    .array(id('Amenity'))
    .default([])
    .transform((ids) => [...new Set(ids)]),
});
export type ListingInput = z.infer<typeof listingBody>;

export const activeBody = z.object({ is_active: z.boolean({ error: 'is_active must be true or false.' }) });
