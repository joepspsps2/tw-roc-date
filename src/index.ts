/**
 * @joelincc/tw-roc-date — 民國日期讀寫、申報格式、台北今天、月份加減不溢出。
 *
 * 日期一律用字串 'YYYY-MM-DD'（西元、補零）傳進傳出，不用 Date 物件，避免時區把日期推前推後。
 * 「顯示」民國日期請直接用平台內建：
 *   new Intl.DateTimeFormat('zh-TW-u-ca-roc', { timeZone: 'Asia/Taipei', dateStyle: 'long' }).format(d) // 民國115年11月6日
 */

/* ───────────── 基本 ───────────── */

/** 西元年是否為閏年 */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** 某年某月有幾天（month 為 1–12） */
export function daysInMonth(year: number, month: number): number {
  return [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] ?? NaN;
}

function pad(n: number, w = 2): string {
  return String(n).padStart(w, '0');
}

function ymdOk(y: number, m: number, d: number): boolean {
  return Number.isInteger(y) && Number.isInteger(m) && Number.isInteger(d)
    && y >= 1 && y <= 9999 && m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m);
}

function iso(y: number, m: number, d: number): string {
  return `${pad(y, 4)}-${pad(m)}-${pad(d)}`;
}

function splitIso(s: string): [number, number, number] | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const y = +m[1], mo = +m[2], d = +m[3];
  return ymdOk(y, mo, d) ? [y, mo, d] : null;
}

/** 'YYYY-MM-DD' 是否為真的存在的日期（2026-02-29 → false） */
export function isValidDate(s: string): boolean {
  return splitIso(s) !== null;
}

/* ───────────── 年份換算 ───────────── */

/** 西元年 → 民國年（1912＝1）。1911 以前回傳 ≤ 0：0＝民國前 1 年、-1＝民國前 2 年。 */
export function adToRoc(year: number): number {
  return year - 1911;
}

/** 民國年 → 西元年；before=true 表示「民國前 N 年」（民國前 1 年＝1911） */
export function rocToAd(roc: number, options: { before?: boolean } = {}): number {
  return options.before ? 1912 - roc : roc + 1911;
}

/** 西元年 → 「民國 115 年」／「民國前 1 年」 */
export function rocLabel(year: number): string {
  return year >= 1912 ? `民國 ${year - 1911} 年` : `民國前 ${1912 - year} 年`;
}

/* ───────────── 讀民國／西元字串 ───────────── */

export interface ParseOptions {
  /** 年份幾位數以內當民國年（預設 3：1–3 位數＝民國、4 位數＝西元） */
  rocMaxDigits?: number;
  /** 換成西元後允許的最小年份（含），超出回 null。例：帳務資料可設 1990 */
  minYear?: number;
  /** 換成西元後允許的最大年份（含），超出回 null。例：帳務資料可設 2100 */
  maxYear?: number;
}

/** 日期字串再長也不會超過這個長度；更長的直接當看不懂，也避免正規表示式被超長輸入拖慢 */
const MAX_INPUT = 64;

/** 全形數字與符號轉半形、去頭尾空白 */
function normalize(input: string): string {
  return input.normalize('NFKC').trim();
}

interface YearToken { raw: string; before: boolean }

function resolveYear(t: YearToken, opt: ParseOptions): number | null {
  const n = Number(t.raw);
  if (!Number.isInteger(n)) return null;
  const rocMax = opt.rocMaxDigits ?? 3;
  let y: number;
  if (t.before) {
    if (n < 1) return null;
    y = rocToAd(n, { before: true });
  } else if (t.raw.length <= rocMax) {
    if (n < 1) return null; // 沒有民國 0 年
    y = rocToAd(n);
  } else if (t.raw.length === 4) {
    if (t.raw[0] === '0') return null; // 0115/11/06：補零的民國年？西元 115 年？不猜
    y = n;
  } else return null;
  if (opt.minYear !== undefined && y < opt.minYear) return null;
  if (opt.maxYear !== undefined && y > opt.maxYear) return null;
  return y;
}

/** 連寫的西元（20261106、202610）只收 1800–2199 年，避免把 990101 這類 6 碼民國日期讀成西元 9901 年 */
const COMPACT_AD = /^(1[89]|2[01])\d/;

/** 拆掉「民國」「民國前」「民前」前綴；回傳剩下的字與是否為民國前 */
function stripPrefix(s: string): { rest: string; before: boolean; roc: boolean } {
  const m = /^(民國前|民前|民國|民)\s*/.exec(s);
  if (!m) return { rest: s, before: false, roc: false };
  return { rest: s.slice(m[0].length), before: m[1] === '民國前' || m[1] === '民前', roc: true };
}

/**
 * 讀一個日期字串（民國或西元），回傳 'YYYY-MM-DD'；看不懂或日期不存在回 null。
 *
 * 吃得下：1151106、115/11/06、115.11.6、115-11-6、115年11月6日、民國115年11月6日、民國前1年6月1日、
 * 2026-11-06、2026/11/6、20261106、全形數字；後面接空白或 T 再接時間（115/11/06 14:30）會忽略時間。
 */
export function parseRocDate(input: string, options: ParseOptions = {}): string | null {
  if (typeof input !== 'string' || input.length > MAX_INPUT) return null;
  let s = normalize(input);
  // 去掉後面的時間：「115/11/06 14:30」「2026-11-06T08:00」
  s = s.replace(/(?:\s+(?:(?:上午|下午|AM|PM|am|pm)\s*)?|T)\d{1,2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?$/, '');
  const { rest, before, roc } = stripPrefix(s);
  let y: string, mo: string, d: string;
  let m = /^(\d{1,4})\s*(?:[/.\-]|年)\s*(\d{1,2})\s*(?:[/.\-]|月)\s*(\d{1,2})\s*日?$/.exec(rest);
  if (m) {
    [y, mo, d] = [m[1], m[2], m[3]];
    // 「年」「月」要成對：115年11/6 這種混搭不收
    const usesChar = /年/.test(rest), usesMonthChar = /月/.test(rest);
    if (usesChar !== usesMonthChar) return null;
  } else if ((m = /^(\d{7})$/.exec(rest))) {
    [y, mo, d] = [rest.slice(0, 3), rest.slice(3, 5), rest.slice(5)];
  } else if ((m = /^(\d{8})$/.exec(rest)) && !roc && COMPACT_AD.test(rest)) {
    [y, mo, d] = [rest.slice(0, 4), rest.slice(4, 6), rest.slice(6)];
  } else return null;
  // 有「民國」前綴卻寫 4 位數年份：不收（民國 2026 年不存在）
  if (roc && y.length > (options.rocMaxDigits ?? 3)) return null;
  const year = resolveYear({ raw: y, before }, options);
  if (year === null) return null;
  const month = +mo, day = +d;
  return ymdOk(year, month, day) ? iso(year, month, day) : null;
}

/**
 * 讀民國／西元年月，回傳 'YYYY-MM'；看不懂回 null。
 * 吃得下：11510、115/10、115-10、115.10、115年10月、民國115年10月、2026-10、2026/10、202610。
 */
export function parseRocYearMonth(input: string, options: ParseOptions = {}): string | null {
  if (typeof input !== 'string' || input.length > MAX_INPUT) return null;
  const { rest, before, roc } = stripPrefix(normalize(input));
  let y: string, mo: string;
  let m = /^(\d{1,4})\s*(?:[/.\-]|年)\s*(\d{1,2})\s*(?:月份?)?$/.exec(rest);
  if (m) {
    [y, mo] = [m[1], m[2]];
    if (/年/.test(rest) !== /月/.test(rest)) return null;
  } else if (/^\d{5}$/.test(rest)) {
    [y, mo] = [rest.slice(0, 3), rest.slice(3)];
  } else if (/^\d{6}$/.test(rest) && !roc && COMPACT_AD.test(rest)) {
    [y, mo] = [rest.slice(0, 4), rest.slice(4)];
  } else return null;
  if (roc && y.length > (options.rocMaxDigits ?? 3)) return null;
  const year = resolveYear({ raw: y, before }, options);
  const month = +mo;
  if (year === null || !Number.isInteger(month) || month < 1 || month > 12) return null;
  return `${pad(year, 4)}-${pad(month)}`;
}

/* ───────────── 寫申報格式 ───────────── */

function yearOf(dateOrYear: string | number): number | null {
  if (typeof dateOrYear === 'number') return Number.isInteger(dateOrYear) ? dateOrYear : null;
  const m = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/.exec(dateOrYear);
  if (!m) return null;
  if (m[3] !== undefined) return splitIso(dateOrYear)?.[0] ?? null;
  if (m[2] !== undefined && (+m[2] < 1 || +m[2] > 12)) return null;
  return +m[1];
}

/**
 * 民國年 3 碼（申報、檔名用）：2026 或 '2026-11-06' → '115'；2011 → '100'；1999 → '088'。
 * 民國元年以前（1911 以前）、民國 1000 年以後（3 碼放不下）或格式不對回 null。
 */
export function toRocYear(dateOrYear: string | number): string | null {
  const y = yearOf(dateOrYear);
  if (y === null || y < 1912 || y > 2910) return null;
  return pad(y - 1911, 3);
}

/** 民國年月 5 碼：'2026-10-06' 或 '2026-10' → '11510'。格式不對、民國元年以前或民國 1000 年以後回 null。 */
export function toRocYearMonth(date: string): string | null {
  const m = /^(\d{4})-(\d{2})(?:-\d{2})?$/.exec(date);
  if (!m) return null;
  if (date.length === 10 && !isValidDate(date)) return null;
  if (+m[2] < 1 || +m[2] > 12) return null;
  const ry = toRocYear(+m[1]);
  return ry === null ? null : `${ry}${m[2]}`;
}

/**
 * 民國日期：'2026-11-06' → '1151106'；給分隔符號則 '115/11/06'。
 * 日期不存在、民國元年以前或民國 1000 年以後回 null。
 */
export function toRocDate(date: string, separator = ''): string | null {
  const p = splitIso(date);
  if (!p) return null;
  const ry = toRocYear(p[0]);
  return ry === null ? null : [ry, pad(p[1]), pad(p[2])].join(separator);
}

/* ───────────── 台北時間 ───────────── */

const taipeiFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit',
});

/**
 * 某個時間點在台北是哪一天（'YYYY-MM-DD'）。用平台的時區資料，連 1979 年以前的夏令時間都對。
 * 接受 Date、毫秒數、或 Date 讀得懂的字串（例 '2026-11-05T16:30:00Z'）。
 */
export function taipeiDate(at: Date | number | string): string | null {
  const d = at instanceof Date ? at : new Date(at);
  if (!Number.isFinite(d.getTime())) return null;
  const utcYear = d.getUTCFullYear();
  if (utcYear < 1 || utcYear > 9998) return null; // 西元前或超過 9999 年：不處理
  const parts = taipeiFmt.formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return iso(get('year'), get('month'), get('day'));
}

/** 台北的今天 'YYYY-MM-DD'；now 可傳入固定時間方便測試 */
export function taipeiToday(now: Date | number = Date.now()): string {
  return taipeiDate(now) as string;
}

/** 台北的本月 'YYYY-MM' */
export function taipeiMonth(now: Date | number = Date.now()): string {
  return taipeiToday(now).slice(0, 7);
}

/** 台北的今年（西元） */
export function taipeiYear(now: Date | number = Date.now()): number {
  return Number(taipeiToday(now).slice(0, 4));
}

/** 台北的今年（民國） */
export function taipeiRocYear(now: Date | number = Date.now()): number {
  return adToRoc(taipeiYear(now));
}

/* ───────────── 日期加減 ───────────── */

/**
 * 加減月份，月底不夠就取該月最後一天：'2026-08-31' −6 → '2026-02-28'、'2026-12-31' −6 → '2026-06-30'。
 * 日期不存在回 null。
 */
export function addMonths(date: string, months: number): string | null {
  const p = splitIso(date);
  if (!p || !Number.isInteger(months)) return null;
  const t = p[0] * 12 + (p[1] - 1) + months;
  const y = Math.floor(t / 12);
  const m = t - y * 12 + 1;
  if (y < 1 || y > 9999) return null;
  return iso(y, m, Math.min(p[2], daysInMonth(y, m)));
}

/** 加減天數：'2026-12-31' +1 → '2027-01-01'。日期不存在回 null。 */
export function addDays(date: string, days: number): string | null {
  const p = splitIso(date);
  if (!p || !Number.isInteger(days)) return null;
  const dt = new Date(Date.UTC(2000, p[1] - 1, p[2]));
  dt.setUTCFullYear(p[0]);
  dt.setUTCDate(dt.getUTCDate() + days);
  if (!Number.isFinite(dt.getTime())) return null;
  const y = dt.getUTCFullYear();
  if (y < 1 || y > 9999) return null;
  return iso(y, dt.getUTCMonth() + 1, dt.getUTCDate());
}
