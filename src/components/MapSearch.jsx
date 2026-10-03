import { useEffect, useId, useRef, useState } from 'react';
import { popularPlaces, searchNearby, suggestPlaces } from '../lib/placeHints';
import { Button, inputClass } from './ui';

/**
 * Map search box with suggestions as you type.
 * Picking a suggestion calls onPick({ name, lat, lng }); Enter without a highlighted suggestion (or the button)
 * calls onSearch(query) for a full search.
 */
export default function MapSearch({ city, loading, onPick, onSearch }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [nearby, setNearby] = useState({ query: '', items: [], loading: false });
  const listId = useId();
  const blurTimer = useRef(null);

  const trimmed = query.trim();
  const local = trimmed ? suggestPlaces(trimmed, city.id) : { here: popularPlaces(city.id), elsewhere: [] };
  const nearbyItems = nearby.query === trimmed ? nearby.items : [];
  const groups = [
    { title: trimmed ? `Места: ${city.label}` : `Популярное: ${city.label}`, items: local.here },
    { title: 'В других городах', items: local.elsewhere },
    { title: 'Адреса и заведения рядом (OpenStreetMap)', items: nearbyItems },
  ].filter((g) => g.items.length);
  const flat = groups.flatMap((g) => g.items);

  // Photon is asked only after typing pauses, so it isn't hit on every key press.
  useEffect(() => {
    setActive(-1);
    if (trimmed.length < 3) return undefined;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setNearby((n) => ({ ...n, loading: true }));
      searchNearby(trimmed, city, controller.signal)
        .then((items) => setNearby({ query: trimmed, items, loading: false }))
        .catch((err) => err.name !== 'AbortError' && setNearby({ query: trimmed, items: [], loading: false }));
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed, city]);

  function pick(item) {
    setQuery(item.name);
    setOpen(false);
    onPick(item);
  }

  function onKeyDown(e) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setOpen(true);
      if (flat.length) setActive((i) => (e.key === 'ArrowDown' ? (i + 1) % flat.length : (i - 1 + flat.length) % flat.length));
    } else if (e.key === 'Escape') {
      setOpen(false);
    } else if (e.key === 'Enter' && open && active >= 0 && flat[active]) {
      e.preventDefault();
      pick(flat[active]);
    }
  }

  function submit(e) {
    e.preventDefault();
    if (!trimmed) return;
    setOpen(false);
    onSearch(trimmed);
  }

  let index = -1;
  return (
    <form onSubmit={submit}>
      <div className="relative flex gap-2">
        <input
          className={inputClass}
          role="combobox"
          aria-expanded={open && groups.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          placeholder="Место или адрес, например «Лувр»"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            clearTimeout(blurTimer.current);
            setOpen(true);
          }}
          onBlur={() => {
            blurTimer.current = setTimeout(() => setOpen(false), 150);
          }}
          onKeyDown={onKeyDown}
        />
        <Button type="submit" variant="primary" disabled={loading}>
          {loading ? '…' : 'Найти'}
        </Button>

      {open && (groups.length > 0 || (trimmed.length >= 2 && !nearby.loading)) && (
        <div
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-full z-[1100] mt-2 max-h-80 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-[0_20px_40px_-16px_rgb(15_23_42/0.35)]"
        >
          {groups.length === 0 && (
            <p className="px-3 py-2 text-sm text-slate-500">
              Подсказок нет — нажмите «Найти», чтобы искать по всей карте.
            </p>
          )}
          {groups.map((g) => (
            <div key={g.title} role="group" aria-label={g.title}>
              <p className="px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">{g.title}</p>
              {g.items.map((item) => {
                index += 1;
                const i = index;
                return (
                  <button
                    type="button"
                    key={item.key}
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={i === active}
                    onMouseDown={(e) => e.preventDefault()} // keep focus in the input
                    onMouseEnter={() => setActive(i)}
                    onClick={() => pick(item)}
                    className={`flex w-full items-start gap-2.5 rounded-xl px-3 py-2 text-left ${i === active ? 'bg-indigo-50' : ''}`}
                  >
                    <span className="mt-0.5 text-base" aria-hidden>
                      {item.cityLabel === null ? '📍' : '⭐'}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-slate-900">
                        <Highlight text={item.name} query={trimmed} />
                      </span>
                      <span className="block truncate text-xs text-slate-500">
                        {[item.detail, g.title === 'В других городах' ? item.cityLabel : null].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
          {nearby.loading && trimmed.length >= 3 && (
            <p className="px-3 py-2 text-xs text-slate-400">Ищу адреса и заведения рядом…</p>
          )}
        </div>
      )}
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Начните вводить — появятся подсказки. ↑ ↓ — выбрать, Enter — показать на карте.
      </p>
    </form>
  );
}

/** Bold the part of the name that matches what was typed. */
function Highlight({ text, query }) {
  const at = query ? text.toLowerCase().indexOf(query.toLowerCase()) : -1;
  if (at < 0) return text;
  return (
    <>
      {text.slice(0, at)}
      <mark className="rounded bg-amber-100 px-0.5 text-inherit">{text.slice(at, at + query.length)}</mark>
      {text.slice(at + query.length)}
    </>
  );
}
