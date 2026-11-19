import clsx from "clsx";

type Common = { label: string; name: string; error?: string; hint?: string; required?: boolean; className?: string };

export function FieldShell({ label, name, error, hint, required, className, children }: Common & { children: React.ReactNode }) {
  return (
    <div className={className}>
      <label htmlFor={name} className="label">
        {label} {required && <span className="text-neon">*</span>}
      </label>
      {children}
      {error ? (
        <p id={`${name}-error`} className="mt-1.5 text-xs text-neon-soft">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-zinc-500">{hint}</p>
      ) : null}
    </div>
  );
}

export function Input({ label, name, error, hint, required, className, ...rest }: Common & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <FieldShell {...{ label, name, error, hint, required, className }}>
      <input id={name} name={name} required={required} aria-invalid={!!error} aria-describedby={error ? `${name}-error` : undefined} className="input" {...rest} />
    </FieldShell>
  );
}

export function Textarea({ label, name, error, hint, required, className, ...rest }: Common & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <FieldShell {...{ label, name, error, hint, required, className }}>
      <textarea id={name} name={name} required={required} aria-invalid={!!error} className={clsx("input min-h-28 resize-y")} {...rest} />
    </FieldShell>
  );
}

export function Select({
  label,
  name,
  error,
  hint,
  required,
  className,
  options,
  ...rest
}: Common & React.SelectHTMLAttributes<HTMLSelectElement> & { options: { value: string; label: string }[] }) {
  return (
    <FieldShell {...{ label, name, error, hint, required, className }}>
      <select id={name} name={name} required={required} aria-invalid={!!error} className="input appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%23a1a1aa%22 stroke-width=%222%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-[right_12px_center] bg-no-repeat pr-9" {...rest}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div role="alert" className="rounded-xl border border-mint/60 bg-mint/15 px-3.5 py-2.5 text-sm text-[#ff9b9b]">
      {message}
    </div>
  );
}
