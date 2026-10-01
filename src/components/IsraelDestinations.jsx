import { useState } from 'react';
import { formatDate, plural } from '../lib/format';
import { ISRAEL_DESTINATIONS_DATE, searchCities } from '../lib/israelDestinations';
import { googleFlightsUrl } from '../lib/links';
import { Badge, Button, Card, ExternalLink, inputClass } from './ui';

const ORIGIN_NAMES = { TLV: 'Бен-Гурион (TLV)', ETM: 'Рамон (ETM)' };

/**
 * Every nonstop destination from the chosen Israeli airport, grouped by country and searchable.
 * Cities the app knows can be picked as the destination; the rest open Google Flights for that airport.
 */
export default function IsraelDestinations({ from, search, onPickCity }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const groups = searchCities(query, { from });
  const cityCount = groups.reduce((n, c) => n + c.cities.length, 0);
  const showList = open || query.trim() !== '';

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-wrap items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-sky-100 text-xl" aria-hidden>
          🌍
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold tracking-tight text-slate-900">Прямые рейсы из аэропорта {ORIGIN_NAMES[from]}</h2>
          <p className="text-sm text-slate-500">
            {plural(cityCount, 'город', 'города', 'городов')} в {plural(groups.length, 'стране', 'странах', 'странах')} · по
            данным Википедии на {formatDate(ISRAEL_DESTINATIONS_DATE)}, без чартеров
          </p>
        </div>
        <Button onClick={() => setOpen((v) => !v)}>{showList ? 'Свернуть' : 'Показать все'}</Button>
      </div>

      <input
        className={`${inputClass} mt-4`}
        placeholder="Поиск: город, страна или код аэропорта (например, Афины, Греция, ATH)"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {showList && (
        <div className="mt-4 max-h-[32rem] space-y-4 overflow-y-auto pr-1">
          {groups.length === 0 && <p className="text-sm text-slate-500">Ничего не найдено.</p>}
          {groups.map((country) => (
            <section key={country.code}>
              <h3 className="sticky top-0 z-10 bg-white/95 py-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-400 backdrop-blur">
                {country.nameRu}
              </h3>
              <ul className="divide-y divide-slate-100">
                {country.cities.map((city) => (
                  <li key={city.name} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-900">{city.nameRu}</p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {city.airports.map((a) => (
                          <span key={a.iata} title={`${a.nameRu}\nЛетают: ${a.airlines.join(', ')}`}>
                            <Badge tone="bg-slate-100 text-slate-700 ring-slate-200">
                              {a.iata}
                              {a.seasonal && <span className="ml-1 text-amber-600">· сезонный</span>}
                              <span className="ml-1 font-normal text-slate-400">· {plural(a.airlines.length, 'авиакомпания', 'авиакомпании', 'авиакомпаний')}</span>
                            </Badge>
                          </span>
                        ))}
                      </div>
                    </div>
                    {city.cityId ? (
                      <Button variant="primary" className="min-h-9 px-3 py-1.5 text-xs" onClick={() => onPickCity(city.cityId)}>
                        Выбрать
                      </Button>
                    ) : (
                      <ExternalLink href={googleFlightsUrl(from, city.airports[0].iata, search)} className="min-h-9 px-3 py-1.5 text-xs">
                        Рейсы
                      </ExternalLink>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
      <p className="mt-3 text-xs text-slate-400">
        «Выбрать» — город есть в программе: покажу авиакомпании и проверю прямые рейсы. «Рейсы» — откроется Google Flights.
        Наведите на код аэропорта, чтобы увидеть, кто туда летает.
      </p>
    </Card>
  );
}
