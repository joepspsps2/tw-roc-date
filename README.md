# @joelincc/tw-roc-date

民國日期的讀與寫：讀懂各家民國寫法、寫出申報用的格式、算出「台北的今天」、加減月份不跑過月底。

民國年換算公式人人會（＋1911），麻煩的是兩件事：

1. **各家寫法不一樣**：網銀寫 `115/11/06`，電子發票寫 `1151106`，勞健保帳單寫 `115年11月6日`，有人用全形數字，有人寫「民國前 1 年」。
2. **「今天」是哪一天**：伺服器和瀏覽器的 `new Date().toISOString()` 給的是世界標準時間，台北凌晨 0 點到 8 點會變成昨天；跨年那幾個小時，民國年還會錯一年。

這個套件只處理這兩件事和申報格式，**不重做平台已經會的事**。

- **沒有外部依賴**：只用平台內建的 `Intl`，Node.js 22 以上、瀏覽器、Cloudflare Workers 都能跑。
- **日期一律用字串 `'YYYY-MM-DD'`** 傳進傳出，不用 `Date` 物件，避免時區把日期推前推後。
- **超過 64 個字的輸入直接回 `null`**（日期字串不會這麼長，也避免被超長輸入拖慢）。
- **不存在的日期一律回 `null`**：`115/2/29`、`115/02/30` 不會被偷偷改成 3 月。

## 安裝

```bash
npm install @joelincc/tw-roc-date
```

## 用法

```ts
import {
  parseRocDate, parseRocYearMonth, toRocYear, toRocYearMonth, toRocDate,
  taipeiToday, taipeiDate, taipeiRocYear, addMonths, rocLabel,
} from '@joelincc/tw-roc-date';

// 讀：各種寫法 → 'YYYY-MM-DD'
parseRocDate('1151106');            // '2026-11-06'
parseRocDate('115/11/06 14:30');    // '2026-11-06'（後面的時間會忽略）
parseRocDate('民國115年11月6日');    // '2026-11-06'
parseRocDate('１１５．１１．６');    // '2026-11-06'（全形也收）
parseRocDate('民國前1年6月1日');     // '1911-06-01'
parseRocDate('2026/11/6');          // '2026-11-06'（西元照收）
parseRocDate('115/02/30');          // null（日期不存在）
parseRocYearMonth('11510');         // '2026-10'

// 寫：申報、檔名用的固定位數
toRocYear('2026-11-06');            // '115'（3 碼，1999 → '088'）
toRocYearMonth('2026-10-06');       // '11510'
toRocDate('2026-11-06');            // '1151106'
toRocDate('2026-11-06', '/');       // '115/11/06'

// 台北時間
taipeiToday();                      // 台北的今天，例 '2026-11-06'（凌晨也對）
taipeiDate('2026-11-05T16:30:00Z'); // '2026-11-06'
taipeiRocYear();                    // 115

// 加減月份：月底不夠就取該月最後一天
addMonths('2026-08-31', -6);        // '2026-02-28'（直接用 Date.setMonth 會得到 3/3）
addMonths('2026-12-31', -6);        // '2026-06-30'

rocLabel(1911);                     // '民國前 1 年'
```

### 只是要「顯示」民國日期？用平台內建就好

```ts
new Intl.DateTimeFormat('zh-TW-u-ca-roc', { timeZone: 'Asia/Taipei', dateStyle: 'long' }).format(new Date());
// '民國115年11月6日'（民國前、跨年都正確）
```

## 函式一覽

| 函式 | 做什麼 |
|---|---|
| `parseRocDate(s, options?)` | 民國或西元日期字串 → `'YYYY-MM-DD'`；看不懂或日期不存在回 `null` |
| `parseRocYearMonth(s, options?)` | 民國或西元年月 → `'YYYY-MM'` |
| `toRocYear(dateOrYear)` | → 3 碼民國年 `'115'`；民國元年以前、民國 1000 年以後（3 碼放不下）回 `null`；下面兩支同 |
| `toRocYearMonth(date)` | → 5 碼 `'11510'` |
| `toRocDate(date, separator?)` | → 7 碼 `'1151106'`，或 `'115/11/06'` |
| `taipeiToday(now?)`、`taipeiMonth(now?)`、`taipeiYear(now?)`、`taipeiRocYear(now?)` | 台北的今天、本月、今年；`now` 可傳固定時間方便測試 |
| `taipeiDate(at)` | 某個時間點在台北是哪一天 |
| `addMonths(date, n)`、`addDays(date, n)` | 加減月份（夾住月底）、天數 |
| `isValidDate(date)`、`isLeapYear(y)`、`daysInMonth(y, m)` | 日期是否存在、閏年、當月天數 |
| `adToRoc(y)`、`rocToAd(roc, { before })`、`rocLabel(y)` | 年份換算（含民國前） |

### 讀字串的選項

| 選項 | 預設 | 說明 |
|---|---|---|
| `rocMaxDigits` | `3` | 年份幾位數以內當民國年（1–3 位數＝民國，4 位數＝西元） |
| `minYear`、`maxYear` | 不限 | 換成西元後的合理範圍，超出回 `null`。帳務資料常設 `{ minYear: 1990, maxYear: 2100 }`，擋掉讀錯的雜訊 |

### 收哪些寫法

| 寫法 | 例 |
|---|---|
| 斜線、點、橫線 | `115/11/06`、`115.11.6`、`115-11-06`、`99/12/31`、`2026/11/6` |
| 年月日 | `115年11月6日`、`115 年 11 月 6 日`、`2026年11月6日` |
| 前綴 | `民國`、`民`、`民國前`、`民前` |
| 連寫 | 7 碼民國 `1151106`、8 碼西元 `20261106`（連寫的西元只收 1800–2199 年） |
| 全形 | `１１５／１１／０６` |
| 後面接時間 | `115/11/06 14:30`、`115/11/06 下午 02:30:00`、`2026-11-06T08:00:00Z` |

⚠️ **字串後面的時間只會被丟掉，不會換時區**：`'2026-11-05T20:00:00Z'` 讀成 `'2026-11-05'`，但那個時間點在台北已經是 11/6。手上是「帶時區的時間點」時請改用 `taipeiDate()`。

**不收**：國字數字（`一一五年`）、`年` 和斜線混寫（`115年11/6`）、民國 0 年、`民國2026年`、補零的 4 碼年份（`0115/11/06`）、6 碼民國日期（`990101`，沒有固定寫法，會跟西元年月混淆）。

## 為什麼「台北今天」不直接加 8 小時

`new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10)` 今天是對的，但台灣在 1979 年以前有過夏令時間：把那些年代的時間點換成台北日期，會差一個小時，剛好跨過午夜時就差一天。這個套件用平台的時區資料（`Intl` 的 `Asia/Taipei`），歷史時間點也正確。

## 不做的事

| 東西 | 去哪找 |
|---|---|
| 顯示「民國115年11月6日」 | 平台內建 `Intl.DateTimeFormat('zh-TW-u-ca-roc')`（上面的範例） |
| 農曆、生肖、干支 | [`lunar-javascript`](https://www.npmjs.com/package/lunar-javascript)（輸出是簡體字，顯示前自己轉繁體） |
| 國定假日、補班日 | 行政院人事行政總處「中華民國政府行政機關辦公日曆表」（政府資料開放平臺） |

## 相關套件

- [`@joelincc/tw-bank-statement`](https://github.com/joepspsps2/tw-bank-statement)：讀台灣網銀匯出的交易明細。
- [`@joelincc/tw-bank-codes`](https://github.com/joepspsps2/tw-bank-codes)：台灣銀行代碼與分行代碼對照表。

## English

Read and write Republic of China (Minguo / ROC) calendar dates as used in Taiwan. `parseRocDate` turns the many real-world spellings (`1151106`, `115/11/06`, `115年11月6日`, `民國前1年…`, full-width digits, plus plain Gregorian forms) into ISO `YYYY-MM-DD`, returning `null` for impossible dates. `toRocYear` / `toRocYearMonth` / `toRocDate` produce the fixed-width forms used in Taiwanese tax and government filings (`115`, `11510`, `1151106`). `taipeiToday` gives today's date in Asia/Taipei (the common bug is using UTC, which is "yesterday" between 00:00 and 08:00 Taipei time), and `addMonths` clamps to the end of month. Display formatting is left to the built-in `Intl.DateTimeFormat('zh-TW-u-ca-roc')`. Zero dependencies; runs on Node.js 22+, browsers and Cloudflare Workers. Not a lunar calendar library.

## 授權

MIT
