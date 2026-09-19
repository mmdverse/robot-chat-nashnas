import mongoose, { Schema, Document } from 'mongoose';
import { IUser, Gender, UserStatus, ChatStatus } from '../../types';

const UserSchema = new Schema<IUser>({
  telegramId: { type: Number, required: true, unique: true, index: true },
  username: { type: String, default: '' },
  firstName: { type: String, default: '' },
  lastName: { type: String, default: '' },

  profile: {
    name: { type: String, default: '' },
    gender: { type: String, enum: ['male', 'female', 'unknown'], default: 'unknown' },
    age: { type: Number, default: 0 },
    province: { type: String, default: '' },
    city: { type: String, default: '' },
    bio: { type: String, default: '' },
    instagram: { type: String, default: '' },
    isComplete: { type: Boolean, default: false },
  },

  coins: { type: Number, default: 50 },
  totalCoinsEarned: { type: Number, default: 0 },
  totalCoinsSpent: { type: Number, default: 0 },
  likeCount: { type: Number, default: 0 },
  chatCount: { type: Number, default: 0 },

  referredBy: { type: Number, default: undefined },
  referralCode: { type: String, required: true, unique: true },
  referralCount: { type: Number, default: 0 },

  status: { type: String, enum: ['active', 'banned', 'inactive'], default: 'active' },
  chatStatus: { type: String, enum: ['waiting', 'chatting', 'idle'], default: 'idle' },
  isOnline: { type: Boolean, default: false },
  isVip: { type: Boolean, default: false },
  vipExpiresAt: { type: Date },
  lastSeen: { type: Date, default: Date.now },
  joinedAt: { type: Date, default: Date.now },
  lastDailyBonusAt: { type: Date, default: undefined },

  currentPartner: { type: Number, default: undefined },
  blockedUsers: [{ type: Number }],
  likedUsers: [{ type: Number }],
  connections: [{ type: Number }],

  notifyDirectMessage: { type: Boolean, default: true },
  autoNextEnabled: { type: Boolean, default: false },
});

UserSchema.index({ 'profile.gender': 1 });
UserSchema.index({ 'profile.province': 1 });
UserSchema.index({ 'profile.age': 1 });
UserSchema.index({ status: 1 });
UserSchema.index({ isOnline: 1 });
UserSchema.index({ chatStatus: 1 });

export const User = mongoose.model<IUser>('User', UserSchema);
