// نمودار میله‌ای متنی برای خروجی تلگرام. بدون هیچ وابستگی‌ای، چون مقدار
// نمایش‌داده‌شده کوچک است و همین کافی است.
const BAR_BLOCKS = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];

/** یک میله با بلندترین بلوک ممکن برای مقدار نسبت به سقف */
export function bar(value: number, max: number): string {
  if (max <= 0 || value <= 0) return BAR_BLOCKS[0];
  const index = Math.min(BAR_BLOCKS.length - 1, Math.max(0, Math.round((value / max) * (BAR_BLOCKS.length - 1))));
  return BAR_BLOCKS[index];
}

/** خطِ نمودار: مقدار بعد از میله می‌آید تا خواندنش آسان باشد */
export function chartLine(label: string, value: number, max: number): string {
  return `${label} ${bar(value, max)} ${value}`;
}

/** پرکردن جای خالی ساعت‌ها/روزهایی که هیچ چتی نداشته‌اند */
export function fillMissing<T extends { count: number }>(
  rows: T[],
  keys: string[],
  keyOf: (row: T) => string,
  make: (key: string) => T
): T[] {
  const byKey = new Map(rows.map((row) => [keyOf(row), row]));
  return keys.map((key) => byKey.get(key) ?? make(key));
}
