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
}

export type MyContext = Context & SessionFlavor<SessionData>;
