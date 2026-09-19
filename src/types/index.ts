export type Gender = 'male' | 'female' | 'unknown';
export type UserStatus = 'active' | 'banned' | 'inactive';
export type ChatStatus = 'waiting' | 'chatting' | 'idle';
export type ReportReason = 'harassment' | 'spam' | 'fake' | 'inappropriate' | 'other';

export interface IUser {
  telegramId: number;
  username?: string;
  firstName?: string;
  lastName?: string;

  // Profile
  profile: {
    name?: string;
    gender?: Gender;
    age?: number;
    province?: string;
    city?: string;
    bio?: string;
    instagram?: string;
    isComplete: boolean;
  };

  // Stats
  coins: number;
  totalCoinsEarned: number;
  totalCoinsSpent: number;
  likeCount: number;
  chatCount: number;

  // Referral
  referredBy?: number;
  referralCode: string;
  referralCount: number;

  // Status
  status: UserStatus;
  chatStatus: ChatStatus;
  isOnline: boolean;
  isVip: boolean;
  vipExpiresAt?: Date;
  lastSeen: Date;
  joinedAt: Date;
  lastDailyBonusAt?: Date;

  // Chat Partner
  currentPartner?: number;
  blockedUsers: number[];
  likedUsers: number[];
  // کاربرانی که هر دو طرف همدیگر را لایک کرده‌اند؛ فقط با این‌ها پیام مستقیم ممکن است
  connections: number[];

  // Settings
  notifyDirectMessage: boolean;
  autoNextEnabled: boolean;
}

export interface IChat {
  _id: string;
  users: [number, number];
  startedAt: Date;
  endedAt?: Date;
  isActive: boolean;
  endedBy?: number;
  messagesCount: number;
  likes: number[];
}

export interface IBotText {
  _id: string;
  key: string;
  value: string;
  updatedBy?: number;
  updatedAt: Date;
}

export interface IPurchaseRequest {
  _id: string;
  userId: number;
  packageId: string;
  packageName: string;
  coins: number;
  price: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
  reviewedBy?: number;
  reviewedAt?: Date;
}

export interface IReport {
  _id: string;
  reporterId: number;
  reportedId: number;
  chatId?: string;
  reason: ReportReason;
  description?: string;
  createdAt: Date;
  resolved: boolean;
  resolvedBy?: number;
  alertedAt?: Date;
}

export interface ITransaction {
  _id: string;
  userId: number;
  type: 'earn' | 'spend' | 'purchase' | 'bonus' | 'referral' | 'admin';
  amount: number;
  balance: number;
  description: string;
  createdAt: Date;
}

export interface ICampaign {
  _id: string;
  title: string;
  message: string;
  targetGender?: Gender;
  targetMinAge?: number;
  targetMaxAge?: number;
  targetProvince?: string;
  targetMinCoins?: number;
  targetMaxCoins?: number;
  startedAt: Date;
  endedAt?: Date;
  isActive: boolean;
  sentCount: number;
  viewedCount: number;
  enteredCount: number;
  createdAt: Date;
}

export interface IAdminLog {
  _id: string;
  adminId: number;
  action: string;
  targetId?: number;
  details?: string;
  createdAt: Date;
}
