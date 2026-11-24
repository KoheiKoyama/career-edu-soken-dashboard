import type { ReactNode } from "react";
import Link from "next/link";

export function Card({ title, children, actions, className = "" }: { title?: ReactNode; children: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border border-slate-200 bg-white ${className}`}>
      {(title || actions) && (
        <header className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
          <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
          <div className="flex items-center gap-2">{actions}</div>
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

const stageColors: Record<string, string> = {
  リード: "bg-slate-100 text-slate-700",
  商談予定済み: "bg-sky-100 text-sky-800",
  商談済み: "bg-indigo-100 text-indigo-800",
  受注: "bg-emerald-100 text-emerald-800",
  失注: "bg-rose-100 text-rose-800",
  保留: "bg-amber-100 text-amber-800",
  Onboarding: "bg-teal-100 text-teal-800",
  "Customer Success": "bg-emerald-100 text-emerald-800",
  契約終了: "bg-slate-200 text-slate-600",
  未着手: "bg-slate-50 text-slate-500",
};

export function StageBadge({ stage }: { stage: string }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded px-2 py-0.5 text-xs font-medium ${stageColors[stage] ?? "bg-slate-100 text-slate-700"}`}>
      {stage}
    </span>
  );
}

export function Warn({ children, tone = "red" }: { children: ReactNode; tone?: "red" | "amber" }) {
  const c = tone === "red" ? "bg-red-50 text-red-700 ring-red-200" : "bg-amber-50 text-amber-800 ring-amber-200";
  return <span className={`inline-block whitespace-nowrap rounded px-1.5 py-0.5 text-xs ring-1 ${c}`}>{children}</span>;
}

export function Field({ label, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <label className={`flex flex-col gap-1 text-xs text-slate-600 ${wide ? "sm:col-span-2" : ""}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}

/** 絞り込みフォーム用（幅は呼び出し側で指定） */
export const filterCls =
  "rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none";

export const inputCls =
  "w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none disabled:bg-slate-100";

export function Select({ name, options, defaultValue, required, blank, className }: { name: string; options: readonly (string | { value: string; label: string })[]; defaultValue?: string | number | null; required?: boolean; blank?: string; className?: string }) {
  return (
    <select name={name} defaultValue={defaultValue == null ? "" : String(defaultValue)} required={required} className={className ?? inputCls}>
      {blank !== undefined && <option value="">{blank}</option>}
      {options.map((o) => {
        const v = typeof o === "string" ? o : o.value;
        const l = typeof o === "string" ? o : o.label;
        return (
          <option key={v} value={v}>
            {l}
          </option>
        );
      })}
    </select>
  );
}

export function Button({ children, variant = "primary", type = "submit" }: { children: ReactNode; variant?: "primary" | "ghost" | "danger"; type?: "submit" | "button" }) {
  const c = {
    primary: "bg-indigo-600 text-white hover:bg-indigo-700",
    ghost: "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
    danger: "border border-red-300 bg-white text-red-700 hover:bg-red-50",
  }[variant];
  return (
    <button type={type} className={`rounded px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${c}`}>
      {children}
    </button>
  );
}

/** クリックで開くフォーム（新規作成・編集用） */
export function Disclosure({ label, children, id, open }: { label: ReactNode; children: ReactNode; id?: string; open?: boolean }) {
  return (
    <details id={id} open={open} className="group">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-50">
        {label}
      </summary>
      <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 p-3">{children}</div>
    </details>
  );
}

export function Kpi({ label, value, sub, emphasis }: { label: string; value: ReactNode; sub?: ReactNode; emphasis?: boolean }) {
  return (
    <div className={`rounded-lg border p-4 ${emphasis ? "border-indigo-200 bg-indigo-50" : "border-slate-200 bg-white"}`}>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{value}</div>
      {sub && <div className="mt-1 text-xs tabular-nums text-slate-500">{sub}</div>}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-2 text-sm text-slate-400">{children}</p>;
}

export function AccountLink({ id, name }: { id: string; name: string }) {
  return (
    <Link href={`/accounts/${id}`} className="font-medium text-indigo-700 hover:underline">
      {name}
    </Link>
  );
}
