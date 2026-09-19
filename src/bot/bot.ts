import { Bot, session } from 'grammy';
import { isValidObjectId } from 'mongoose';
import { config } from '../config';
import { connectDatabase } from '../database/connection';
import { startHandler } from './handlers/start';
import { profileHandler, editProfileHandler, profileStates } from './handlers/profile';
import { startChatHandler, endChatHandler, confirmEndChat, nextChatHandler, likeUserHandler, reportUserHandler, blockUserHandler, chatMessageHandler, likedUsersHandler } from './handlers/chat';
import { adminStatsHandler, adminBroadcastHandler, sendBroadcast, adminTargetedBroadcastHandler, sendTargetedBroadcast, adminManageCoinsHandler, manageCoins, adminReportsHandler, adminBanUser, adminUnbanUser, adminCampaignHandler, adminSettingsHandler, adminAnalyticsHandler } from './handlers/admin';
import { mainKeyboard, adminKeyboard, walletKeyboard, joinChannelsKeyboard, coinPackagesKeyboard, directModeKeyboard, replyKeyboard } from './utils/keyboards';
import { t } from './utils/i18n';
import { parseSearchFilters } from './utils/filters';
import { missingChannels, MEMBERSHIP_TTL_MS } from './utils/membership';
import { UserService } from '../database/services/userService';
import { MyContext, SessionData } from '../types/context';
import { WalletService } from '../database/services/walletService';
import { formatDateTime } from './utils/datetime';
import { User } from '../database/models/User';
import { Chat } from '../database/models/Chat';
import { Report } from '../database/models/Report';
import { AdminLog } from '../database/models/AdminLog';
import chalk from 'chalk';
import cron from 'node-cron';
import { AlertService } from '../database/services/alertService';
import { TextService } from '../database/services/textService';
import { ChatService } from '../database/services/chatService';
import { escapeHtml } from './utils/html';
import { PurchaseRequest } from '../database/models/PurchaseRequest';


export async function startBot() {
  await connectDatabase();

  try {
    const customized = await TextService.load();
    if (customized > 0) console.log(chalk.green(`📝 ${customized} متن ویرایش‌شده بارگذاری شد`));
  } catch (error) {
    console.error(chalk.yellow('⚠️ بارگذاری متن‌های ویرایش‌شده ناموفق بود:'), error);
  }

  const bot = new Bot<MyContext>(config.bot.token);

  // Session
  bot.use(session({ 
    initial: (): SessionData => ({ 
      awaitingProfileInput: null, 
      awaitingBroadcastMessage: false, 
      awaitingTargetedBroadcast: false, 
      awaitingCoinManagement: false,
      awaitingAdvancedSearch: false,
      membershipCheckedAt: 0,
      dmTarget: null,
      awaitingTextEdit: null,
    }) 
  }));

  // هر تعامل آخرین فعالیت کاربر را ثبت می‌کند تا آمار آنلاین واقعی باشد
  bot.use(async (ctx, next) => {
    const telegramId = ctx.from?.id;
    if (telegramId) await UserService.touchLastSeen(telegramId);
    await next();
  });

  // عضویت اجباری کانال‌ها — REQUIRED_CHANNELS قبلاً فقط خوانده می‌شد و هیچ
  // بررسی‌ای انجام نمی‌شد. نتیجهٔ بررسی در نشست کش می‌شود تا هر پیام یک درخواست
  // به API تلگرام نزند.
  bot.use(async (ctx, next) => {
    const telegramId = ctx.from?.id;
    if (!telegramId || config.channels.required.length === 0) return next();
    if (config.admins.includes(telegramId)) return next();

    const now = Date.now();
    if (now - ctx.session.membershipCheckedAt < MEMBERSHIP_TTL_MS) return next();

    const missing = await missingChannels(ctx.api, telegramId, config.channels.required);
    ctx.session.membershipCheckedAt = now;
    if (missing.length === 0) return next();

    const list = missing.map((channel) => `• ${channel}`).join('\n');
    await ctx.reply(t.joinRequiredChannels(list), {
      reply_markup: joinChannelsKeyboard(missing),
      link_preview_options: { is_disabled: true },
    });
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});
    return;
  });

  // ===== COMMANDS =====
  bot.command('start', startHandler);

  // ===== ADMIN COMMANDS =====
  bot.command('ban', adminBanUser);
  bot.command('unban', adminUnbanUser);
  bot.command('resolve', async (ctx) => {
    const telegramId = ctx.from!.id;
    if (!config.admins.includes(telegramId)) return;
    const args = ctx.message?.text?.split(' ');
    const reportId = args && args.length >= 2 ? args[1].trim() : '';

    if (!reportId) {
      await ctx.reply('❌ فرمت: /resolve reportId');
      return;
    }
    // یک آیدی نامعتبر قبلاً CastError می‌داد و ادمین فکر می‌کرد گزارش بسته شده
    if (!isValidObjectId(reportId)) {
      await ctx.reply('❌ آیدی گزارش نامعتبر است.');
      return;
    }

    const result = await Report.updateOne(
      { _id: reportId },
      { resolved: true, resolvedBy: telegramId }
    );
    if (result.matchedCount === 0) {
      await ctx.reply(`❌ گزارشی با آیدی ${reportId} پیدا نشد.`);
      return;
    }

    await ctx.reply(`✅ گزارش ${reportId} بسته شد.`);
    await AdminLog.create({ adminId: telegramId, action: 'resolve_report', details: reportId });
  });

  bot.command('texts', async (ctx) => {
    const telegramId = ctx.from!.id;
    if (!config.admins.includes(telegramId)) return;
    const rows = TextService.list().map((row) => t.textsListLine(row.key, row.value, row.customized));
    await ctx.reply(t.textsList(rows));
  });

  bot.command('edit', async (ctx) => {
    const telegramId = ctx.from!.id;
    if (!config.admins.includes(telegramId)) return;
    const key = ctx.message?.text?.split(' ')[1]?.trim() || '';
    if (!TextService.isEditable(key)) {
      await ctx.reply(t.textEditUnknown(key));
      return;
    }
    ctx.session.awaitingTextEdit = key;
    await ctx.reply(t.textEditPrompt(key));
  });

  bot.command('resettext', async (ctx) => {
    const telegramId = ctx.from!.id;
    if (!config.admins.includes(telegramId)) return;
    const key = ctx.message?.text?.split(' ')[1]?.trim() || '';
    if (!TextService.isEditable(key)) {
      await ctx.reply(t.textEditUnknown(key));
      return;
    }
    await TextService.reset(key);
    await ctx.reply(t.textResetSaved(key));
  });

  bot.command('requests', async (ctx) => {
    const telegramId = ctx.from!.id;
    if (!config.admins.includes(telegramId)) return;

    const pending = await WalletService.listPendingRequests();
    if (pending.length === 0) {
      await ctx.reply(t.adminNoPendingRequests);
      return;
    }

    const rows = pending.map((r) =>
      t.adminRequestLine(String(r._id), r.userId, `${r.packageName} (${r.coins} سکه)`, r.price)
    );
    await ctx.reply(t.adminPendingRequests(rows));
  });

  bot.command('approve', async (ctx) => {
    const telegramId = ctx.from!.id;
    if (!config.admins.includes(telegramId)) return;
    const requestId = ctx.message?.text?.split(' ')[1]?.trim() || '';
    if (!isValidObjectId(requestId)) {
      await ctx.reply('❌ فرمت: /approve <id>');
      return;
    }

    const request = await WalletService.reviewRequest(requestId, telegramId, true);
    if (!request) {
      await ctx.reply('❌ درخواستی با این شناسه در انتظار تایید نیست.');
      return;
    }

    await ctx.reply(`✅ بستهٔ «${request.packageName}» برای کاربر ${request.userId} فعال شد.`);
    await AdminLog.create({ adminId: telegramId, action: 'approve_purchase', details: requestId });
    try {
      await ctx.api.sendMessage(request.userId, t.purchaseApproved(request.packageName, request.coins));
    } catch {
      // کاربر ربات را بلاک کرده
    }
  });

  bot.command('reject', async (ctx) => {
    const telegramId = ctx.from!.id;
    if (!config.admins.includes(telegramId)) return;
    const requestId = ctx.message?.text?.split(' ')[1]?.trim() || '';
    if (!isValidObjectId(requestId)) {
      await ctx.reply('❌ فرمت: /reject <id>');
      return;
    }

    const request = await WalletService.reviewRequest(requestId, telegramId, false);
    if (!request) {
      await ctx.reply('❌ درخواستی با این شناسه در انتظار تایید نیست.');
      return;
    }

    await ctx.reply(`❌ درخواست کاربر ${request.userId} رد شد.`);
    await AdminLog.create({ adminId: telegramId, action: 'reject_purchase', details: requestId });
    try {
      await ctx.api.sendMessage(request.userId, t.purchaseRejected(request.packageName));
    } catch {
      // کاربر ربات را بلاک کرده
    }
  });

  // ===== TEXT HANDLERS =====
  // startChatHandler پارامتر دوم فیلتر دارد و مستقیم بهعنوان middleware کار نمی‌کند
  bot.hears(t.startChat, (ctx) => startChatHandler(ctx));
  bot.hears(t.advancedSearch, async (ctx) => {
    const user = await UserService.getById(ctx.from!.id);
    if (!user || !user.profile.isComplete) { await ctx.reply(t.profileIncomplete); return; }
    if (user.coins < config.coins.advancedSearchCost) { await ctx.reply(t.notEnoughCoins(config.coins.advancedSearchCost)); return; }
    // هزینه وقتی کم می‌شود که فیلترها وارد و جستجو اجرا شود، نه وقتی کاربر
    // فقط منو را باز می‌کند و ممکن است هیچ‌وقت فیلتری نفرستد
    ctx.session.awaitingAdvancedSearch = true;
    await ctx.reply('🔍 جستجوی پیشرفته (هزینه: ۱۰ سکه)\n\nلطفاً فیلترها را وارد کنید:\n`gender=male, minAge=18, maxAge=30, province=تهران`');
  });

  bot.hears(t.radar, async (ctx) => {
    const user = await UserService.getById(ctx.from!.id);
    if (!user || !user.profile.isComplete) { await ctx.reply(t.profileIncomplete); return; }
    if (user.coins < config.coins.radarCost) { await ctx.reply(t.notEnoughCoins(config.coins.radarCost)); return; }
    await UserService.spendCoins(user.telegramId, config.coins.radarCost, 'رادار');

    const nearby = await User.find({
      telegramId: { $ne: user.telegramId },
      status: 'active',
      'profile.province': user.profile.province,
      chatStatus: 'waiting',
      isOnline: true,
    }).limit(5);

    if (nearby.length === 0) {
      await ctx.reply('📡 هم‌صحبت نزدیکی یافت نشد.');
    } else {
      let msg = `📡 افراد نزدیک در ${user.profile.province}:\n\n`;
      nearby.forEach((u, i) => {
        msg += `${i + 1}. ${u.profile.name || 'ناشناس'} — ${u.profile.age || '?'} ساله\n`;
      });
      msg += '\nبرای شروع چت از گزینه "شروع چت" استفاده کنید.';
      await ctx.reply(msg);
    }
  });

  bot.hears(t.profile, profileHandler);
  bot.hears(t.wallet, async (ctx) => {
    const user = await UserService.getById(ctx.from!.id);
    if (!user) return;
    // دکمه‌های کیف پول (تاریخچه/خرید) ساخته شده بودند ولی هیچ‌وقت به پیام وصل نشدند
    await ctx.reply(t.walletInfo(user.coins, user.totalCoinsEarned, user.totalCoinsSpent, user.isVip), {
      reply_markup: walletKeyboard(),
    });
  });
  bot.hears(t.referral, async (ctx) => {
    const link = await UserService.generateReferralLink(ctx.from!.id);
    const user = await UserService.getById(ctx.from!.id);
    await ctx.reply(t.referralInfo(link, user?.referralCount || 0));
  });
  bot.hears(t.support, async (ctx) => {
    await ctx.reply(t.supportMenu, { parse_mode: 'HTML' });
  });

  // Admin handlers
  bot.hears(t.adminPanel, async (ctx) => {
    if (!config.admins.includes(ctx.from!.id)) return;
    await ctx.reply(t.adminMenu, { reply_markup: adminKeyboard() });
  });
  bot.hears(t.stats, adminStatsHandler);
  bot.hears(t.analytics, adminAnalyticsHandler);
  bot.hears(t.broadcast, adminBroadcastHandler);
  bot.hears(t.targetedBroadcast, adminTargetedBroadcastHandler);
  bot.hears(t.manageCoins, adminManageCoinsHandler);
  bot.hears(t.reports, adminReportsHandler);
  bot.hears(t.campaigns, adminCampaignHandler);
  bot.hears(t.settings, adminSettingsHandler);
  bot.hears(t.logout, async (ctx) => {
    await ctx.reply('🏠 بازگشت به منوی اصلی', { reply_markup: mainKeyboard() });
  });

  // ===== CALLBACK QUERIES =====
  bot.callbackQuery('edit_profile', async (ctx) => {
    await editProfileHandler(ctx);
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery(/gender_(male|female)/, async (ctx) => {
    const gender = ctx.match![1] as 'male' | 'female';
    await profileStates.handleGenderSelection(ctx, gender);
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery('end_chat', endChatHandler);
  bot.callbackQuery('confirm_end_chat', async (ctx) => {
    await confirmEndChat(ctx);
    await ctx.answerCallbackQuery();
  });
  bot.callbackQuery('cancel_end_chat', async (ctx) => {
    await ctx.deleteMessage();
    await ctx.answerCallbackQuery();
  });
  bot.callbackQuery('next_chat', nextChatHandler);
  bot.callbackQuery('like_user', likeUserHandler);
  bot.callbackQuery('report_user', reportUserHandler);
  bot.callbackQuery(/report_\w+_(\w+)/, async (ctx) => {
    const chatId = ctx.match![1];
    const reason = ctx.callbackQuery.data!.split('_')[1];
    const telegramId = ctx.from!.id;
    const chat = await Chat.findById(chatId);
    if (!chat) { await ctx.reply('❌ خطا'); return; }
    const reportedId = chat.users.find(u => u !== telegramId);
    if (!reportedId) return;
    await Report.create({ reporterId: telegramId, reportedId, chatId, reason, description: '' });
    await ctx.reply(t.reportReceived);
    await ctx.answerCallbackQuery();
  });
  bot.callbackQuery('block_user', blockUserHandler);
  bot.callbackQuery('liked_users', likedUsersHandler);

  // ورود به حالت پیام مستقیم با یک اتصال دوطرفه
  bot.callbackQuery(/^dm_(\d+)$/, async (ctx) => {
    const partnerId = Number(ctx.match![1]);
    const connections = await ChatService.listConnections(ctx.from!.id);
    if (!connections.includes(partnerId)) {
      await ctx.answerCallbackQuery({ text: '❌ با این کاربر اتصال دوطرفه ندارید.' });
      return;
    }

    const partner = await User.findOne({ telegramId: partnerId }).select('profile.name').lean();
    ctx.session.dmTarget = partnerId;
    await ctx.reply(t.directModeOn(escapeHtml(partner?.profile?.name || 'ناشناس')), {
      reply_markup: directModeKeyboard(),
    });
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery('dm_exit', async (ctx) => {
    ctx.session.dmTarget = null;
    await ctx.editMessageText(t.directModeOff).catch(() => {});
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery('check_membership', async (ctx) => {
    const telegramId = ctx.from!.id;
    const missing = await missingChannels(ctx.api, telegramId, config.channels.required);
    ctx.session.membershipCheckedAt = Date.now();

    if (missing.length === 0) {
      await ctx.answerCallbackQuery({ text: t.membershipConfirmed, show_alert: true });
      await ctx.reply(t.welcome, {
        parse_mode: 'HTML',
        reply_markup: config.admins.includes(telegramId) ? adminKeyboard() : mainKeyboard(),
      });
    } else {
      await ctx.answerCallbackQuery({
        text: t.membershipStillMissing(missing.join('، ')),
        show_alert: true,
      });
    }
  });

  bot.callbackQuery('transaction_history', async (ctx) => {
    const telegramId = ctx.from!.id;
    const user = await UserService.getById(telegramId);
    const history = await WalletService.getTransactionHistory(telegramId, 10);

    if (history.length === 0) {
      await ctx.reply(t.transactionHistoryEmpty);
    } else {
      const rows = history.map((tx) =>
        t.transactionLine(tx.type, tx.amount, tx.description, formatDateTime(tx.createdAt))
      );
      await ctx.reply(t.walletHistory(rows, user?.coins ?? 0), { parse_mode: 'HTML' });
    }
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery('buy_coins', async (ctx) => {
    const rows = WalletService.coinPackages.map((pkg) =>
      t.packageLine(pkg.name, pkg.coins, pkg.price)
    );
    await ctx.reply(t.buyCoins(rows), { reply_markup: coinPackagesKeyboard(WalletService.coinPackages) });
    await ctx.answerCallbackQuery();
  });

  // انتخاب بسته ⇒ درخواست در انتظار تایید. سکه‌ها فقط بعد از تایید ادمین
  // اضافه می‌شوند، چون درگاه پرداخت وجود ندارد و تنها راه مطمئن، تایید دستی است.
  bot.callbackQuery(/^buy_(.+)$/, async (ctx) => {
    const telegramId = ctx.from!.id;
    const packageId = ctx.match![1];
    const pkg = WalletService.findPackage(packageId);
    if (!pkg) {
      await ctx.answerCallbackQuery({ text: '❌ این بسته وجود ندارد.' });
      return;
    }

    const before = await PurchaseRequest.findOne({ userId: telegramId, status: 'pending' });
    const request = await WalletService.createRequest(telegramId, packageId);
    if (!request) {
      await ctx.answerCallbackQuery({ text: '❌ خطا در ثبت درخواست.' });
      return;
    }
    if (before) {
      await ctx.answerCallbackQuery({ text: t.purchaseAlreadyPending, show_alert: true });
      return;
    }

    await ctx.reply(t.purchaseRequested(pkg.name, pkg.coins, pkg.price));
    await ctx.answerCallbackQuery();

    // ادمین‌ها خبردار می‌شوند تا درخواست بی‌پاسخ نماند
    const notice = t.adminRequestLine(String(request._id), telegramId, pkg.name, pkg.price);
    for (const adminId of config.admins) {
      try {
        await ctx.api.sendMessage(adminId, `💳 درخواست خرید جدید\n\n${notice}`);
      } catch {
        // ادمینی که ربات را بلاک کرده
      }
    }
  });
  bot.callbackQuery('confirm_report', async (ctx) => {
    await ctx.reply('🚨 لطفاً دلیل گزارش را انتخاب کنید.');
    await ctx.answerCallbackQuery();
  });
  bot.callbackQuery('back_main', async (ctx) => {
    const isAdmin = config.admins.includes(ctx.from!.id);
    await ctx.reply(t.mainMenu, { reply_markup: isAdmin ? adminKeyboard() : mainKeyboard() });
    await ctx.answerCallbackQuery();
  });
  bot.callbackQuery('cancel_report', async (ctx) => {
    await ctx.reply('لغو شد.');
    await ctx.answerCallbackQuery();
  });
  bot.callbackQuery('contact_support', async (ctx) => {
    await ctx.reply('📞 برای ارتباط با پشتیبانی به آیدی @llllxyz پیام دهید.');
    await ctx.answerCallbackQuery();
  });

  // ===== CHAT MESSAGE FORWARDING =====
  bot.on('message:text', async (ctx) => {
    const sessionData = ctx.session;

    // Profile input handlers
    if (sessionData.awaitingProfileInput === 'name') {
      await profileStates.handleNameInput(ctx);
      return;
    }
    if (sessionData.awaitingProfileInput === 'age') {
      await profileStates.handleAgeInput(ctx);
      return;
    }
    if (sessionData.awaitingProfileInput === 'province') {
      await profileStates.handleProvinceInput(ctx);
      return;
    }
    if (sessionData.awaitingProfileInput === 'city') {
      await profileStates.handleCityInput(ctx);
      return;
    }

    // Admin: Broadcast message
    if (sessionData.awaitingBroadcastMessage) {
      const text = ctx.message?.text || '';
      await sendBroadcast(ctx, text);
      sessionData.awaitingBroadcastMessage = false;
      return;
    }

    // Admin: Targeted broadcast
    if (sessionData.awaitingTargetedBroadcast) {
      const text = ctx.message?.text || '';
      await sendTargetedBroadcast(ctx, text);
      sessionData.awaitingTargetedBroadcast = false;
      return;
    }

    // Admin: Coin management
    if (sessionData.awaitingCoinManagement) {
      const text = ctx.message?.text || '';
      await manageCoins(ctx, text);
      sessionData.awaitingCoinManagement = false;
      return;
    }

    // User: Advanced search filters
    if (sessionData.awaitingAdvancedSearch) {
      sessionData.awaitingAdvancedSearch = false;

      const filters = parseSearchFilters(ctx.message?.text || '');
      if (!filters) {
        await ctx.reply('❌ فیلتر معتبری پیدا نشد. نمونه:\ngender=female, minAge=18, maxAge=30, province=تهران');
        return;
      }

      const paid = await UserService.spendCoins(
        ctx.from!.id,
        config.coins.advancedSearchCost,
        'جستجوی پیشرفته'
      );
      if (!paid) {
        await ctx.reply(t.notEnoughCoins(config.coins.advancedSearchCost));
        return;
      }

      // فیلترها به خودِ جستجو پاس می‌شوند؛ قبلاً هم‌صحبت همین‌جا پیدا و دور
      // ریخته می‌شد و بعد startChatHandler بدون فیلتر دوباره جستجو می‌کرد
      await startChatHandler(ctx, filters);
      return;
    }

    // ادمین: متن جدید برای یک کلید
    if (sessionData.awaitingTextEdit) {
      const key = sessionData.awaitingTextEdit;
      const text = ctx.message?.text || '';
      sessionData.awaitingTextEdit = null;

      if (!config.admins.includes(ctx.from!.id)) return;
      if (text === '/cancel') {
        await ctx.reply(t.textEditCancelled);
        return;
      }
      if (!text.trim()) {
        await ctx.reply('❌ متن خالی ذخیره نمی‌شود.');
        return;
      }

      await TextService.set(key as never, text, ctx.from!.id);
      await AdminLog.create({ adminId: ctx.from!.id, action: 'edit_text', details: key });
      await ctx.reply(t.textEditSaved(key));
      return;
    }

    // پیام مستقیم به یک اتصال دوطرفه
    const dmTarget = sessionData.dmTarget;
    if (dmTarget) {
      const sender = await User.findOne({ telegramId: ctx.from!.id }).select('profile.name').lean();
      const senderName = escapeHtml(sender?.profile?.name || 'ناشناس');
      const text = ctx.message?.text || '';

      // فقط اگر مخاطب ما را بلاک نکرده باشد
      const target = await User.findOne({ telegramId: dmTarget }).select('blockedUsers').lean();
      if (target && (target.blockedUsers || []).includes(ctx.from!.id)) {
        await ctx.reply('❌ این کاربر شما را مسدود کرده است.');
        sessionData.dmTarget = null;
        return;
      }

      try {
        await ctx.api.sendMessage(
          dmTarget,
          `✉️ پیام مستقیم از ${senderName}:\n\n${text}`,
          { parse_mode: 'HTML', reply_markup: replyKeyboard(ctx.from!.id) }
        );
        await ctx.reply(t.directSent(senderName));
      } catch {
        await ctx.reply('❌ پیام فرستاده نشد؛ شاید کاربر ربات را بلاک کرده است.');
      }
      return;
    }

    // Forward chat message
    await chatMessageHandler(ctx);
  });

  // ===== START BOT =====
  bot.catch((err) => {
    console.error(chalk.red('❌ Bot error:'), err);
  });

  // ===== ALERTS =====
  // node-cron نصب بود و هیچ‌جا استفاده نمی‌شد. این اسکن هر ۱۰ دقیقه یک‌بار
  // کاربرانی را که گزارش بازشان به آستانه رسیده به ادمین‌ها اطلاع می‌دهد.
  // خود اسکن و علامت‌گذاری در AlertService انجام می‌شود تا هر گزارش یک‌بار
  // هشدار بدهد، حتی اگر ربات چند نمونه اجرا شود.
  if (config.admins.length > 0) {
    cron.schedule('*/10 * * * *', async () => {
      try {
        const alerts = await AlertService.findRepeatOffenders();
        if (alerts.length === 0) return;

        const lines = alerts.map((a) => t.repeatOffenderLine(a.name, a.reportedId, a.count));
        for (const adminId of config.admins) {
          try {
            await bot.api.sendMessage(adminId, t.repeatOffenderAlert(lines), { parse_mode: 'HTML' });
          } catch {
            // ادمینی که ربات را بلاک کرده
          }
        }
      } catch (error) {
        console.error(chalk.red('❌ Alert scan failed:'), error);
      }
    });
    console.log(chalk.gray('⏱️  Alert scan scheduled (every 10 minutes)'));
  }

  await bot.start({
    drop_pending_updates: true,
    onStart: () => {
      console.log(chalk.green(`\n🤖 Bot started: @${config.bot.username}`));
      console.log(chalk.green(`👥 Admins: ${config.admins.join(', ')}`));
      console.log(chalk.green('✅ Ready to serve!\n'));
    },
  });
}
