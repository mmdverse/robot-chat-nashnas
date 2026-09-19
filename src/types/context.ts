import { Context, SessionFlavor } from 'grammy';

// stateهایی که بین پیام‌های یک کاربر نگه داشته می‌شود
export interface SessionData {
  awaitingProfileInput: string | null;
  awaitingBroadcastMessage: boolean;
  awaitingTargetedBroadcast: boolean;
  awaitingCoinManagement: boolean;
  awaitingAdvancedSearch: boolean;
  // آخرین باری که عضویت کاربر در کانال‌های اجباری چک شده
  membershipCheckedAt: number;
  // شناسهٔ کاربری که در حالت پیام مستقیم با او حرف می‌زنیم
  dmTarget: number | null;
  // کلید متنی که منتظر مقدار جدیدش هستیم
  awaitingTextEdit: string | null;
}

export type MyContext = Context & SessionFlavor<SessionData>;
