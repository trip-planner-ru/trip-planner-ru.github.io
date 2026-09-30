export const inputClass =
  'h-11 w-full rounded-xl border-0 bg-white px-3.5 text-sm text-slate-800 shadow-sm ring-1 ring-slate-200 transition placeholder:text-slate-400 hover:ring-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500';

export function Field({ label, children, className = '' }) {
  return (
    <label className={`flex min-w-0 flex-col gap-1.5 ${className}`}>
      <span className="text-xs font-semibold text-slate-500">{label}</span>
      {children}
    </label>
  );
}

/** Surface for content. `interactive` adds a hover lift for cards that hold actions. */
export function Card({ children, className = '', interactive = false }) {
  return (
    <div
      className={`rounded-2xl border border-white/70 bg-white/80 shadow-[0_1px_2px_rgb(15_23_42/0.04),0_12px_32px_-16px_rgb(15_23_42/0.18)] backdrop-blur-sm ${
        interactive ? 'transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_2px_4px_rgb(15_23_42/0.05),0_20px_40px_-18px_rgb(79_70_229/0.35)]' : ''
      } ${className}`}
    >
      {children}
    </div>
  );
}

const buttonVariants = {
  primary:
    'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/25 hover:from-indigo-500 hover:to-violet-500 hover:shadow-lg hover:shadow-indigo-500/30',
  booking: 'bg-[#003580] text-white shadow-md shadow-blue-900/20 hover:bg-[#00296b]',
  secondary: 'bg-white text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 hover:ring-slate-300',
  ghost: 'text-slate-600 hover:bg-slate-900/5',
  saved: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100',
};
const buttonBase =
  'inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition duration-150 active:scale-[0.98] disabled:opacity-50';

export function Button({ variant = 'secondary', className = '', ...props }) {
  return <button type="button" className={`${buttonBase} ${buttonVariants[variant]} ${className}`} {...props} />;
}

/** Anchor styled as a button; always opens in a new tab without leaking window.opener. */
export function ExternalLink({ href, variant = 'secondary', className = '', children }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`${buttonBase} ${buttonVariants[variant]} ${className}`}
    >
      {children}
      <span aria-hidden className="text-xs opacity-70">
        ↗
      </span>
    </a>
  );
}

export function EmptyState({ title, children, icon = '🧭' }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 px-6 py-10 text-center backdrop-blur-sm">
      <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-indigo-50 text-2xl" aria-hidden>
        {icon}
      </div>
      <p className="font-semibold text-slate-800">{title}</p>
      {children && <p className="mt-1 text-sm text-slate-500">{children}</p>}
    </div>
  );
}

/** Section heading with a count pill and an optional hint line. */
export function SectionTitle({ children, count, hint, as: Tag = 'h2' }) {
  return (
    <div className="mb-3">
      <Tag className="flex items-center gap-2 text-lg font-bold tracking-tight text-slate-900">
        {children}
        {count != null && (
          <span className="rounded-full bg-slate-900/5 px-2 py-0.5 text-xs font-semibold text-slate-500">{count}</span>
        )}
      </Tag>
      {hint && <p className="mt-0.5 text-sm text-slate-500">{hint}</p>}
    </div>
  );
}

export function Badge({ children, tone = 'bg-slate-100 text-slate-600 ring-slate-200' }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${tone}`}>
      {children}
    </span>
  );
}
