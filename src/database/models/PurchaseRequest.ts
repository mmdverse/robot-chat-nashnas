import mongoose, { Schema } from 'mongoose';
import { IPurchaseRequest } from '../../types';

const PurchaseRequestSchema = new Schema<IPurchaseRequest>({
  userId: { type: Number, required: true, index: true },
  packageId: { type: String, required: true },
  packageName: { type: String, required: true },
  coins: { type: Number, required: true },
  price: { type: String, required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
  createdAt: { type: Date, default: Date.now },
  reviewedBy: { type: Number },
  reviewedAt: { type: Date },
});

PurchaseRequestSchema.index({ userId: 1, status: 1 });

export const PurchaseRequest = mongoose.model<IPurchaseRequest>('PurchaseRequest', PurchaseRequestSchema);
