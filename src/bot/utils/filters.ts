// فیلترهای جستجوی پیشرفته از متنِ کاربر خوانده می‌شوند، پس هر کلید ناشناس یا
// مقدار نامعتبر باید همان‌جا رد شود؛ وگرنه یک مقدار مثل gender=هرچی مستقیم
// می‌رفت داخل کوئری دیتابیس.
export interface SearchFilters {
  gender?: 'male' | 'female';
  minAge?: number;
  maxAge?: number;
  province?: string;
}

const MAX_AGE = 120;
const MAX_PROVINCE_LENGTH = 50;

export function parseSearchFilters(text: string): SearchFilters | null {
  const filters: SearchFilters = {};
  let recognized = 0;

  for (const part of text.split(',')) {
    const [rawKey, ...rest] = part.split('=');
    const key = rawKey.trim();
    const value = rest.join('=').trim();
    if (!key || !value) continue;

    if (key === 'gender') {
      const gender = value.toLowerCase();
      if (gender === 'male' || gender === 'female') {
        filters.gender = gender;
        recognized++;
      }
    } else if (key === 'minAge' || key === 'maxAge') {
      const age = parseInt(value, 10);
      if (!Number.isNaN(age) && age > 0 && age <= MAX_AGE) {
        filters[key] = age;
        recognized++;
      }
    } else if (key === 'province') {
      if (value.length <= MAX_PROVINCE_LENGTH) {
        filters.province = value;
        recognized++;
      }
    }
  }

  if (recognized === 0) return null;

  if (filters.minAge && filters.maxAge && filters.minAge > filters.maxAge) {
    [filters.minAge, filters.maxAge] = [filters.maxAge, filters.minAge];
  }

  return filters;
}
