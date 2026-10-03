// Run with: npm test
import { test } from 'vitest';
import assert from 'node:assert/strict';
import data from '../src/data/place_hints.json';
import { allCities } from '../src/lib/locations.js';
import { popularPlaces, suggestPlaces } from '../src/lib/placeHints.js';

test('most cities have sights with Russian names and coordinates', () => {
  const withPlaces = allCities.filter((c) => data.cities[c.id]?.length >= 5);
  assert.ok(withPlaces.length >= allCities.length * 0.9, `${withPlaces.length}/${allCities.length} cities have 5+ sights`);
  for (const places of Object.values(data.cities)) {
    for (const p of places) {
      assert.ok(p.ru, 'Russian name');
      assert.ok(Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180, `${p.ru}: coordinates`);
    }
  }
});

test('suggestions match Russian and English, best matches first', () => {
  const ru = suggestPlaces('эйф', 'paris').here;
  assert.equal(ru[0].name, 'Эйфелева башня');
  const en = suggestPlaces('louvre', 'paris').here;
  assert.ok(en.some((s) => s.name === 'Лувр'), 'English name finds the Russian entry');
  assert.deepEqual(suggestPlaces('а', 'paris'), { here: [], elsewhere: [] }, 'one letter is too short');
});

test('sights in other cities are offered when the current city has none', () => {
  const { here, elsewhere } = suggestPlaces('колизей', 'paris');
  assert.equal(here.length, 0);
  assert.ok(elsewhere.some((s) => s.cityLabel === 'Рим'));
});

test('the empty box suggests the city’s best-known sights', () => {
  const top = popularPlaces('rome', 3);
  assert.equal(top.length, 3);
  assert.ok(top.every((s) => s.cityLabel === 'Рим'));
});
