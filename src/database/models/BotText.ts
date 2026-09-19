import mongoose, { Schema } from 'mongoose';
import { IBotText } from '../../types';

// متن‌هایی که ادمین می‌تواند از داخل ربات عوض کند
const BotTextSchema = new Schema<IBotText>({
  key: { type: String, required: true, unique: true, index: true },
  value: { type: String, required: true },
  updatedBy: { type: Number },
  updatedAt: { type: Date, default: Date.now },
});

export const BotText = mongoose.model<IBotText>('BotText', BotTextSchema);
