// Run with: npm test   (no network needed)
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { DOMParser } from 'linkedom';
import { applyNonstopCheck } from '../src/lib/airlines.js';
import { labelMatchesCity, parseAirlinesAndDestinations, wikiNameMatchesAirline } from '../src/lib/routeCheck.js';

globalThis.DOMParser = DOMParser;

// Shaped like Wikipedia's page HTML: nested <section>s, a passenger table and a cargo table.
const PAGE = `<html><body>
<section><h2 id="History">History</h2><table><tr><td>Old Air</td><td><a>Paris–Orly</a></td></tr></table></section>
<section><h2 id="Airlines_and_destinations">Airlines and destinations</h2>
  <section><h3 id="Passenger">Passenger</h3><table>
    <tr><th>Airlines</th><th>Destinations</th></tr>
    <tr><td><a>Air France</a></td><td><a>Paris–Charles de Gaulle</a><sup><a>[1]</a></sup></td></tr>
    <tr><td><a>Wizz Air</a></td><td><a>Budapest</a>, <a>Rome–Fiumicino</a><br><b>Seasonal:</b> <a>Paris–Beauvais</a></td></tr>
    <tr><td><a>Blue Bird Airways</a></td><td><b>Charter:</b> <a>Paris–Orly</a></td></tr>
  </table></section>
  <section><h3 id="Cargo">Cargo</h3><table>
    <tr><td><a>Cargo Co</a></td><td><a>Paris–Charles de Gaulle</a></td></tr>
  </table></section>
</section></body></html>`;

test('parses passenger rows only, with seasonal and charter flags', () => {
  const rows = parseAirlinesAndDestinations(PAGE);
  assert.deepEqual(rows.map((r) => r.airline), ['Air France', 'Wizz Air', 'Blue Bird Airways']);
  assert.deepEqual(rows[0].destinations, [{ label: 'Paris–Charles de Gaulle', seasonal: false, charter: false }]);
  assert.deepEqual(rows[1].destinations.at(-1), { label: 'Paris–Beauvais', seasonal: true, charter: false });
  assert.equal(rows[2].destinations[0].charter, true);
});

test('matches destination labels to cities without false positives', () => {
  const paris = { name: 'Paris' };
  const porto = { name: 'Porto' };
  const newYork = { name: 'New York', wikiNames: ['Newark'] };
  assert.ok(labelMatchesCity('Paris–Orly', paris));
  assert.ok(labelMatchesCity('Paris', paris));
  assert.ok(!labelMatchesCity('Porto Santo', porto));
  assert.ok(labelMatchesCity('Newark', newYork));
  assert.ok(labelMatchesCity('New York–JFK', newYork));
});

test('matches Wikipedia airline names to the directory', () => {
  const swiss = { name: 'SWISS', aliases: ['Swiss International Air Lines'] };
  const easyjet = { name: 'easyJet' };
  assert.ok(wikiNameMatchesAirline('Swiss International Air Lines', swiss));
  assert.ok(wikiNameMatchesAirline('easyJet Europe', easyjet));
  assert.ok(!wikiNameMatchesAirline('Edelweiss Air', swiss));
});

test('reports changes between the saved list and the check', () => {
  const af = { code: 'AF', name: 'Air France' };
  const lh = { code: 'LH', name: 'Lufthansa', via: ['Frankfurt'] };
  const ly = { code: 'LY', name: 'El Al' };
  const route = { nonstop: [af, ly], connecting: [lh], lowCost: [] };
  const check = {
    direct: [
      { code: 'AF', name: 'Air France', seasonal: false, charterOnly: false },
      { code: 'LH', name: 'Lufthansa', seasonal: true, charterOnly: false },
      { code: null, name: 'Blue Bird Airways', seasonal: false, charterOnly: true },
    ],
  };
  const r = applyNonstopCheck(route, check);
  assert.deepEqual(r.direct.map((a) => a.code), ['AF', 'LH']);
  assert.deepEqual(r.notDirect.map((a) => a.code), ['LY']);
  assert.deepEqual(r.changes.map((c) => `${c.airline.code}:${c.kind}`).sort(), ['LH:nowDirect', 'LY:noLongerDirect']);
});
