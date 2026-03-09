import { differenceInDays, differenceInYears } from "date-fns";

const MONTHS_PT = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

function parseDate(d) {
  if (!d) return null;
  const dt = new Date(d);
  // fix timezone offset so "2026-02-14" doesn't become Feb 13
  return new Date(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate());
}

function formatAbsolute(dt) {
  const d = String(dt.getDate()).padStart(2, "0");
  const m = MONTHS_PT[dt.getMonth()];
  const y = dt.getFullYear();
  return `${d}-${m}-${y}`;
}

function relativeText(diffDays) {
  const abs = Math.abs(diffDays);
  const past = diffDays < 0;

  if (abs === 0) return null; // hoje
  if (abs === 1) return null; // ontem / amanhã

  const years = Math.floor(abs / 365);
  const remDays = abs % 365;

  if (years === 0) {
    return past ? `há ${abs} dias` : `em ${abs} dias`;
  }
  if (remDays === 0) {
    return past
      ? `Há ${years} ${years === 1 ? "ano" : "anos"}`
      : `Em ${years} ${years === 1 ? "ano" : "anos"}`;
  }
  return past
    ? `Há ${years} ${years === 1 ? "ano" : "anos"} e ${remDays} dias`
    : `Em ${years} ${years === 1 ? "ano" : "anos"} e ${remDays} dias`;
}

/**
 * Returns { main: string, sub: string|null }
 * sub is the relative description shown in italic gray
 */
function smartDate(d) {
  const dt = parseDate(d);
  if (!dt) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffMs = dt - today;
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return { main: "hoje", sub: null };
  if (diffDays === -1) return { main: "Ontem", sub: null };
  if (diffDays === 1) return { main: "Amanhã", sub: null };

  const abs = Math.abs(diffDays);

  // < 7 days: only relative
  if (abs < 7) {
    const text = diffDays < 0 ? `há ${abs} dias` : `em ${abs} dias`;
    return { main: text, sub: null };
  }

  // >= 7 days: show absolute date + relative in sub
  return { main: formatAbsolute(dt), sub: relativeText(diffDays) };
}

export default function SmartDate({ date, className = "" }) {
  if (!date) return <span className="text-slate-700">—</span>;
  const result = smartDate(date);
  if (!result) return <span className="text-slate-700">—</span>;

  return (
    <span className={`inline-flex items-baseline gap-1.5 whitespace-nowrap ${className}`}>
      <span className="text-slate-300 text-sm">{result.main}</span>
      {result.sub && (
        <span className="text-slate-500 text-xs italic">{result.sub}</span>
      )}
    </span>
  );
}