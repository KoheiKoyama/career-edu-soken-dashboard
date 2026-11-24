export function yen(n: number | null | undefined): string {
  if (n == null) return "—";
  return "¥" + Math.round(n).toLocaleString("ja-JP");
}

/** 万円単位の短い表記（KPIカード用） */
export function yenShort(n: number): string {
  if (Math.abs(n) >= 100_000_000) return `${(n / 100_000_000).toFixed(2)}億円`;
  if (Math.abs(n) >= 10_000) return `${Math.round(n / 10_000).toLocaleString("ja-JP")}万円`;
  return `${Math.round(n).toLocaleString("ja-JP")}円`;
}

export function people(n: number | null | undefined): string {
  if (n == null) return "—";
  return `${n.toLocaleString("ja-JP")}人`;
}

export function pct(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(1)}%`;
}
