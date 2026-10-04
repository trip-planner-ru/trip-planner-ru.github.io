import { useEffect, useRef, useState } from 'react';
import { MapContainer, Marker, Polyline, Popup, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import { useTrip } from '../context/TripContext';
import { cityById } from '../lib/locations';
import { PIN_CATEGORIES, pinIcon } from '../lib/pins';
import MapSearch from './MapSearch';
import RoutePlanner from './RoutePlanner';
import { Button, Card, Field, inputClass } from './ui';

// Free OSM geocoder. Its usage policy allows on-submit search, not search-as-you-type.
async function geocode(query, signal) {
  const params = new URLSearchParams({ q: query, format: 'jsonv2', limit: '6', 'accept-language': 'ru' });
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, { signal });
  if (!res.ok) throw new Error(`Поиск не удался (ошибка ${res.status})`);
  return res.json();
}

function FocusController({ focus }) {
  const map = useMap();
  useEffect(() => {
    if (focus) map.flyTo([focus.lat, focus.lng], focus.zoom ?? 15, { duration: 0.8 });
  }, [focus, map]);
  return null;
}

/** Zoom the map to a newly built route (once per set of stops, not on every rebuild). */
function FitRoute({ route }) {
  const map = useMap();
  const key = route?.stopIds.join();
  useEffect(() => {
    if (route?.line.length) map.fitBounds(route.line, { padding: [40, 40], maxZoom: 16 });
  }, [key, map]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

function ClickToPin({ onPick }) {
  useMapEvents({ click: (e) => onPick(e.latlng) });
  return null;
}

export default function MapTab() {
  const { search, markers, addMarker, removeMarker, mapFocus } = useTrip();
  const city = cityById(search.destinationCityId);
  const [focus, setFocus] = useState(mapFocus);
  const [draft, setDraft] = useState(null);
  const [results, setResults] = useState([]);
  const [route, setRoute] = useState(null); // { line, stopIds } drawn on the map
  const [status, setStatus] = useState({ loading: false, error: null });
  const abortRef = useRef(null);
  const draftRef = useRef(null);

  useEffect(() => {
    if (mapFocus) setFocus(mapFocus);
  }, [mapFocus]);

  useEffect(() => {
    if (draft) draftRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [draft?.lat, draft?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  const flyTo = (lat, lng, zoom = 16) => setFocus({ lat, lng, zoom, at: Date.now() });

  async function runSearch(query) {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setStatus({ loading: true, error: null });
    try {
      const found = await geocode(query, abortRef.current.signal);
      setResults(found);
      setStatus({ loading: false, error: found.length ? null : 'Ничего не найдено.' });
    } catch (err) {
      if (err.name !== 'AbortError') setStatus({ loading: false, error: err.message });
    }
  }

  function pickResult(r) {
    const lat = Number(r.lat);
    const lng = Number(r.lon);
    flyTo(lat, lng);
    setDraft({ lat, lng, name: r.name || r.display_name.split(',')[0], category: 'attraction', note: '' });
  }

  function saveDraft(e) {
    e.preventDefault();
    addMarker({ ...draft, name: draft.name.trim() || 'Метка без названия' });
    setDraft(null);
  }

  const center = mapFocus ? [mapFocus.lat, mapFocus.lng] : [city.lat, city.lng];

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <Card className="relative h-[60vh] overflow-hidden lg:h-[calc(100vh-12rem)]">
        <MapContainer center={center} zoom={mapFocus ? 16 : 13} className="h-full w-full">
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; участники <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />
          <FocusController focus={focus} />
          <ClickToPin onPick={({ lat, lng }) => setDraft((d) => ({ name: '', category: 'attraction', note: '', ...d, lat, lng }))} />

          {route && (
            <>
              <Polyline positions={route.line} pathOptions={{ color: '#ffffff', weight: 9, opacity: 0.9 }} />
              <Polyline positions={route.line} pathOptions={{ color: '#4f46e5', weight: 5, opacity: 0.9 }} />
            </>
          )}
          <FitRoute route={route} />

          {markers.map((m) => (
            <Marker key={m.id} position={[m.lat, m.lng]} icon={pinIcon(m.category)}>
              {route?.stopIds.includes(m.id) && (
                <Tooltip permanent direction="top" offset={[0, -30]} className="route-stop">
                  {route.stopIds.indexOf(m.id) + 1}
                </Tooltip>
              )}
              <Popup>
                <p className="!m-0 font-semibold">{m.name}</p>
                <p className="!m-0 text-xs text-slate-500">{PIN_CATEGORIES[m.category]?.label}</p>
                {m.note && <p className="!mb-0 !mt-1 text-sm">{m.note}</p>}
                <button className="mt-2 text-xs text-rose-600" onClick={() => removeMarker(m.id)}>
                  Удалить метку
                </button>
              </Popup>
            </Marker>
          ))}

          {draft && <Marker position={[draft.lat, draft.lng]} icon={pinIcon(draft.category, true)} />}
        </MapContainer>
        {!draft && (
          <p className="pointer-events-none absolute bottom-4 left-1/2 z-[500] -translate-x-1/2 whitespace-nowrap rounded-full bg-slate-900/75 px-4 py-1.5 text-xs font-semibold text-white shadow-lg backdrop-blur">
            Нажмите в любом месте карты, чтобы поставить метку
          </p>
        )}
      </Card>

      <div className="space-y-4">
        {/* Raised above the cards below it, so the suggestion list isn't drawn underneath them. */}
        <Card className="relative z-20 p-4">
          <MapSearch
            city={city}
            loading={status.loading}
            onSearch={runSearch}
            onPick={({ name, lat, lng }) => {
              setResults([]);
              flyTo(lat, lng);
              setDraft({ lat, lng, name, category: 'attraction', note: '' });
            }}
          />
          {status.error && <p className="mt-2 text-sm text-rose-600">{status.error}</p>}
          {results.length > 0 && (
            <ul className="mt-3 max-h-56 divide-y divide-slate-100 overflow-y-auto text-sm">
              {results.map((r) => (
                <li key={r.place_id}>
                  <button className="w-full px-1 py-2 text-left hover:bg-slate-50" onClick={() => pickResult(r)}>
                    <span className="font-medium">{r.name || r.display_name.split(',')[0]}</span>
                    <span className="block truncate text-xs text-slate-500">{r.display_name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Button variant="ghost" className="mt-2 px-0" onClick={() => flyTo(city.lat, city.lng, 13)}>
            ⌖ Показать город {city.label}
          </Button>
        </Card>

        <RoutePlanner
          markers={markers}
          preferredCityId={city.id}
          onRouteChange={setRoute}
          onFocusPin={(pin) => flyTo(pin.lat, pin.lng)}
        />

        {draft && (
          <Card className="p-4 ring-2 ring-indigo-500/40">
            <form ref={draftRef} onSubmit={saveDraft} className="space-y-3">
              <h2 className="font-bold tracking-tight text-slate-900">Новая метка</h2>
              <p className="text-xs text-slate-500">
                {draft.lat.toFixed(5)}, {draft.lng.toFixed(5)}
              </p>
              <Field label="Название">
                <input
                  autoFocus
                  className={inputClass}
                  value={draft.name}
                  placeholder="например, встреча у фонтана"
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </Field>
              <Field label="Тип">
                <select
                  className={inputClass}
                  value={draft.category}
                  onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                >
                  {Object.entries(PIN_CATEGORIES).map(([key, c]) => (
                    <option key={key} value={key}>
                      {c.emoji} {c.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Заметка">
                <textarea
                  className={inputClass}
                  rows={2}
                  value={draft.note}
                  onChange={(e) => setDraft({ ...draft, note: e.target.value })}
                />
              </Field>
              <div className="flex gap-2">
                <Button type="submit" variant="primary" className="flex-1">
                  Сохранить метку
                </Button>
                <Button onClick={() => setDraft(null)}>Отмена</Button>
              </div>
            </form>
          </Card>
        )}

        <Card className="p-4">
          <h2 className="mb-2 font-bold tracking-tight text-slate-900">Сохранённые метки ({markers.length})</h2>
          {markers.length === 0 ? (
            <p className="text-sm text-slate-500">Меток пока нет. Нажмите на карту или выберите результат поиска.</p>
          ) : (
            <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto">
              {markers.map((m) => (
                <li key={m.id} className="flex items-center gap-2 py-2">
                  <button className="flex flex-1 items-center gap-2 text-left" onClick={() => flyTo(m.lat, m.lng)}>
                    <span aria-hidden>{PIN_CATEGORIES[m.category]?.emoji}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{m.name}</span>
                      {m.note && <span className="block truncate text-xs text-slate-500">{m.note}</span>}
                    </span>
                  </button>
                  <Button variant="ghost" className="px-2 py-1 text-xs" aria-label={`Удалить ${m.name}`} onClick={() => removeMarker(m.id)}>
                    ✕
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
