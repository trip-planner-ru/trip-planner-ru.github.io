import { useEffect, useState } from 'react';
import { useTrip } from '../context/TripContext';
import { airlines as directory, airlinesForRoute, applyNonstopCheck } from '../lib/airlines';
import { addDays, plural, stayFromSearch, todayISO } from '../lib/format';
import { bookingCityUrl, googleFlightsUrl, skyscannerUrl } from '../lib/links';
import { cityById } from '../lib/locations';
import { directCityIds, israeliOriginFor } from '../lib/israelDestinations';
import { checkNonstop } from '../lib/routeCheck';
import IsraelDestinations from './IsraelDestinations';
import LocationPicker from './LocationPicker';
import { Badge, Button, Card, EmptyState, ExternalLink, Field, inputClass, SectionTitle } from './ui';

const TONES = {
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  sky: 'bg-sky-50 text-sky-700 ring-sky-200',
  amber: 'bg-amber-50 text-amber-700 ring-amber-200',
  slate: 'bg-slate-100 text-slate-600 ring-slate-200',
  rose: 'bg-rose-50 text-rose-700 ring-rose-200',
};
const eyebrow = 'text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400';

/** Runs the live nonstop check whenever the route changes; `recheck()` bypasses the 24-hour cache. */
function useNonstopCheck(origin, dest) {
  const [state, setState] = useState({ status: 'idle' });
  const [forceAt, setForceAt] = useState(0);

  useEffect(() => {
    if (!origin || !dest || origin.id === dest.id) return undefined;
    const controller = new AbortController();
    setState({ status: 'loading' });
    checkNonstop(origin, dest, directory, { force: forceAt > 0, signal: controller.signal })
      .then((result) => setState({ status: 'done', result }))
      .catch((err) => err.name !== 'AbortError' && setState({ status: 'error', error: err.message }));
    return () => controller.abort();
  }, [origin?.id, dest?.id, forceAt]); // eslint-disable-line react-hooks/exhaustive-deps

  return [state, () => setForceAt(Date.now())];
}

// Hub names as they read after «через» (accusative case).
const HUB_RU = {
  'Tel Aviv': 'Тель-Авив', Paris: 'Париж', London: 'Лондон', Rome: 'Рим', Madrid: 'Мадрид', Amsterdam: 'Амстердам',
  Frankfurt: 'Франкфурт', Munich: 'Мюнхен', Vienna: 'Вену', Zurich: 'Цюрих', Copenhagen: 'Копенгаген', Dublin: 'Дублин',
  Lisbon: 'Лиссабон', Athens: 'Афины', Warsaw: 'Варшаву', Zagreb: 'Загреб', Istanbul: 'Стамбул', Dubai: 'Дубай',
  'Abu Dhabi': 'Абу-Даби', Doha: 'Доху', 'New York': 'Нью-Йорк', Atlanta: 'Атланту', Dallas: 'Даллас', Chicago: 'Чикаго',
  'Los Angeles': 'Лос-Анджелес', Toronto: 'Торонто', Tokyo: 'Токио', Seoul: 'Сеул', 'Hong Kong': 'Гонконг', Singapore: 'Сингапур',
  Antalya: 'Анталью', Tbilisi: 'Тбилиси', Bangkok: 'Бангкок', Cairo: 'Каир', Brussels: 'Брюссель', Helsinki: 'Хельсинки',
  Bucharest: 'Бухарест', Sofia: 'Софию', Belgrade: 'Белград', Baku: 'Баку', Riga: 'Ригу', Larnaca: 'Ларнаку', Sharjah: 'Шарджу',
};
const via = (a) => `через ${a.via.map((h) => HUB_RU[h] ?? h).join(' или ')}`;

export default function AirlinesTab() {
  const { search, updateSearch, setTab } = useTrip();
  const { originCityId, destinationCityId, tripType, departDate, returnDate, passengers } = search;
  const origin = cityById(originCityId);
  const dest = cityById(destinationCityId);
  const sameCity = originCityId === destinationCityId;
  const route = sameCity ? null : airlinesForRoute(origin, dest);
  const [check, recheck] = useNonstopCheck(origin, dest);
  const checked = !sameCity && check.status === 'done' ? applyNonstopCheck(route, check.result) : null;
  const flightsUrl = (airlineName) => googleFlightsUrl(origin.airport, dest.airport, search, airlineName);
  const routeLabel = `${origin.label} → ${dest.label}`;
  const israeliOrigin = israeliOriginFor(origin);
  const nonstopFromIsrael = israeliOrigin ? directCityIds(israeliOrigin) : null;

  const total = checked
    ? checked.direct.length + checked.notDirect.length
    : route
      ? route.nonstop.length + route.connecting.length + route.lowCost.length
      : 0;

  return (
    <div className="space-y-6">
      <Card className="p-4 sm:p-5">
        <div className="grid gap-4 lg:grid-cols-[1fr_auto_1fr]">
          <LocationPicker label="Откуда" cityId={originCityId} onChange={(id) => updateSearch({ originCityId: id })} />
          <Button
            variant="secondary"
            className="h-11 w-11 self-end rounded-full p-0 text-lg"
            aria-label="Поменять местами"
            title="Поменять местами"
            onClick={() => updateSearch({ originCityId: destinationCityId, destinationCityId: originCityId })}
          >
            ⇄
          </Button>
          <LocationPicker
            label="Куда"
            cityId={destinationCityId}
            onChange={(id) => updateSearch({ destinationCityId: id })}
            marked={nonstopFromIsrael}
          />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field label="Поездка">
            <select className={inputClass} value={tripType} onChange={(e) => updateSearch({ tripType: e.target.value })}>
              <option value="round">Туда и обратно</option>
              <option value="oneway">В одну сторону</option>
            </select>
          </Field>
          <Field label="Вылет">
            <input
              type="date"
              className={inputClass}
              min={todayISO()}
              value={departDate}
              onChange={(e) =>
                e.target.value &&
                updateSearch({
                  departDate: e.target.value,
                  returnDate: returnDate <= e.target.value ? addDays(e.target.value, 7) : returnDate,
                })
              }
            />
          </Field>
          {tripType === 'round' && (
            <Field label="Обратно">
              <input
                type="date"
                className={inputClass}
                min={addDays(departDate, 1)}
                value={returnDate}
                onChange={(e) => e.target.value && updateSearch({ returnDate: e.target.value })}
              />
            </Field>
          )}
          <Field label="Пассажиры">
            <select className={inputClass} value={passengers} onChange={(e) => updateSearch({ passengers: Number(e.target.value) })}>
              {Array.from({ length: 9 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {plural(n, 'взрослый', 'взрослых', 'взрослых')}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {nonstopFromIsrael && (
          <p className="mt-3 text-xs text-slate-500">✈ — есть прямой рейс из аэропорта {israeliOrigin} (по данным Википедии).</p>
        )}
      </Card>

      {israeliOrigin && (
        <IsraelDestinations
          from={israeliOrigin}
          search={search}
          onPickCity={(id) => {
            updateSearch({ destinationCityId: id });
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />
      )}

      {sameCity ? (
        <EmptyState title="Город вылета и город назначения совпадают">Выберите другой город назначения.</EmptyState>
      ) : (
        <>
          <Card className="grid gap-5 p-5 md:grid-cols-2">
            <div>
              <p className={eyebrow}>🎫 Настоящие цены на билеты</p>
              <p className="mt-1.5 text-lg font-bold tracking-tight">
                {origin.label} ({origin.airport}) → {dest.label} ({dest.airport})
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <ExternalLink href={flightsUrl()} variant="primary">
                  Google Flights
                </ExternalLink>
                <ExternalLink href={skyscannerUrl(origin.airport, dest.airport, search)}>Skyscanner</ExternalLink>
              </div>
            </div>
            <div className="md:border-l md:border-slate-200/70 md:pl-5">
              <p className={eyebrow}>🏨 Где жить</p>
              <p className="mt-1.5 text-lg font-bold tracking-tight">Жильё: {dest.label}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <ExternalLink href={bookingCityUrl(dest, '', stayFromSearch(search))} variant="booking">
                  {dest.label} на Booking.com
                </ExternalLink>
                <Button onClick={() => setTab('hotels')}>Другие сайты для жилья →</Button>
              </div>
            </div>
          </Card>

          <SectionTitle count={total}>Авиакомпании: {routeLabel}</SectionTitle>

          <CheckPanel check={check} checked={checked} origin={origin} onRecheck={recheck} />

          {total === 0 ? (
            <EmptyState title={`В нашем списке нет авиакомпаний по маршруту ${routeLabel}`}>
              Поищите маршрут в Google Flights или Skyscanner (кнопки выше) — там видны все варианты.
            </EmptyState>
          ) : checked ? (
            <>
              <AirlineGroup
                title="✈️ Прямые рейсы"
                hint={`По данным проверки летают без пересадок: ${routeLabel}.`}
                airlines={checked.direct}
                badges={directBadges}
                flightsUrl={flightsUrl}
              />
              <AirlineGroup
                title="🔁 С пересадкой или без прямого рейса"
                hint="У этих авиакомпаний прямой рейс по этому маршруту не найден."
                airlines={checked.notDirect}
                badges={notDirectBadges}
                flightsUrl={flightsUrl}
              />
            </>
          ) : (
            <>
              <AirlineGroup
                title="✈️ Прямые рейсы"
                hint="По сохранённому списку — ещё не проверено."
                airlines={route.nonstop}
                badges={() => [{ text: 'Прямой', tone: TONES.green }]}
                flightsUrl={flightsUrl}
              />
              <AirlineGroup
                title="🔁 С одной пересадкой"
                hint="Пересадка в домашнем аэропорту авиакомпании."
                airlines={route.connecting}
                badges={(a) => [{ text: `С пересадкой · ${via(a)}`, tone: TONES.sky }]}
                flightsUrl={flightsUrl}
              />
              <AirlineGroup
                title="Лоукостеры"
                hint="Летают в оба города, но не обязательно по этому маршруту."
                airlines={route.lowCost}
                badges={() => [{ text: 'Проверьте маршрут', tone: TONES.amber }]}
                flightsUrl={flightsUrl}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}

function directBadges(a) {
  const badges = [{ text: a.seasonal ? '✓ Прямой · сезонный' : '✓ Прямой', tone: TONES.green }];
  if (a.predicted !== 'nonstop') badges.push({ text: 'Новое', tone: TONES.rose });
  return badges;
}

function notDirectBadges(a) {
  if (a.predicted === 'nonstop') return [{ text: 'Не прямой · изменилось', tone: TONES.rose }];
  if (a.predicted === 'connecting') return [{ text: `С пересадкой · ${via(a)}`, tone: TONES.sky }];
  return [{ text: 'Прямого рейса нет', tone: TONES.slate }];
}

const CHANGE_TEXT = {
  nowDirect: 'теперь летает напрямую',
  added: 'летает напрямую (не было в списке для этого маршрута)',
  noLongerDirect: 'больше не летает напрямую',
};

function CheckPanel({ check, checked, origin, onRecheck }) {
  if (check.status === 'loading') {
    return (
      <Card className="flex items-center gap-3 p-4 text-sm text-slate-600">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" aria-hidden />
        Проверяю, какие авиакомпании летают напрямую из города {origin.label}…
      </Card>
    );
  }
  if (check.status === 'error') {
    return (
      <Card className="flex flex-wrap items-center gap-3 !border-amber-200 !bg-amber-50/90 p-4 text-sm">
        <span className="flex-1">
          ⚠️ Сейчас не получилось проверить прямые рейсы ({check.error}). Показываю сохранённый список.
        </span>
        <Button onClick={onRecheck}>Попробовать снова</Button>
      </Card>
    );
  }
  if (!checked) return null;

  const { result } = check;
  const when = new Date(result.checkedAt).toLocaleString('ru-RU', { dateStyle: 'medium', timeStyle: 'short' });
  const n = checked.changes.length;
  return (
    <Card className="space-y-3 p-4 text-sm sm:p-5">
      <div className="flex flex-wrap items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-700" aria-hidden>
          ✓
        </div>
        <p className="flex-1 text-slate-600">
          <span className="font-bold text-slate-900">Прямые рейсы проверены</span> по спискам «Airlines and destinations» в
          Википедии ({result.sources.join(', ')}) · данные от {when}
        </p>
        <Button className="px-2 py-1 text-xs" onClick={onRecheck}>
          Проверить снова
        </Button>
      </div>

      {n === 0 ? (
        <p className="rounded-xl bg-emerald-50 px-3 py-2 text-emerald-700">Изменений нет: проверка совпадает с сохранённым списком.</p>
      ) : (
        <div className="rounded-xl bg-rose-50/70 px-3 py-2">
          <p className="font-semibold text-rose-700">
            {plural(n, 'изменение', 'изменения', 'изменений')} по сравнению с сохранённым списком:
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-slate-700">
            {checked.changes.map((c) => (
              <li key={c.airline.code ?? c.airline.name}>
                <span className="font-medium">{c.airline.name}</span> {CHANGE_TEXT[c.kind]}
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.failed.length > 0 && (
        <p className="text-amber-700">
          Не удалось загрузить: {result.failed.map((f) => f.title).join(', ')} — рейсы оттуда не учтены.
        </p>
      )}
      <p className="text-xs text-slate-400">
        Википедию ведут волонтёры, обычно она актуальна. Перед покупкой проверьте рейсы кнопкой «Её рейсы».
      </p>
    </Card>
  );
}

function AirlineGroup({ title, hint, airlines, badges, flightsUrl }) {
  if (airlines.length === 0) return null;
  return (
    <section>
      <SectionTitle as="h3" count={airlines.length} hint={hint}>
        {title}
      </SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {airlines.map((a) => (
          <AirlineCard key={a.code ?? a.name} airline={a} badges={badges(a)} flightsUrl={flightsUrl(a.name)} />
        ))}
      </div>
    </section>
  );
}

function AirlineCard({ airline, badges, flightsUrl }) {
  const siteUrl =
    airline.website ?? `https://www.google.com/search?q=${encodeURIComponent(`${airline.name} official website`)}`;
  const typeLabel = { 'low-cost': 'Лоукостер', full: 'Традиционная авиакомпания' }[airline.type] ?? 'Авиакомпания';
  return (
    <Card interactive className="relative flex flex-col gap-3 overflow-hidden p-4 pt-5">
      <div className="absolute inset-x-0 top-0 h-1" style={{ background: airline.color }} aria-hidden />
      <div className="flex items-center gap-3">
        <div
          className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-sm font-extrabold shadow-md"
          style={{ background: airline.color, color: airline.textColor ?? '#fff' }}
        >
          {airline.code ?? airline.name.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold text-slate-900">{airline.name}</p>
          <p className="text-xs text-slate-500">{typeLabel}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {badges.map((b) => (
          <Badge key={b.text} tone={b.tone}>
            {b.text}
          </Badge>
        ))}
      </div>
      <div className="mt-auto grid grid-cols-2 gap-2">
        <ExternalLink href={siteUrl} variant="primary">
          Официальный сайт
        </ExternalLink>
        <ExternalLink href={flightsUrl}>Её рейсы</ExternalLink>
      </div>
    </Card>
  );
}
