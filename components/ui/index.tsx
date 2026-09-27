"use client";

import { forwardRef, useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------- Button */
type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export const Button = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: "sm" | "md" }
>(function Button({ className, variant = "secondary", size = "md", ...props }, ref) {
  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "h-8 px-3 text-xs" : "h-10 px-4 text-sm",
        variant === "primary" && "bg-shell-900 text-white hover:bg-shell-700",
        variant === "secondary" && "border border-shell-200 bg-white text-shell-900 hover:bg-shell-100",
        variant === "ghost" && "text-shell-700 hover:bg-shell-100",
        variant === "danger" && "border border-red-200 bg-white text-red-700 hover:bg-red-50",
        className,
      )}
      {...props}
    />
  );
});

/* --------------------------------------------------------------- Field */
export function Field({
  label,
  hint,
  error,
  children,
  optional,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: (props: { id: string; "aria-describedby"?: string; "aria-invalid"?: boolean }) => ReactNode;
  optional?: boolean;
}) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="flex items-baseline gap-2 text-xs font-medium text-shell-700">
        {label}
        {optional ? <span className="text-[10px] font-normal text-shell-500">Optional</span> : null}
      </label>
      {children({ id, "aria-describedby": describedBy, "aria-invalid": Boolean(error) })}
      {hint && !error ? (
        <p id={`${id}-hint`} className="text-[11px] leading-snug text-shell-500">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-[11px] font-medium text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const controlClasses =
  "w-full rounded-lg border border-shell-200 bg-white px-3 py-2 text-sm text-shell-900 placeholder:text-shell-300 focus:border-shell-900 focus:outline-none aria-[invalid=true]:border-red-400";

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(controlClasses, className)} {...props} />;
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return <textarea ref={ref} rows={3} className={cn(controlClasses, "resize-y", className)} {...props} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...props }, ref) {
    return (
      <select ref={ref} className={cn(controlClasses, "appearance-none pr-8", className)} {...props}>
        {children}
      </select>
    );
  },
);

/* ------------------------------------------------------------- Toggles */
export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-5 w-9 shrink-0 rounded-full transition",
        checked ? "bg-shell-900" : "bg-shell-300",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 size-4 rounded-full bg-white transition-all",
          checked ? "left-[1.125rem]" : "left-0.5",
        )}
      />
    </button>
  );
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg border border-shell-200 bg-shell-100 p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "rounded-[6px] px-3 py-1.5 text-xs font-medium transition",
            value === option.value ? "bg-white text-shell-900 shadow-sm" : "text-shell-500 hover:text-shell-700",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/* ----------------------------------------------------------- Disclosure */
export function Disclosure({
  title,
  children,
  defaultOpen = false,
  badge,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  badge?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();

  return (
    <div className="rounded-lg border border-dashed border-shell-200">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={id}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-xs font-medium text-shell-700 hover:text-shell-900"
      >
        <span className="flex items-center gap-2">
          <span className="text-shell-500">+</span>
          {title}
          {badge ? (
            <span className="rounded-full bg-shell-100 px-2 py-0.5 text-[10px] text-shell-500">{badge}</span>
          ) : null}
        </span>
        <ChevronDown className={cn("size-3.5 shrink-0 transition", open && "rotate-180")} aria-hidden />
      </button>
      {open ? (
        <div id={id} className="space-y-4 border-t border-shell-200 px-3 py-4">
          {children}
        </div>
      ) : null}
    </div>
  );
}

/* ---------------------------------------------------------------- Misc */
export function SectionCard({
  title,
  description,
  children,
  action,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="rounded-panel border border-shell-200 bg-white p-5">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-shell-900">{title}</h2>
          {description ? <p className="mt-0.5 text-xs text-shell-500">{description}</p> : null}
        </div>
        {action}
      </header>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export function Tooltip({ text, children }: { text: string; children: ReactNode }) {
  return (
    <span className="group relative inline-flex">
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1.5 w-56 -translate-x-1/2 rounded-md bg-shell-900 px-2.5 py-1.5 text-[11px] leading-snug text-white opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {text}
      </span>
    </span>
  );
}

export function Alert({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "warning" | "error" | "success";
  title?: string;
  children: ReactNode;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "rounded-lg border px-3 py-2.5 text-xs leading-relaxed",
        tone === "info" && "border-shell-200 bg-shell-100 text-shell-700",
        tone === "warning" && "border-amber-200 bg-amber-50 text-amber-900",
        tone === "error" && "border-red-200 bg-red-50 text-red-800",
        tone === "success" && "border-emerald-200 bg-emerald-50 text-emerald-800",
      )}
    >
      {title ? <p className="mb-0.5 font-semibold">{title}</p> : null}
      {children}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-shell-200", className)} />;
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-panel border border-dashed border-shell-300 bg-white px-6 py-14 text-center">
      <h3 className="text-sm font-semibold text-shell-900">{title}</h3>
      <p className="mx-auto mt-1.5 max-w-sm text-xs leading-relaxed text-shell-500">{description}</p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}
