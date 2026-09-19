// تلگرام وقتی parse_mode: 'HTML' باشد، هر متن نامعتبر را با خطای 400 رد می‌کند.
// اسم و استان و شهر را خود کاربر تایپ می‌کند، پس قبل از گذاشتن داخل پیام HTML
// باید escape شوند؛ وگرنه یک کاراکتر ساده مثل < کل پیام را می‌اندازد.
export function escapeHtml(text?: string | null): string {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
