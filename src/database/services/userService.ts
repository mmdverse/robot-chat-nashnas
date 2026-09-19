import { User } from '../models/User';
import { Transaction } from '../models/Transaction';
import { config } from '../../config';
import { IUser } from '../../types';
import { v4 as uuidv4 } from 'uuid';

// پنجرهٔ «آنلاین بودن» — هم برای آمار و هم برای شمارش استفاده می‌شود
const ONLINE_WINDOW_MS = 5 * 60 * 1000;

export class UserService {
  // آمار «آنلاین» بر پایهٔ lastSeen حساب می‌شود، ولی قبلاً lastSeen فقط در /start
  // به‌روز می‌شد: کاربری که ساعت‌ها در ربات چت می‌کرد همچنان «آفلاین» به حساب
  // می‌آمد. این متد در هر تعامل صدا زده می‌شود و برای اینکه هر پیام یک نوشتن
  // دیتابیس نسازد، حداکثر هر دقیقه یک بار می‌نویسد.
  static async touchLastSeen(telegramId: number): Promise<void> {
    await User.updateOne(
      { telegramId, lastSeen: { $lt: new Date(Date.now() - 60 * 1000) } },
      { lastSeen: new Date(), isOnline: true }
    );
  }

  static async findOrCreate(telegramId: number, username?: string, firstName?: string, lastName?: string): Promise<IUser> {
    let user = await User.findOne({ telegramId });
    if (!user) {
      user = await User.create({
        telegramId,
        username: username || '',
        firstName: firstName || '',
        lastName: lastName || '',
        referralCode: uuidv4().slice(0, 8),
        coins: config.coins.default,
        joinedAt: new Date(),
        isOnline: true,
        status: 'active',
        chatStatus: 'idle',
        profile: { name: '', gender: 'unknown', age: 0, province: '', city: '', bio: '', instagram: '', isComplete: false },
      });
      await Transaction.create({
        userId: telegramId,
        type: 'bonus',
        amount: config.coins.default,
        balance: config.coins.default,
        description: 'سکه‌های شروع',
      });
    } else {
      user.username = username || user.username;
      user.firstName = firstName || user.firstName;
      user.lastName = lastName || user.lastName;
      user.lastSeen = new Date();
      user.isOnline = true;
      await user.save();
    }
    return user;
  }

  static async getById(telegramId: number): Promise<IUser | null> {
    return User.findOne({ telegramId });
  }

  static async updateProfile(telegramId: number, updates: Partial<IUser['profile']>): Promise<IUser | null> {
    const user = await User.findOne({ telegramId });
    if (!user) return null;

    const wasComplete = user.profile.isComplete;
    Object.assign(user.profile, updates);

    const p = user.profile;
    user.profile.isComplete = !!(p.name && p.gender && p.gender !== 'unknown' && p.age && p.age > 0 && p.province && p.city);

    // Bonus for first-time profile completion
    if (user.profile.isComplete && !wasComplete) {
      user.coins += config.coins.profileCompleteBonus;
      user.totalCoinsEarned += config.coins.profileCompleteBonus;
      await Transaction.create({
        userId: telegramId,
        type: 'bonus',
        amount: config.coins.profileCompleteBonus,
        balance: user.coins,
        description: 'تکمیل پروفایل',
      });
    }

    await user.save();
    return user;
  }

  // راهنمای ربات و کیف پول هر دو وعده می‌دهند «چت روزانه: +۵ سکه»، ولی
  // config.coins.dailyBonus هیچ‌جا استفاده نمی‌شد. این متد روزی یک بار (به وقت
  // محلی سرور) پاداش می‌دهد. شرط و افزایش در یک کوئری‌اند تا دو پیام هم‌زمان
  // نتوانند دو بار پاداش بگیرند. اگر امروز قبلاً گرفته شده باشد ۰ برمی‌گردد.
  static async claimDailyChatBonus(telegramId: number): Promise<number> {
    const bonus = config.coins.dailyBonus;
    if (bonus <= 0) return 0;

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const user = await User.findOneAndUpdate(
      {
        telegramId,
        $or: [
          { lastDailyBonusAt: { $exists: false } },
          { lastDailyBonusAt: { $lt: startOfDay } },
        ],
      },
      {
        lastDailyBonusAt: new Date(),
        $inc: { coins: bonus, totalCoinsEarned: bonus },
      },
      { new: true }
    );

    if (!user) return 0;

    await Transaction.create({
      userId: telegramId,
      type: 'bonus',
      amount: bonus,
      balance: user.coins,
      description: 'پاداش چت روزانه',
    });

    return bonus;
  }

  static async addCoins(telegramId: number, amount: number, description: string): Promise<IUser | null> {
    const user = await User.findOne({ telegramId });
    if (!user) return null;
    user.coins += amount;
    user.totalCoinsEarned += amount > 0 ? amount : 0;
    await user.save();
    await Transaction.create({
      userId: telegramId,
      type: amount > 0 ? 'earn' : 'spend',
      amount,
      balance: user.coins,
      description,
    });
    return user;
  }

  static async spendCoins(telegramId: number, amount: number, description: string): Promise<boolean> {
    const user = await User.findOne({ telegramId });
    if (!user || user.coins < amount) return false;
    user.coins -= amount;
    user.totalCoinsSpent += amount;
    await user.save();
    await Transaction.create({
      userId: telegramId,
      type: 'spend',
      amount: -amount,
      balance: user.coins,
      description,
    });
    return true;
  }

  static async handleReferral(newUserId: number, referralCode: string): Promise<void> {
    const referrer = await User.findOne({ referralCode });
    if (!referrer || referrer.telegramId === newUserId) return;

    const newUser = await User.findOne({ telegramId: newUserId });
    if (!newUser || newUser.referredBy) return;

    newUser.referredBy = referrer.telegramId;
    await newUser.save();

    referrer.referralCount += 1;
    referrer.coins += config.coins.referralBonus;
    referrer.totalCoinsEarned += config.coins.referralBonus;
    await referrer.save();

    await Transaction.create({
      userId: referrer.telegramId,
      type: 'referral',
      amount: config.coins.referralBonus,
      balance: referrer.coins,
      description: 'زیرمجموعه‌گیری',
    });
  }

  static async getStats(): Promise<{
    total: number; online: number; chatting: number; waiting: number;
    banned: number; today: number;
    byGender: { male: number; female: number; unknown: number };
    byProvince: Record<string, number>;
  }> {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [total, online, chatting, waiting, banned, todayJoined, byGender, byProvince] = await Promise.all([
      User.countDocuments(),
      // پرچم isOnline فقط یک‌بار true می‌شد و بعد از پایان چت false می‌ماند؛
      // پس ملاک، آخرین فعالیت کاربر است نه آن پرچم
      User.countDocuments({ lastSeen: { $gte: new Date(Date.now() - ONLINE_WINDOW_MS) } }),
      User.countDocuments({ chatStatus: 'chatting' }),
      User.countDocuments({ chatStatus: 'waiting' }),
      User.countDocuments({ status: 'banned' }),
      User.countDocuments({ joinedAt: { $gte: today } }),
      User.aggregate([{ $group: { _id: '$profile.gender', count: { $sum: 1 } } }]),
      User.aggregate([
        { $match: { 'profile.province': { $ne: '' } } },
        { $group: { _id: '$profile.province', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
    ]);

    const genderMap: Record<string, number> = { male: 0, female: 0, unknown: 0 };
    byGender.forEach((g: { _id: string; count: number }) => { genderMap[g._id] = g.count; });

    const provinceMap: Record<string, number> = {};
    byProvince.forEach((p: { _id: string; count: number }) => { provinceMap[p._id] = p.count; });

    return {
      total, online, chatting, waiting, banned, today: todayJoined,
      byGender: { male: genderMap.male, female: genderMap.female, unknown: genderMap.unknown },
      byProvince: provinceMap,
    };
  }

  static async searchForPartner(
    userId: number,
    filters?: { gender?: string; minAge?: number; maxAge?: number; province?: string }
  ): Promise<IUser | null> {
    const user = await User.findOne({ telegramId: userId });
    if (!user) return null;

    const query: any = {
      status: 'active',
      chatStatus: 'waiting',
      isOnline: true,
      // کسی که ما را بلاک کرده هم کاندید نمی‌شود
      blockedUsers: { $ne: userId },
    };

    // Include userId exclusion AND blocked users exclusion
    const excludeIds = [userId, ...(user.blockedUsers || [])];
    query.telegramId = { $nin: excludeIds };

    if (filters?.gender) query['profile.gender'] = filters.gender;
    if (filters?.minAge || filters?.maxAge) {
      query['profile.age'] = {};
      if (filters.minAge) query['profile.age'].$gte = filters.minAge;
      if (filters.maxAge) query['profile.age'].$lte = filters.maxAge;
    }
    if (filters?.province) query['profile.province'] = filters.province;

    // رزرو اتمیک: کاندید در همان کوئری از صف برداشته و به این کاربر نسبت داده
    // می‌شود. قبلاً اول find می‌زدیم و بعد در createChat وضعیت را عوض می‌کردیم؛
    // در آن فاصله دو کاربر می‌توانستند یک نفر را بردارند و برای یک نفر دو چت
    // فعال ساخته شود.
    return User.findOneAndUpdate(
      query,
      { chatStatus: 'chatting', currentPartner: userId },
      { new: true, sort: { lastSeen: -1 } }
    );
  }

  static async toggleBan(telegramId: number, ban: boolean): Promise<void> {
    await User.updateOne({ telegramId }, { status: ban ? 'banned' : 'active' });
  }

  static async findTargetedUsers(filters: {
    gender?: string; minAge?: number; maxAge?: number;
    province?: string; minCoins?: number; maxCoins?: number;
  }): Promise<IUser[]> {
    const query: any = { status: 'active' };
    if (filters.gender) query['profile.gender'] = filters.gender;
    if (filters.minAge || filters.maxAge) {
      query['profile.age'] = {};
      if (filters.minAge) query['profile.age'].$gte = filters.minAge;
      if (filters.maxAge) query['profile.age'].$lte = filters.maxAge;
    }
    if (filters.province) query['profile.province'] = filters.province;
    if (filters.minCoins) query.coins = { $gte: filters.minCoins };
    if (filters.maxCoins) query.coins = { ...query.coins, $lte: filters.maxCoins };
    return User.find(query);
  }

  static async generateReferralLink(telegramId: number): Promise<string> {
    const user = await User.findOne({ telegramId });
    if (!user) return '';
    return `https://t.me/${config.bot.username}?start=ref_${user.referralCode}`;
  }
}
