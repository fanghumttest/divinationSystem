const DIGITS = "零一二三四五六七八九";

export function numToChinese(n: number): string {
  if (n < 1 || n > 60) return String(n);
  if (n <= 10) return n === 10 ? "十" : DIGITS[n];
  if (n < 20) return "十" + DIGITS[n - 10];
  if (n < 30) return "二十" + (n === 20 ? "" : DIGITS[n - 20]);
  if (n < 40) return "三十" + (n === 30 ? "" : DIGITS[n - 30]);
  if (n < 50) return "四十" + (n === 40 ? "" : DIGITS[n - 40]);
  if (n < 60) return "五十" + (n === 50 ? "" : DIGITS[n - 50]);
  return "六十";
}

/** 0: 早上 (5–15), 1: 黃昏 (16–17), 2: 晚上 */
export function getTimeIndex(): number {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 16) return 0;
  if (hour >= 16 && hour < 18) return 1;
  return 2;
}
