import { User } from '../models/User';
import { Transaction } from '../models/Transaction';
import { PurchaseRequest } from '../models/PurchaseRequest';

export class WalletService {
  static coinPackages = [
    { id: 'bronze', name: 'برنز', coins: 100, price: '۱۰,۰۰۰ تومان' },
    { id: 'silver', name: 'نقره‌ای', coins: 300, price: '۲۵,۰۰۰ تومان' },
    { id: 'gold', name: 'طلایی', coins: 700, price: '۵۰,۰۰۰ تومان' },
    { id: 'platinum', name: 'پلاتینیوم', coins: 1500, price: '۹۰,۰۰۰ تومان' },
    { id: 'vip', name: 'VIP ماهانه', coins: 5000, price: '۲۵۰,۰۰۰ تومان', isVip: true },
  ];

  static findPackage(packageId: string) {
    return this.coinPackages.find((p) => p.id === packageId);
  }

  /**
   * دادن سکه‌های یک بسته به کاربر.
   *
   * این متد فقط باید از مسیر تایید ادمین صدا زده شود. متد قبلی (`purchaseCoins`)
   * بدون هیچ پرداختی سکه اضافه می‌کرد و اگر به دکمهٔ خرید وصل می‌شد، هر کسی با
   * یک کلیک بستهٔ VIP مجانی می‌گرفت؛ حذف شد تا اشتباهی وصل نشود.
   */
  static async grantPackage(userId: number, packageId: string): Promise<boolean> {
    const pkg = this.findPackage(packageId);
    if (!pkg) return false;

    const user = await User.findOne({ telegramId: userId });
    if (!user) return false;

    user.coins += pkg.coins;
    user.totalCoinsEarned += pkg.coins;

    if (pkg.isVip) {
      user.isVip = true;
      user.vipExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    }

    await user.save();

    await Transaction.create({
      userId,
      type: 'purchase',
      amount: pkg.coins,
      balance: user.coins,
      description: `خرید بسته ${pkg.name}`,
    });

    return true;
  }

  /** درخواست خرید در انتظار تایید (هر کاربر همزمان فقط یکی دارد) */
  static async createRequest(userId: number, packageId: string) {
    const pkg = this.findPackage(packageId);
    if (!pkg) return null;

    const existing = await PurchaseRequest.findOne({ userId, status: 'pending' });
    if (existing) return existing;

    return PurchaseRequest.create({
      userId,
      packageId: pkg.id,
      packageName: pkg.name,
      coins: pkg.coins,
      price: pkg.price,
    });
  }

  static async listPendingRequests(limit = 10) {
    return PurchaseRequest.find({ status: 'pending' }).sort({ createdAt: 1 }).limit(limit);
  }

  /** تایید یا رد درخواست؛ اگر قبلاً بررسی شده باشد null برمی‌گردد */
  static async reviewRequest(requestId: string, adminId: number, approve: boolean) {
    const request = await PurchaseRequest.findOneAndUpdate(
      { _id: requestId, status: 'pending' },
      { status: approve ? 'approved' : 'rejected', reviewedBy: adminId, reviewedAt: new Date() },
      { new: true }
    );
    if (!request) return null;

    if (approve) await this.grantPackage(request.userId, request.packageId);
    return request;
  }

  static async getTransactionHistory(userId: number, limit = 10): Promise<any[]> {
    return Transaction.find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
  }
}
