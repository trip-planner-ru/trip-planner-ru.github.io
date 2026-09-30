import { useEffect, useState } from 'react';
import { useTrip } from '../context/TripContext';
import { addDays, formatDate, plural, stayFromSearch, todayISO } from '../lib/format';
import { cityById } from '../lib/locations';
import { FILL_LABELS, STAY_GROUPS, STAY_TOOLS, stayToolUrl } from '../lib/stays';
import LocationPicker from './LocationPicker';
import { Badge, Card, ExternalLink, Field, inputClass, SectionTitle } from './ui';

export default function HotelsTab() {
  const { search, updateSearch } = useTrip();
  const city = cityById(search.destinationCityId);
  const [district, setDistrict] = useState('');
  useEffect(() => setDistrict(''), [city.id]);

  // Stay dates follow the trip: check-in = departure, check-out = return (one-way trips keep their own).
  const oneWay = search.tripType !== 'round';
  const { checkIn, checkOut, nights, guests } = stayFromSearch(search);
  const params = { city, district, checkIn, checkOut, guests };
  const placeLabel = district ? `${district}, ${city.label}` : city.label;

  return (
    <div className="space-y-6">
      <Card className="p-4 sm:p-5">
        <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <LocationPicker label="Куда" cityId={city.id} onChange={(id) => updateSearch({ destinationCityId: id })} />
          <Field label="Район">
            <select className={inputClass} value={district} onChange={(e) => setDistrict(e.target.value)}>
              <option value="">Весь город</option>
              {city.districts.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </Field>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Field label="Заезд">
            <input
              type="date"
              className={inputClass}
              min={todayISO()}
              value={checkIn}
              onChange={(e) =>
                e.target.value &&
                updateSearch({
                  departDate: e.target.value,
                  returnDate: search.returnDate <= e.target.value ? addDays(e.target.value, 3) : search.returnDate,
                })
              }
            />
          </Field>
          <Field label="Выезд">
            <input
              type="date"
              className={inputClass}
              min={addDays(checkIn, 1)}
              value={checkOut}
              onChange={(e) =>
                e.target.value && updateSearch(oneWay ? { hotelCheckOut: e.target.value } : { returnDate: e.target.value })
              }
            />
          </Field>
          <Field label="Гости">
            <select className={inputClass} value={guests} onChange={(e) => updateSearch({ passengers: Number(e.target.value) })}>
              {Array.from({ length: 9 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {plural(n, 'гость', 'гостя', 'гостей')}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </Card>

      <Card className="space-y-2 !border-indigo-100 !bg-gradient-to-br !from-indigo-50/90 !to-sky-50/90 p-5 text-sm leading-relaxed text-slate-700">
        <p>
          <span className="font-semibold">Жильё: {placeLabel}</span> · {formatDate(checkIn)} – {formatDate(checkOut)} ·{' '}
          {plural(nights, 'ночь', 'ночи', 'ночей')} · {plural(guests, 'гость', 'гостя', 'гостей')}
        </p>
        <p>
          Точных цен на гостиницы программа не знает, поэтому сама гостиницы не показывает. Каждый сайт ниже открывает свой
          поиск — с настоящими ценами и свободными номерами на ваши даты.
        </p>
        <p>
          <span className="font-semibold">Как пользоваться:</span> найдите жильё на сайте бронирования, сравните цену на
          сайте сравнения цен, а потом загляните на сайт самой гостиницы — при бронировании напрямую гостиницы часто дают ту
          же цену и добавляют завтрак или бесплатную отмену.
        </p>
      </Card>

      {STAY_GROUPS.map((group) => (
        <section key={group.id}>
          <SectionTitle hint={group.hint}>{group.title}</SectionTitle>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {STAY_TOOLS.filter((t) => t.group === group.id).map((tool) => (
              <ToolCard key={tool.id} tool={tool} href={stayToolUrl(tool, params)} place={placeLabel} city={city.label} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function ToolCard({ tool, href, place, city }) {
  const fill = FILL_LABELS[tool.fills];
  const searchPlace = tool.cityOnly ? city : place;
  return (
    <Card interactive className="flex flex-col gap-3 p-5">
      <div className="flex items-center gap-3">
        <div
          className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-lg font-extrabold text-white shadow-md"
          style={{ background: `linear-gradient(135deg, ${tool.color}, ${tool.color}cc)` }}
          aria-hidden
        >
          {tool.name[0].toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="font-bold text-slate-900">{tool.name}</p>
          <p className="text-xs text-slate-500">{tool.what}</p>
        </div>
      </div>
      <dl className="space-y-1.5 text-sm">
        <div>
          <dt className="inline font-medium text-slate-700">Удобно для: </dt>
          <dd className="inline text-slate-600">{tool.bestFor}</dd>
        </div>
        <div>
          <dt className="inline font-medium text-slate-700">Важно знать: </dt>
          <dd className="inline text-slate-600">{tool.note}</dd>
        </div>
      </dl>
      <div>
        <Badge tone={fill.tone}>{fill.text}</Badge>
      </div>
      <ExternalLink href={href} variant="primary" className="mt-auto w-full">
        {tool.fills === 'none' ? `Открыть ${tool.name}` : `Искать на ${tool.name}: ${searchPlace}`}
      </ExternalLink>
    </Card>
  );
}
