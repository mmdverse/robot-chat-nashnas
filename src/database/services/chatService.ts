import { Chat } from '../models/Chat';
import { User } from '../models/User';
import { IChat } from '../../types';

export class ChatService {
  static async createChat(user1Id: number, user2Id: number): Promise<IChat> {
    // Update both users
    await User.updateOne(
      { telegramId: user1Id },
      { chatStatus: 'chatting', currentPartner: user2Id }
    );
    await User.updateOne(
      { telegramId: user2Id },
      { chatStatus: 'chatting', currentPartner: user1Id }
    );

    const chat = await Chat.create({
      users: [user1Id, user2Id],
      startedAt: new Date(),
      isActive: true,
    });

    return chat;
  }

  static async endChat(chatId: string, endedBy: number): Promise<void> {
    const chat = await Chat.findById(chatId);
    if (!chat || !chat.isActive) return;

    chat.isActive = false;
    chat.endedAt = new Date();
    chat.endedBy = endedBy;
    await chat.save();

    // Reset both users
    for (const userId of chat.users) {
      // پایان چت به معنی آفلاین شدن کاربر نیست؛ قبلاً هر دو طرف بعد از هر چت
      // تا شروع بعدی «آفلاین» می‌ماندند
      await User.updateOne(
        { telegramId: userId },
        { chatStatus: 'idle', currentPartner: null }
      );
      // Increment chat count
      await User.updateOne({ telegramId: userId }, { $inc: { chatCount: 1 } });
    }
  }

  /**
   * ثبت لایک. اگر طرف مقابل هم قبلاً لایک کرده باشد، هر دو در لیست
   * connections هم قرار می‌گیرند تا بتوانند پیام مستقیم بفرستند.
   * خروجی: آیا لایک متقابل شد؟
   */
  static async likeUser(chatId: string, likerId: number): Promise<boolean> {
    const chat = await Chat.findById(chatId);
    if (!chat || !chat.isActive) return false;

    const partnerId = chat.users.find((u) => u !== likerId);
    if (!partnerId) return false;

    if (chat.likes.includes(likerId)) {
      // لایک تکراری؛ فقط اگر از قبل متقابل بوده دوباره اتصال نمی‌سازیم
      return chat.likes.includes(partnerId);
    }

    chat.likes.push(likerId);
    await chat.save();
    await User.updateOne({ telegramId: likerId }, { $addToSet: { likedUsers: partnerId } });
    await User.updateOne({ telegramId: partnerId }, { $inc: { likeCount: 1 } });

    const mutual = chat.likes.includes(partnerId);
    if (mutual) {
      await User.updateOne({ telegramId: likerId }, { $addToSet: { connections: partnerId } });
      await User.updateOne({ telegramId: partnerId }, { $addToSet: { connections: likerId } });
    }
    return mutual;
  }

  /**
   * کاربرانی که با این کاربر اتصال دوطرفه دارند.
   * کسانی که خودمان بلاک کرده‌ایم و کسانی که ما را بلاک کرده‌اند، هر دو حذف
   * می‌شوند؛ نشان دادن کسی که نمی‌خواهد پیام بگیرد بی‌معنی است.
   */
  static async listConnections(telegramId: number): Promise<number[]> {
    const user = await User.findOne({ telegramId });
    if (!user) return [];

    const blocked = user.blockedUsers || [];
    const candidates = (user.connections || []).filter((id) => !blocked.includes(id));
    if (candidates.length === 0) return [];

    const blockedUs = await User.find({
      telegramId: { $in: candidates },
      blockedUsers: telegramId,
    }).select('telegramId').lean();
    const excluded = new Set(blockedUs.map((u) => u.telegramId));

    return candidates.filter((id) => !excluded.has(id));
  }

  static async getActiveChat(userId: number): Promise<IChat | null> {
    return Chat.findOne({
      users: userId,
      isActive: true,
    });
  }

  static async getChatStats(): Promise<{
    total: number;
    active: number;
    today: number;
    avgDuration: number;
  }> {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [total, active, todayChats, avgDurationAgg] = await Promise.all([
      Chat.countDocuments(),
      Chat.countDocuments({ isActive: true }),
      Chat.countDocuments({ startedAt: { $gte: today } }),
      Chat.aggregate([
        { $match: { endedAt: { $ne: null } } },
        { $project: { duration: { $subtract: ['$endedAt', '$startedAt'] } } },
        { $group: { _id: null, avgDuration: { $avg: '$duration' } } },
      ]),
    ]);

    const avgDuration = avgDurationAgg.length > 0 ? avgDurationAgg[0].avgDuration / 1000 / 60 : 0;

    return { total, active, today: todayChats, avgDuration: Math.round(avgDuration) };
  }

  static async getHourlyActivity(): Promise<{ hour: number; count: number }[]> {
    return Chat.aggregate([
      { $match: { startedAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } },
      { $group: { _id: { $hour: '$startedAt' }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
      { $project: { hour: '$_id', count: 1, _id: 0 } },
    ]);
  }

  static async getDailyActivity(): Promise<{ day: string; count: number }[]> {
    return Chat.aggregate([
      { $match: { startedAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$startedAt' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
      { $project: { day: '$_id', count: 1, _id: 0 } },
    ]);
  }
}
