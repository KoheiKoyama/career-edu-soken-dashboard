// 日付はすべて "YYYY-MM-DD" の文字列で扱う（日本時間基準）

export function todayJST(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(new Date());
}

function parse(d: string): [number, number, number] {
  const [y, m, day] = d.split("-").map(Number);
  return [y, m, day];
}

function fmt(y: number, m: number, d: number): string {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toISOString().slice(0, 10);
}

export function addDays(d: string, n: number): string {
  const [y, m, day] = parse(d);
  return fmt(y, m, day + n);
}

/** 月を足す。月末を越える場合はその月の末日に丸める（1/31 + 1か月 = 2/28） */
export function addMonths(d: string, n: number): string {
  const [y, m, day] = parse(d);
  const lastDay = new Date(Date.UTC(y, m - 1 + n + 1, 0)).getUTCDate();
  return fmt(y, m + n, Math.min(day, lastDay));
}

/** 契約終了日 = 契約開始日 + 契約月数 の前日 */
export function contractEndDate(start: string, months: number): string {
  return addDays(addMonths(start, months), -1);
}

/** 4月始まりの年度。2027-03-31 → 2026、2027-04-01 → 2027 */
export function fiscalYearOf(d: string): number {
  const [y, m] = parse(d);
  return m >= 4 ? y : y - 1;
}

export function fiscalYearRange(fy: number): { start: string; end: string } {
  return { start: `${fy}-04-01`, end: `${fy + 1}-03-31` };
}

export function fyLabel(fy: number): string {
  return `FY${fy}`;
}

export function monthStart(d: string): string {
  return d.slice(0, 8) + "01";
}

export function formatDate(d: string | null | undefined): string {
  if (!d) return "—";
  const [y, m, day] = parse(d);
  return `${y}/${m}/${day}`;
}

export function formatDateTime(d: Date): string {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function daysBetween(from: string, to: string): number {
  const [y1, m1, d1] = parse(from);
  const [y2, m2, d2] = parse(to);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}
