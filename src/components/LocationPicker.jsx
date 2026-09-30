import { countries, cityById } from '../lib/locations';
import { Field, inputClass } from './ui';

/** Country + city selects bound to a single cityId. */
export default function LocationPicker({ label, cityId, onChange }) {
  const city = cityById(cityId);
  const countryCode = city?.countryCode ?? countries[0].code;
  const country = countries.find((c) => c.code === countryCode);

  return (
    <div className="grid grid-cols-2 gap-2">
      <Field label={`${label} — страна`}>
        <select
          className={inputClass}
          value={countryCode}
          onChange={(e) => onChange(countries.find((c) => c.code === e.target.value).cities[0].id)}
        >
          {countries.map((c) => (
            <option key={c.code} value={c.code}>
              {c.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label={`${label} — город`}>
        <select className={inputClass} value={cityId} onChange={(e) => onChange(e.target.value)}>
          {country.cities.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label} ({c.airport})
            </option>
          ))}
        </select>
      </Field>
    </div>
  );
}
