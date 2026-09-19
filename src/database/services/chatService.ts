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

  static async likeUser(chatId: string, likerId: number): Promise<void> {
    const chat = await Chat.findById(chatId);
    if (!chat || !chat.isActive) return;

    if (!chat.likes.includes(likerId)) {
      chat.likes.push(likerId);
      await chat.save();
      await User.updateOne({ telegramId: likerId }, { $addToSet: { likedUsers: chat.users.find(u => u !== likerId) } });
      await User.updateOne(
        { telegramId: chat.users.find(u => u !== likerId) },
        { $inc: { likeCount: 1 } }
      );
    }
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
