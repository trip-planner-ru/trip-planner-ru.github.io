import { useEffect, useMemo, useState } from 'react';
import {
  MAX_STOPS,
  ROUTE_MODES,
  fetchRoute,
  formatDistance,
  formatTravelTime,
  googleMapsUrl,
  optimizeOrder,
  pinsByCity,
  routeMessage,
  whatsappUrl,
} from '../lib/routing';
import { Button, Card, ExternalLink, Field, inputClass } from './ui';

/**
 * Route between saved pins of one city. Reports the drawn route to the map through onRouteChange
 * ({ line, stopIds } or null) and lets you send it on WhatsApp.
 */
export default function RoutePlanner({ markers, preferredCityId, onRouteChange, onFocusPin }) {
  const groups = useMemo(() => [...pinsByCity(markers).values()].filter((g) => g.pins.length >= 2), [markers]);
  const [cityId, setCityId] = useState(null);
  const group = groups.find((g) => g.city.id === cityId) ?? groups.find((g) => g.city.id === preferredCityId) ?? groups[0];

  const [mode, setMode] = useState('foot');
  const [order, setOrder] = useState([]); // pin ids, in visiting order
  const [skipped, setSkipped] = useState(() => new Set());
  const [state, setState] = useState({ status: 'idle' });
  const [copied, setCopied] = useState(false);

  // Keep the order in step with the city's pins: new pins go to the end, deleted ones drop out.
  useEffect(() => {
    if (!group) return;
    const ids = group.pins.map((p) => p.id);
    setOrder((prev) => [...prev.filter((id) => ids.includes(id)), ...ids.filter((id) => !prev.includes(id))]);
  }, [group?.city.id, group?.pins.map((p) => p.id).join()]); // eslint-disable-line react-hooks/exhaustive-deps

  const byId = new Map(group?.pins.map((p) => [p.id, p]) ?? []);
  const ordered = order.map((id) => byId.get(id)).filter(Boolean);
  const stops = ordered.filter((p) => !skipped.has(p.id)).slice(0, MAX_STOPS);
  const stopsKey = stops.map((s) => `${s.id}@${s.lat},${s.lng}`).join('|');

  // Rebuild the route shortly after anything changes.
  useEffect(() => {
    if (stops.length < 2) {
      setState({ status: 'idle' });
      onRouteChange(null);
      return undefined;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setState((s) => ({ ...s, status: 'loading' }));
      fetchRoute(stops, mode, controller.signal)
        .then((route) => {
          setState({ status: 'done', route });
          onRouteChange({ line: route.line, stopIds: stops.map((s) => s.id) });
        })
        .catch((err) => err.name !== 'AbortError' && setState({ status: 'error', error: err.message }));
    }, 400);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [stopsKey, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => onRouteChange(null), []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!group) {
    return (
      <Card className="p-4">
        <h2 className="font-bold tracking-tight text-slate-900">🧭 Маршрут по меткам</h2>
        <p className="mt-1 text-sm text-slate-500">
          Поставьте на карте хотя бы две метки в одном городе — и здесь можно будет проложить между ними маршрут и отправить
          его в WhatsApp.
        </p>
      </Card>
    );
  }

  const move = (id, delta) =>
    setOrder((prev) => {
      const i = prev.indexOf(id);
      const j = i + delta;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const toggle = (id) =>
    setSkipped((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  async function optimize() {
    setState((s) => ({ ...s, status: 'loading' }));
    try {
      const best = await optimizeOrder(stops, mode);
      const rest = order.filter((id) => !best.some((s) => s.id === id));
      setOrder([...best.map((s) => s.id), ...rest]);
    } catch (err) {
      setState({ status: 'error', error: err.message });
    }
  }

  const route = state.status === 'done' || state.status === 'loading' ? state.route : null;
  const message = stops.length >= 2 ? routeMessage({ city: group.city, stops, mode, route }) : '';
  const stopNumber = new Map(stops.map((s, i) => [s.id, i + 1]));

  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — the WhatsApp and Google Maps buttons still work */
    }
  }

  return (
    <Card className="space-y-4 p-4">
      <div>
        <h2 className="font-bold tracking-tight text-slate-900">🧭 Маршрут по меткам</h2>
        <p className="text-xs text-slate-500">Маршрут строится между метками одного города, по порядку списка.</p>
      </div>

      {groups.length > 1 && (
        <Field label="Город">
          <select className={inputClass} value={group.city.id} onChange={(e) => setCityId(e.target.value)}>
            {groups.map((g) => (
              <option key={g.city.id} value={g.city.id}>
                {g.city.label} ({g.pins.length} меток)
              </option>
            ))}
          </select>
        </Field>
      )}

      <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-900/5 p-1" role="radiogroup" aria-label="Как добираться">
        {Object.entries(ROUTE_MODES).map(([id, m]) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={mode === id}
            onClick={() => setMode(id)}
            className={`rounded-lg px-2 py-1.5 text-xs font-semibold transition ${mode === id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
          >
            <span aria-hidden>{m.icon}</span> {m.short}
          </button>
        ))}
      </div>

      <ol className="space-y-1">
        {ordered.map((pin, i) => {
          const n = stopNumber.get(pin.id);
          const off = skipped.has(pin.id);
          return (
            <li key={pin.id} className={`flex items-center gap-2 rounded-xl px-2 py-1.5 ${off ? 'opacity-50' : 'bg-slate-50'}`}>
              <input
                type="checkbox"
                checked={!off}
                onChange={() => toggle(pin.id)}
                aria-label={`Включить «${pin.name}» в маршрут`}
              />
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-indigo-600 text-xs font-bold text-white">
                {n ?? '–'}
              </span>
              <button type="button" className="min-w-0 flex-1 truncate text-left text-sm font-medium" onClick={() => onFocusPin(pin)}>
                {pin.name}
              </button>
              <button type="button" className="px-1 text-slate-400 hover:text-slate-700 disabled:opacity-30" disabled={i === 0} onClick={() => move(pin.id, -1)} aria-label="Выше">
                ↑
              </button>
              <button type="button" className="px-1 text-slate-400 hover:text-slate-700 disabled:opacity-30" disabled={i === ordered.length - 1} onClick={() => move(pin.id, 1)} aria-label="Ниже">
                ↓
              </button>
            </li>
          );
        })}
      </ol>
      {ordered.filter((p) => !skipped.has(p.id)).length > MAX_STOPS && (
        <p className="text-xs text-amber-700">В маршрут входят первые {MAX_STOPS} отмеченных точек — столько принимает Google Maps.</p>
      )}

      {stops.length >= 3 && (
        <Button className="w-full" onClick={optimize} disabled={state.status === 'loading'}>
          ✨ Оптимальный порядок (первая точка — старт)
        </Button>
      )}

      {stops.length < 2 && <p className="text-sm text-slate-500">Отметьте хотя бы две точки.</p>}
      {state.status === 'loading' && !state.route && <p className="text-sm text-slate-500">Прокладываю маршрут…</p>}
      {state.status === 'error' && <p className="text-sm text-rose-600">Не удалось построить маршрут: {state.error}.</p>}

      {route && stops.length >= 2 && (
        <div className={`space-y-3 rounded-xl bg-indigo-50/70 p-3 ${state.status === 'loading' ? 'opacity-60' : ''}`}>
          <p className="text-lg font-bold tracking-tight text-slate-900">
            {formatDistance(route.distance)} · ≈ {formatTravelTime(route.duration)}
          </p>
          <ul className="space-y-0.5 text-xs text-slate-600">
            {route.legs.map((leg, i) => (
              <li key={i}>
                {i + 1} → {i + 2}: {formatDistance(leg.distance)} · {formatTravelTime(leg.duration)}
              </li>
            ))}
          </ul>
          <a
            href={whatsappUrl(message)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-2 text-sm font-semibold text-white shadow-md shadow-green-600/25 transition hover:bg-[#1ebe5b] active:scale-[0.98]"
          >
            <WhatsAppIcon /> Отправить в WhatsApp
          </a>
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={copy}>{copied ? '✓ Скопировано' : 'Скопировать'}</Button>
            <ExternalLink href={googleMapsUrl(stops, mode)}>Google Maps</ExternalLink>
          </div>
        </div>
      )}
    </Card>
  );
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91A9.85 9.85 0 0 0 12.04 2Zm5.8 14.12c-.25.69-1.44 1.32-1.98 1.36-.5.05-.98.23-3.3-.69-2.79-1.1-4.56-3.95-4.7-4.13-.13-.18-1.12-1.49-1.12-2.85 0-1.35.71-2.02.96-2.29.25-.28.55-.35.73-.35h.53c.17 0 .4-.06.63.48.24.56.8 1.94.87 2.08.07.14.12.3.02.48-.09.18-.14.3-.28.46-.14.16-.29.36-.42.48-.14.14-.28.29-.12.57.16.28.72 1.19 1.55 1.93 1.07.95 1.97 1.25 2.25 1.39.28.14.44.12.6-.07.16-.19.69-.81.88-1.09.18-.28.37-.23.62-.14.25.09 1.6.76 1.88.9.28.14.46.21.53.32.07.12.07.67-.18 1.36Z" />
    </svg>
  );
}
