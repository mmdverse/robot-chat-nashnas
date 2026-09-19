import mongoose, { Schema } from 'mongoose';
import { IReport } from '../../types';

const ReportSchema = new Schema<IReport>({
  reporterId: { type: Number, required: true },
  reportedId: { type: Number, required: true, index: true },
  chatId: { type: String },
  reason: { type: String, enum: ['harassment', 'spam', 'fake', 'inappropriate', 'other'], required: true },
  description: { type: String },
  createdAt: { type: Date, default: Date.now },
  resolved: { type: Boolean, default: false },
  resolvedBy: { type: Number },
  // زمان هشدار به ادمین‌ها؛ تا هر گزارش فقط یک‌بار هشدار بدهد
  alertedAt: { type: Date },
});

ReportSchema.index({ reportedId: 1, resolved: 1 });
ReportSchema.index({ createdAt: -1 });

export const Report = mongoose.model<IReport>('Report', ReportSchema);
