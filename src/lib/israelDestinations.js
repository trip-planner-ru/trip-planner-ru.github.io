// Nonstop destinations from Israel's international airports (TLV, ETM).
// Data: src/data/israel_destinations.json, rebuilt with `npm run update:israel`.
import data from '../data/israel_destinations.json';

/** Israeli origin airport for an app city, or null when the city isn't one of them. */
const ORIGIN_BY_CITY = { 'tel-aviv': 'TLV', eilat: 'ETM' };
export const israeliOriginFor = (city) => ORIGIN_BY_CITY[city?.id] ?? null;

export const ISRAEL_DESTINATIONS_DATE = data.generatedAt;

const norm = (s) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ё/g, 'е')
    .toLowerCase()
    .trim();

/** Keep only airports served from `from` ('TLV' | 'ETM'); with no `from`, keep everything. */
function servedFrom(city, from) {
  if (!from) return city;
  const airports = city.airports.filter((a) => a.from.includes(from));
  return airports.length ? { ...city, airports } : null;
}

function citiesOf(country, from) {
  return country.cities.map((c) => servedFrom(c, from)).filter(Boolean);
}

/** Countries with at least one nonstop destination: [{ code, name, nameRu, cityCount }], sorted by Russian name. */
export function getAllCountries({ from } = {}) {
  return data.countries
    .map((c) => ({ code: c.code, name: c.name, nameRu: c.nameRu, cityCount: citiesOf(c, from).length }))
    .filter((c) => c.cityCount > 0);
}

/** Cities (with their airports) in one country. */
export function getDestinationsByCountry(code, { from } = {}) {
  const country = data.countries.find((c) => c.code === code);
  return country ? citiesOf(country, from) : [];
}

/**
 * Search by city, country, airport name or IATA code, in Russian or English ("пари", "Paris", "CDG").
 * Returns countries with only the matching cities: [{ code, name, nameRu, cities }].
 */
export function searchCities(query = '', { from } = {}) {
  const q = norm(query);
  return data.countries
    .map((country) => {
      const countryHit = q && [country.name, country.nameRu].some((t) => norm(t).includes(q));
      const cities = citiesOf(country, from).filter(
        (city) =>
          !q ||
          countryHit ||
          [city.name, city.nameRu].some((t) => norm(t).includes(q)) ||
          city.airports.some((a) => norm(a.iata) === q || [a.name, a.nameRu].some((t) => norm(t).includes(q))),
      );
      return { code: country.code, name: country.name, nameRu: country.nameRu, cities };
    })
    .filter((c) => c.cities.length > 0);
}

/** { country, city, airport } for an IATA code, or null. */
export function getDestinationByIata(iata) {
  const code = iata?.toUpperCase();
  for (const country of data.countries) {
    for (const city of country.cities) {
      const airport = city.airports.find((a) => a.iata === code);
      if (airport) return { country, city, airport };
    }
  }
  return null;
}

/** App city ids that have a nonstop flight from `from` ('TLV' | 'ETM'). */
export function directCityIds(from) {
  return new Set(
    data.countries.flatMap((c) => citiesOf(c, from).filter((city) => city.cityId).map((city) => city.cityId)),
  );
}
