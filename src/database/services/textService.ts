import { BotText } from '../models/BotText';
import { t } from '../../bot/utils/i18n';

/**
 * متن‌هایی که ادمین می‌تواند ویرایش کند.
 * فقط متن‌های ثابت اینجا هستند، نه آن‌هایی که مقدار پویا می‌گیرند (مثل آمار).
 */
export const EDITABLE_TEXTS = [
  'welcome',
  'supportMenu',
  'findingPartner',
  'noChatPartner',
  'profileIncomplete',
  'chatEnded',
  'partnerDisconnected',
  'blocked',
] as const;

export type EditableTextKey = typeof EDITABLE_TEXTS[number];

const DEFAULTS: Record<string, string> = Object.fromEntries(
  EDITABLE_TEXTS.map((key) => [key, (t as unknown as Record<string, string>)[key]])
);

export class TextService {
  private static cache = new Map<string, string>();

  /** متن فعلی: اگر ادمین عوض کرده باشد همان، وگرنه متن پیش‌فرض کد */
  static get(key: string): string {
    return this.cache.get(key) ?? DEFAULTS[key] ?? '';
  }

  static isEditable(key: string): key is EditableTextKey {
    return (EDITABLE_TEXTS as readonly string[]).includes(key);
  }

  static list(): { key: string; value: string; customized: boolean }[] {
    return EDITABLE_TEXTS.map((key) => ({
      key,
      value: this.get(key),
      customized: this.cache.has(key),
    }));
  }

  /** خواندن overrideها از دیتابیس و اعمال روی متن‌های ربات */
  static async load(): Promise<number> {
    const rows = await BotText.find().lean();
    this.cache.clear();
    for (const row of rows) {
      if (this.isEditable(row.key)) this.cache.set(row.key, row.value);
    }
    this.apply();
    return this.cache.size;
  }

  static async set(key: EditableTextKey, value: string, adminId: number): Promise<void> {
    await BotText.findOneAndUpdate(
      { key },
      { key, value, updatedBy: adminId, updatedAt: new Date() },
      { upsert: true }
    );
    this.cache.set(key, value);
    this.apply();
  }

  static async reset(key: EditableTextKey): Promise<void> {
    await BotText.deleteOne({ key });
    this.cache.delete(key);
    this.apply();
  }

  /** متن‌های عوض‌شده را روی آبجکت t می‌نویسد تا همه‌جای ربات استفاده شوند */
  static apply(): void {
    for (const key of EDITABLE_TEXTS) {
      const value = this.cache.get(key);
      if (value !== undefined) (t as unknown as Record<string, string>)[key] = value;
      else (t as unknown as Record<string, string>)[key] = DEFAULTS[key];
    }
  }
}
