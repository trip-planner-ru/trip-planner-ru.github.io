// Consistency of the bundled data. Run with: npm test
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { airlines } from '../src/data/airlines.json';
import { airports } from '../src/data/airports.json';
import { allCities, countries } from '../src/lib/locations.js';

const codes = new Set(airlines.map((a) => a.code));
const cityIds = new Set(allCities.map((c) => c.id));

test('ids and codes are unique', () => {
  assert.equal(cityIds.size, allCities.length);
  assert.equal(codes.size, airlines.length);
  assert.equal(new Set(countries.map((c) => c.code)).size, countries.length);
});

test('every city is complete', () => {
  const airportCodes = new Set(airports.map((a) => a.code));
  for (const c of allCities) {
    assert.ok(c.label && c.label !== c.name, `${c.id}: Russian name`);
    assert.ok(airportCodes.has(c.airport), `${c.id}: airport ${c.airport} in airports.json`);
    assert.ok(c.districts?.length, `${c.id}: districts`);
    assert.ok(c.wikiAirports?.length, `${c.id}: Wikipedia airport pages`);
    assert.ok(c.airlines?.length, `${c.id}: airlines`);
    for (const code of c.airlines) assert.ok(codes.has(code), `${c.id}: unknown airline ${code}`);
    assert.equal(new Set(c.airlines).size, c.airlines.length, `${c.id}: duplicate airline`);
  }
});

test('airline hubs point at real cities', () => {
  for (const a of airlines) {
    for (const h of a.hubs ?? []) {
      if (h.cityId) assert.ok(cityIds.has(h.cityId), `${a.code}: hub ${h.cityId}`);
    }
    assert.match(a.website, /^https:\/\//, `${a.code}: website`);
  }
});
