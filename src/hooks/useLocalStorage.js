import { useEffect, useState } from 'react';

const resolve = (v) => (typeof v === 'function' ? v() : v);

/** useState that survives reloads. Storage can be unavailable (private mode), so every access is guarded. */
export function useLocalStorage(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw != null ? JSON.parse(raw) : resolve(initial);
    } catch {
      return resolve(initial);
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage full or blocked — keep working in memory */
    }
  }, [key, value]);

  return [value, setValue];
}
