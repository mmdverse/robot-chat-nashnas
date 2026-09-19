import { MyContext } from '../../types/context';
import { UserService } from '../../database/services/userService';
import { ChatService } from '../../database/services/chatService';
import { Report } from '../../database/models/Report';
import { AdminLog } from '../../database/models/AdminLog';
import { User } from '../../database/models/User';
import { Campaign } from '../../database/models/Campaign';
import { adminKeyboard } from '../utils/keyboards';
import { t } from '../utils/i18n';
import { config } from '../../config';

// ===== Stats =====
export async function adminStatsHandler(ctx: MyContext) {
  const telegramId = ctx.from?.id!;
  if (!config.admins.includes(telegramId)) return;

  const userStats = await UserService.getStats();
  const chatStats = await ChatService.getChatStats();

  const msg =
    `${t.statsText(userStats)}\n\n` +
    `💬 آمار چت‌ها:\n` +
    `  • کل چت‌ها: ${chatStats.total}\n` +
    `  • فعال: ${chatStats.active}\n` +
    `  • امروز: ${chatStats.today}\n` +
    `  • میانگین مدت: ${chatStats.avgDuration} دقیقه`;

  await ctx.reply(msg, { parse_mode: 'HTML' });
}

// ===== Broadcast =====
export async function adminBroadcastHandler(ctx: MyContext) {
  const telegramId = ctx.from?.id!;
  if (!config.admins.includes(telegramId)) return;
  ctx.session.awaitingBroadcastMessage = true;
  await ctx.reply('📣 لطفاً پیام خود را ارسال کنید:\n\n⚠️ این پیام برای همه کاربران ارسال خواهد شد.');
}

export async function sendBroadcast(ctx: MyContext, messageText: string) {
  const telegramId = ctx.from?.id!;
  const users = await User.find({ status: 'active' });
  let sent = 0;
  let failed = 0;

  for (const user of users) {
    try {
      await ctx.api.sendMessage(user.telegramId, messageText, { parse_mode: 'HTML' } as any);
      sent++;
    } catch {
      failed++;
    }
    // Rate-limit to avoid flood
    if (sent % 20 === 0) await new Promise(r => setTimeout(r, 1000));
  }

  await ctx.reply(`✅ پیام به ${sent} کاربر ارسال شد.\n❌ ناموفق: ${failed}`);
  await AdminLog.create({ adminId: telegramId, action: 'broadcast', details: `Sent to ${sent}, failed: ${failed}` });
}

// ===== Targeted Broadcast =====
export async function adminTargetedBroadcastHandler(ctx: MyContext) {
  const telegramId = ctx.from?.id!;
  if (!config.admins.includes(telegramId)) return;
  ctx.session.awaitingTargetedBroadcast = true;
  await ctx.reply(
    '🎯 ارسال هدفمند\n\n' +
    'لطفاً فیلترها را به این فرمت وارد کنید:\n' +
    '`gender=male, minAge=18, maxAge=25, province=تهران`\n\n' +
    'بعد از آن پیام را ارسال کنید.'
  );
}

export async function sendTargetedBroadcast(ctx: MyContext, filterText: string) {
  const telegramId = ctx.from?.id!;
  if (!config.admins.includes(telegramId)) return;

  // Parse filter text into filters object
  const filters: any = {};
  const lines = filterText.split('\n');
  const filterLine = lines[0];
  const messageLines = lines.slice(1);

  filterLine.split(',').forEach(part => {
    const [key, value] = part.trim().split('=');
    if (key && value) {
      const k = key.trim();
      if (k === 'minAge' || k === 'maxAge' || k === 'minCoins' || k === 'maxCoins') {
        filters[k] = parseInt(value);
      } else {
        filters[k] = value;
      }
    }
  });

  const message = messageLines.join('\n') || filterLine;
  const users = await UserService.findTargetedUsers(filters);
  let sent = 0;

  for (const user of users) {
    try {
      await ctx.api.sendMessage(user.telegramId, `📢 ${message}`, { parse_mode: 'HTML' } as any);
      sent++;
    } catch {}
    if (sent % 20 === 0) await new Promise(r => setTimeout(r, 1000));
  }

  await ctx.reply(`🎯 پیام هدفمند به ${sent} کاربر ارسال شد.`);
  await AdminLog.create({ adminId: telegramId, action: 'targeted_broadcast', details: `Filters: ${filterLine}, sent: ${sent}` });
}

// ===== Coin Management =====
export async function adminManageCoinsHandler(ctx: MyContext) {
  const telegramId = ctx.from?.id!;
  if (!config.admins.includes(telegramId)) return;
  ctx.session.awaitingCoinManagement = true;
  await ctx.reply('💰 مدیریت سکه\n\nفرمت: `userId amount reason`\nمثال: `123456789 50 برای فعالیت خوب`');
}

export async function manageCoins(ctx: MyContext, text: string) {
  const telegramId = ctx.from?.id!;
  if (!config.admins.includes(telegramId)) return;

  const parts = text.split(' ');
  if (parts.length < 3) {
    await ctx.reply('❌ فرمت اشتباه. استفاده: `userId amount reason`');
    return;
  }

  const userId = parseInt(parts[0]);
  const amount = parseInt(parts[1]);
  const reason = parts.slice(2).join(' ');

  if (isNaN(userId) || isNaN(amount)) {
    await ctx.reply('❌ userId و amount باید عدد باشند.');
    return;
  }

  const user = await UserService.addCoins(userId, amount, reason);
  if (user) {
    await ctx.reply(`✅ ${amount} سکه به کاربر ${userId} اضافه شد. موجودی جدید: ${user.coins}`);
    await AdminLog.create({ adminId: telegramId, action: 'manage_coins', targetId: userId, details: `${amount} - ${reason}` });
  } else {
    await ctx.reply('❌ کاربر یافت نشد.');
  }
}

// ===== Reports =====
export async function adminReportsHandler(ctx: MyContext) {
  const telegramId = ctx.from?.id!;
  if (!config.admins.includes(telegramId)) return;

  const reports = await Report.find({ resolved: false }).sort({ createdAt: -1 }).limit(10);

  if (reports.length === 0) {
    await ctx.reply('✅ هیچ گزارش جدیدی وجود ندارد.');
    return;
  }

  let msg = '🚨 گزارشات جدید:\n\n';
  for (const r of reports) {
    msg += `🆔 ${r._id.toString().slice(-6)}\n`;
    msg += `📝 گزارش‌دهنده: ${r.reporterId}\n`;
    msg += `👤 متخلف: ${r.reportedId}\n`;
    msg += `🔴 دلیل: ${r.reason}\n`;
    msg += `📅 ${r.createdAt.toLocaleDateString('fa-IR')}\n`;
    msg += `─────────────────\n`;
  }

  msg += '\nدستورات:\n/ban userId\n/unban userId\n/resolve reportId';

  await ctx.reply(msg);
}

export async function adminBanUser(ctx: MyContext) {
  const telegramId = ctx.from?.id!;
  if (!config.admins.includes(telegramId)) return;

  const args = ctx.message?.text?.split(' ');
  if (!args || args.length < 2) {
    await ctx.reply('❌ فرمت: /ban userId');
    return;
  }

  const userId = parseInt(args[1]);
  if (isNaN(userId)) {
    await ctx.reply('❌ userId باید عدد باشد.');
    return;
  }

  await UserService.toggleBan(userId, true);
  await ctx.reply(`🔇 کاربر ${userId} مسدود شد.`);
  await AdminLog.create({ adminId: telegramId, action: 'ban', targetId: userId });
}

export async function adminUnbanUser(ctx: MyContext) {
  const telegramId = ctx.from?.id!;
  if (!config.admins.includes(telegramId)) return;

  const args = ctx.message?.text?.split(' ');
  if (!args || args.length < 2) {
    await ctx.reply('❌ فرمت: /unban userId');
    return;
  }

  const userId = parseInt(args[1]);
  if (isNaN(userId)) {
    await ctx.reply('❌ userId باید عدد باشد.');
    return;
  }

  await UserService.toggleBan(userId, false);
  await ctx.reply(`✅ کاربر ${userId} رفع مسدود شد.`);
  await AdminLog.create({ adminId: telegramId, action: 'unban', targetId: userId });
}

// ===== Campaigns =====
export async function adminCampaignHandler(ctx: MyContext) {
  const telegramId = ctx.from?.id!;
  if (!config.admins.includes(telegramId)) return;

  const campaigns = await Campaign.find().sort({ createdAt: -1 }).limit(5);

  let msg = '📢 کمپین‌ها:\n\n';
  if (campaigns.length === 0) {
    msg += 'هنوز کمپینی ساخته نشده.\n';
  } else {
    for (const c of campaigns) {
      msg += `• ${c.title} — ${c.isActive ? '✅ فعال' : '❌ غیرفعال'}\n`;
      msg += `  ارسال: ${c.sentCount} | بازدید: ${c.viewedCount} | ورود: ${c.enteredCount}\n\n`;
    }
  }

  // قبلاً اینجا به دستور /campaign_new ارجاع می‌داد که هیچ‌جا ثبت نشده و وجود ندارد
  if (campaigns.length > 0) {
    msg += 'ساخت کمپین جدید هنوز پیاده نشده است.';
  }

  await ctx.reply(msg);
}

// ===== Settings =====
export async function adminSettingsHandler(ctx: MyContext) {
  const telegramId = ctx.from?.id!;
  if (!config.admins.includes(telegramId)) return;

  await ctx.reply(
    '⚙️ تنظیمات ربات\n\n' +
    '۱. تعیین قیمت سکه\n' +
    '۲. کانال‌های اجباری\n' +
    '۳. متن‌های ربات\n' +
    '۴. روشن/خاموش کردن بخش‌ها\n\n' +
    'برای تغییر:\n' +
    '/set_coin_price مقدار\n' +
    '/add_required_channel @channel\n' +
    '/remove_required_channel @channel\n' +
    '/toggle_section section_name\n' +
    'بخش‌ها: radar, advanced_search, daily_bonus, referral'
  );
}
