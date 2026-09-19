import { Report } from '../models/Report';
import { User } from '../models/User';
import { config } from '../../config';

export interface RepeatOffenderAlert {
  reportedId: number;
  count: number;
  name: string;
}

export class AlertService {
  /**
   * کاربرانی که تعداد گزارش‌های بازشان به آستانه رسیده را برمی‌گرداند.
   * هر گزارش فقط یک‌بار هشدار می‌دهد: بعد از هشدار `alertedAt` می‌خورد.
   * آستانه از config.limits.reportThreshold می‌آید که قبلاً هیچ‌جا استفاده نمی‌شد.
   */
  static async findRepeatOffenders(): Promise<RepeatOffenderAlert[]> {
    const groups = await Report.aggregate([
      { $match: { resolved: false, alertedAt: { $exists: false } } },
      { $group: { _id: '$reportedId', count: { $sum: 1 } } },
      { $match: { count: { $gte: config.limits.reportThreshold } } },
      { $sort: { count: -1 } },
      { $limit: 20 },
    ]);

    if (groups.length === 0) return [];

    const ids = groups.map((g: { _id: number }) => g._id);
    const users = await User.find({ telegramId: { $in: ids } }).select('telegramId profile.name').lean();
    const names = new Map(users.map((u) => [u.telegramId, u.profile?.name || 'بی‌نام']));

    // علامت‌گذاری قبل از فرستادن هشدار تا اگر ربات وسط کار بمیرد تکرار نشود
    await Report.updateMany(
      { reportedId: { $in: ids }, resolved: false, alertedAt: { $exists: false } },
      { alertedAt: new Date() }
    );

    return groups.map((g: { _id: number; count: number }) => ({
      reportedId: g._id,
      count: g.count,
      name: names.get(g._id) || 'بی‌نام',
    }));
  }
}
