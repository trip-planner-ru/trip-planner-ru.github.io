// Run with: npm test
import { test } from 'vitest';
import assert from 'node:assert/strict';
import {
  directCityIds,
  getAllCountries,
  getDestinationByIata,
  getDestinationsByCountry,
  israeliOriginFor,
  searchCities,
} from '../src/lib/israelDestinations.js';
import { allCities } from '../src/lib/locations.js';

test('every destination has a country, Russian names and valid IATA codes', () => {
  const countries = getAllCountries();
  assert.ok(countries.length > 20);
  for (const c of countries) {
    assert.ok(c.nameRu, c.code);
    for (const city of getDestinationsByCountry(c.code)) {
      assert.match(city.nameRu, /[а-яё]/i, `${city.name}: Russian name`);
      for (const a of city.airports) {
        assert.match(a.iata, /^[A-Z]{3}$/, `${city.name}: IATA`);
        assert.ok(a.from.length && a.from.every((f) => f === 'TLV' || f === 'ETM'), `${a.iata}: origin`);
        assert.ok(a.airlines.length, `${a.iata}: airlines`);
      }
    }
  }
});

test('search works in Russian, English and by IATA code', () => {
  const cityNames = (q) => searchCities(q).flatMap((c) => c.cities.map((city) => city.name));
  assert.ok(cityNames('пари').includes('Paris'));
  assert.ok(cityNames('Paris').includes('Paris'));
  assert.ok(cityNames('cdg').includes('Paris'));
  assert.ok(searchCities('Франция')[0].cities.length > 1, 'country name returns its cities');
  assert.equal(searchCities('zzzz').length, 0);
});

test('IATA lookup and links to app cities', () => {
  const athens = getDestinationByIata('ath');
  assert.equal(athens.country.code, 'GR');
  assert.equal(athens.city.cityId, 'athens');
  const appIds = new Set(allCities.map((c) => c.id));
  for (const id of directCityIds('TLV')) assert.ok(appIds.has(id), id);
  assert.ok(directCityIds('TLV').has('paris'));
});

test('origin filter and Israeli origin cities', () => {
  assert.equal(israeliOriginFor({ id: 'tel-aviv' }), 'TLV');
  assert.equal(israeliOriginFor({ id: 'eilat' }), 'ETM');
  assert.equal(israeliOriginFor({ id: 'paris' }), null);
  const fromEilat = searchCities('', { from: 'ETM' }).flatMap((c) => c.cities.flatMap((city) => city.airports));
  assert.ok(fromEilat.length > 0 && fromEilat.every((a) => a.from.includes('ETM')));
});
