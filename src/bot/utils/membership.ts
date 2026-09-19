import { Api } from 'grammy';

// وضعیت‌هایی که «عضو است» حساب می‌شوند
const MEMBER_STATUSES = ['creator', 'administrator', 'member', 'restricted'];

// هر چند وقت یک بار عضویت دوباره چک شود (نه در هر پیام)
export const MEMBERSHIP_TTL_MS = 5 * 60 * 1000;

/**
 * کانال‌هایی که کاربر عضو آن‌ها نیست را برمی‌گرداند.
 * اگر ربات در کانال ادمین نباشد یا چک کردن ممکن نباشد، آن کانال نادیده گرفته
 * می‌شود؛ بهتر است کاربر به‌خاطر خطای ربات از ربات بیرون بماند.
 */
export async function missingChannels(
  api: Api,
  userId: number,
  channels: string[]
): Promise<string[]> {
  const missing: string[] = [];

  for (const channel of channels) {
    try {
      const member = await api.getChatMember(channel, userId);
      if (!MEMBER_STATUSES.includes(member.status)) missing.push(channel);
    } catch {
      // کانال نامعتبر، ربات ادمین نبودن، یا خطای شبکه ⇒ کاربر را بلاک نمی‌کنیم
    }
  }

  return missing;
}

/** لینک عمومی کانال از نامی که در REQUIRED_CHANNELS آمده */
export function channelUrl(channel: string): string {
  return `https://t.me/${channel.replace(/^@/, '')}`;
}
