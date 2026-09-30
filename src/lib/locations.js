import { countries as rawCountries } from '../data/locations.json';
import { airports } from '../data/airports.json';

// `name` is the English name used in searches (booking sites, Wikipedia); `label` is the Russian name shown in the UI.
// Sorted alphabetically by label so the dropdowns stay easy to scan.
const withLabel = (x) => ({ ...x, label: x.nameRu ?? x.name });
const byLabel = (a, b) => a.label.localeCompare(b.label, 'ru');
export const countries = rawCountries
  .map(withLabel)
  .sort(byLabel)
  .map((country) => ({ ...country, cities: country.cities.map(withLabel).sort(byLabel) }));

export const allCities = countries.flatMap((country) =>
  country.cities.map((city) => ({ ...city, countryCode: country.code, countryName: country.name })),
);

export const cityById = (id) => allCities.find((c) => c.id === id) ?? null;

export const airportByCode = (code) => airports.find((a) => a.code === code) ?? null;

/** Great-circle distance in km. */
export function distanceKm(a, b) {
  const rad = (x) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}
