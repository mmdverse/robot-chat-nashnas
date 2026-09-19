// نمایش تاریخ به شمسی. Node 20 با full-icu این را بدون هیچ وابستگی‌ای می‌سازد
// (بستهٔ persian-date قبلاً در package.json بود ولی هیچ‌جا استفاده نمی‌شد و نسخهٔ
// پین‌شده‌اش هم روی npm وجود ندارد).
const TEHRAN_TZ = 'Asia/Tehran';

export function formatDateTime(date: Date | string | undefined): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('fa-IR', {
    timeZone: TEHRAN_TZ,
    dateStyle: 'short',
    timeStyle: 'short',
  });
}
