import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/index.ts';

test('年份換算與民國前', () => {
  assert.equal(R.adToRoc(2026), 115);
  assert.equal(R.adToRoc(1912), 1);
  assert.equal(R.adToRoc(1911), 0);
  assert.equal(R.rocToAd(115), 2026);
  assert.equal(R.rocToAd(1, { before: true }), 1911);
  assert.equal(R.rocToAd(3, { before: true }), 1909);
  assert.equal(R.rocLabel(2026), '民國 115 年');
  assert.equal(R.rocLabel(1912), '民國 1 年');
  assert.equal(R.rocLabel(1911), '民國前 1 年');
});

test('讀日期：各家民國寫法', () => {
  const want = '2026-11-06';
  for (const s of [
    '1151106', '115/11/06', '115/11/6', '115.11.6', '115-11-06', '115年11月6日', '115 年 11 月 6 日',
    '民國115年11月6日', '民國 115/11/06', '民115年11月6日', '１１５／１１／０６', '１１５１１０６',
    '115/11/06 14:30', '115/11/06 14:30:59',
  ]) assert.equal(R.parseRocDate(s), want, s);
});

test('讀日期：西元寫法', () => {
  for (const s of ['2026-11-06', '2026/11/6', '2026.11.06', '20261106', '2026年11月6日', '2026-11-06T08:00:00Z', '2026-11-06T08:00+08:00'])
    assert.equal(R.parseRocDate(s), '2026-11-06', s);
});

test('讀日期：兩位數民國年、民國前', () => {
  assert.equal(R.parseRocDate('99/12/31'), '2010-12-31');
  assert.equal(R.parseRocDate('1/1/1'), '1912-01-01');
  assert.equal(R.parseRocDate('民國前1年6月1日'), '1911-06-01');
  assert.equal(R.parseRocDate('民前3年1月1日'), '1909-01-01');
});

test('讀日期：不存在或看不懂回 null', () => {
  for (const s of [
    '', '   ', 'abc', '115/2/29', '115/02/30', '115/13/01', '115/00/10', '1150230', '20260230',
    '0/1/1', '民國0年1月1日', '民國2026年1月1日', '民國20261106', '115年11/6', '11511', '12345/1/1',
  ]) assert.equal(R.parseRocDate(s), null, s);
  assert.equal(R.parseRocDate(undefined as unknown as string), null);
  assert.equal(R.parseRocDate('113/2/29'), '2024-02-29'); // 閏年
  assert.equal(R.parseRocDate('89/2/29'), '2000-02-29'); // 2000 是閏年
  assert.equal(R.parseRocDate('2100-02-29'), null); // 2100 不是
});

test('讀日期：年份範圍與幾碼算民國可調', () => {
  assert.equal(R.parseRocDate('78/12/31', { minYear: 1990 }), null);
  assert.equal(R.parseRocDate('79/1/1', { minYear: 1990 }), '1990-01-01');
  assert.equal(R.parseRocDate('2101-01-01', { maxYear: 2100 }), null);
  assert.equal(R.parseRocDate('115/1/1', { rocMaxDigits: 2 }), null);
  assert.equal(R.parseRocDate('99/1/1', { rocMaxDigits: 2 }), '2010-01-01');
});

test('讀年月', () => {
  for (const s of ['11510', '115/10', '115-10', '115.10', '115年10月', '115年10月份', '民國115年10月', '2026-10', '2026/10', '202610', '１１５１０'])
    assert.equal(R.parseRocYearMonth(s), '2026-10', s);
  assert.equal(R.parseRocYearMonth('99/1'), '2010-01');
  for (const s of ['11513', '11500', '115/0', '115年10', 'abc', '', '1151', '民國202610'])
    assert.equal(R.parseRocYearMonth(s), null, s);
});

test('寫申報格式', () => {
  assert.equal(R.toRocYear(2026), '115');
  assert.equal(R.toRocYear('2026-11-06'), '115');
  assert.equal(R.toRocYear('2026-11'), '115');
  assert.equal(R.toRocYear(2011), '100');
  assert.equal(R.toRocYear(1999), '088');
  assert.equal(R.toRocYear(1912), '001');
  assert.equal(R.toRocYear(1911), null);
  assert.equal(R.toRocYear('2026-02-30'), null);
  assert.equal(R.toRocYearMonth('2026-10-06'), '11510');
  assert.equal(R.toRocYearMonth('2026-01'), '11501');
  assert.equal(R.toRocYearMonth('1999-12-31'), '08812');
  assert.equal(R.toRocYearMonth('2026-13'), null);
  assert.equal(R.toRocYearMonth('1911-12-31'), null);
  assert.equal(R.toRocDate('2026-11-06'), '1151106');
  assert.equal(R.toRocDate('2026-11-06', '/'), '115/11/06');
  assert.equal(R.toRocDate('2010-01-05'), '0990105');
  assert.equal(R.toRocDate('2026-02-29'), null);
  assert.equal(R.toRocDate('1911-10-10'), null);
});

test('讀寫來回一致', () => {
  for (let d = '2024-01-01'; d <= '2026-12-31'; d = R.addDays(d, 1)!) {
    assert.equal(R.parseRocDate(R.toRocDate(d)!), d);
    assert.equal(R.parseRocDate(R.toRocDate(d, '/')!), d);
  }
});

test('台北今天：凌晨 0–8 點不會變昨天', () => {
  // 台北 2026-11-06 00:30 ＝ 世界標準時間 2026-11-05 16:30
  assert.equal(R.taipeiToday(Date.UTC(2026, 10, 5, 16, 30)), '2026-11-06');
  assert.equal(R.taipeiToday(Date.UTC(2026, 10, 5, 15, 59)), '2026-11-05');
  assert.equal(R.taipeiToday(new Date('2026-11-05T23:59:59Z')), '2026-11-06');
  assert.equal(R.taipeiDate('2026-11-05T16:00:00Z'), '2026-11-06');
  assert.equal(R.taipeiDate('不是時間'), null);
});

test('台北今天：跨年時民國年也跟著換', () => {
  const t = Date.UTC(2026, 11, 31, 17, 0); // 台北 2027-01-01 01:00
  assert.equal(R.taipeiToday(t), '2027-01-01');
  assert.equal(R.taipeiMonth(t), '2027-01');
  assert.equal(R.taipeiYear(t), 2027);
  assert.equal(R.taipeiRocYear(t), 116);
});

test('台北日期：1979 年以前的夏令時間', () => {
  // 1979-07-01 15:30Z：台北當時是夏令時間 UTC+9 → 7/2 00:30；單純加 8 小時會算成 7/1
  assert.equal(R.taipeiDate(Date.UTC(1979, 6, 1, 15, 30)), '1979-07-02');
});

test('加減月份：月底不溢出', () => {
  assert.equal(R.addMonths('2026-08-31', -6), '2026-02-28');
  assert.equal(R.addMonths('2026-12-31', -6), '2026-06-30');
  assert.equal(R.addMonths('2024-08-31', -6), '2024-02-29');
  assert.equal(R.addMonths('2026-01-31', 1), '2026-02-28');
  assert.equal(R.addMonths('2024-02-29', 12), '2025-02-28');
  assert.equal(R.addMonths('2026-11-06', 2), '2027-01-06');
  assert.equal(R.addMonths('2026-01-15', -1), '2025-12-15');
  assert.equal(R.addMonths('2026-01-15', -25), '2023-12-15');
  assert.equal(R.addMonths('2026-02-30', 1), null);
  assert.equal(R.addMonths('2026-01-15', 1.5), null);
});

test('加減天數、日期是否存在、閏年', () => {
  assert.equal(R.addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(R.addDays('2024-03-01', -1), '2024-02-29');
  assert.equal(R.addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(R.addDays('2026-11-06', 0), '2026-11-06');
  assert.equal(R.isValidDate('2024-02-29'), true);
  assert.equal(R.isValidDate('2026-02-29'), false);
  assert.equal(R.isValidDate('2026-2-1'), false);
  assert.equal(R.isLeapYear(2000), true);
  assert.equal(R.isLeapYear(1900), false);
  assert.equal(R.isLeapYear(2024), true);
  assert.equal(R.daysInMonth(2026, 2), 28);
  assert.equal(R.daysInMonth(2026, 4), 30);
});

test('平台內建的民國顯示（README 範例要成立）', () => {
  const f = new Intl.DateTimeFormat('zh-TW-u-ca-roc', { timeZone: 'Asia/Taipei', dateStyle: 'long' });
  assert.equal(f.format(new Date('2026-12-31T16:30:00Z')), '民國116年1月1日');
  assert.equal(f.format(new Date('1911-06-01T00:00:00Z')), '民國前1年6月1日');
});

test('覆核補的邊界：補零年份、6 碼、溢位、西元前', () => {
  assert.equal(R.parseRocDate('0115/11/06'), null);
  assert.equal(R.parseRocDate('0099/12/31'), null);
  assert.equal(R.parseRocYearMonth('990101'), null);
  assert.equal(R.parseRocYearMonth('202610'), '2026-10');
  assert.equal(R.parseRocDate('99010101'), null);
  assert.equal(R.parseRocDate('115/11/06 下午 02:30:00'), '2026-11-06');
  assert.equal(R.parseRocDate('115/11/06 上午 9:05'), '2026-11-06');
  assert.equal(R.addDays('2026-01-01', 1e9), null);
  assert.equal(R.addDays('9999-12-31', 1), null);
  assert.equal(R.taipeiDate('-000100-06-01T00:00:00Z'), null);
  assert.equal(R.toRocYear(2910), '999');
  assert.equal(R.toRocYear(2911), null);
  assert.equal(R.toRocDate('2911-01-01'), null);
});

test('超長輸入直接回 null，不會拖慢', () => {
  const t0 = performance.now();
  assert.equal(R.parseRocDate('115/11/06' + ' '.repeat(100000) + 'x'), null);
  assert.equal(R.parseRocDate('1' + ' \t'.repeat(50000) + '1:00'), null);
  assert.equal(R.parseRocYearMonth('1'.repeat(100000)), null);
  assert.ok(performance.now() - t0 < 50);
  assert.equal(R.parseRocDate('115/11/06  下午  2:30'), '2026-11-06');
});
