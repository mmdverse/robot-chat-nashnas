import { Bot, session } from 'grammy';
import { isValidObjectId } from 'mongoose';
import { config } from '../config';
import { connectDatabase } from '../database/connection';
import { startHandler } from './handlers/start';
import { profileHandler, editProfileHandler, profileStates } from './handlers/profile';
import { startChatHandler, endChatHandler, confirmEndChat, nextChatHandler, likeUserHandler, reportUserHandler, blockUserHandler, chatMessageHandler, likedUsersHandler } from './handlers/chat';
import { adminStatsHandler, adminBroadcastHandler, sendBroadcast, adminTargetedBroadcastHandler, sendTargetedBroadcast, adminManageCoinsHandler, manageCoins, adminReportsHandler, adminBanUser, adminUnbanUser, adminCampaignHandler, adminSettingsHandler, adminAnalyticsHandler } from './handlers/admin';
import { mainKeyboard, adminKeyboard, walletKeyboard, joinChannelsKeyboard } from './utils/keyboards';
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


export async function startBot() {
  await connectDatabase();

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
    // خرید آنلاین ساخته نشده و WalletService.purchaseCoins بدون هیچ پرداختی
    // سکه اضافه می‌کند؛ تا وقتی درگاه پرداخت وصل نشده، دکمه فقط بسته‌ها را
    // نشان می‌دهد و پول اضافه نمی‌کند
    const rows = WalletService.coinPackages.map(
      (pkg) => `• ${pkg.name} — ${pkg.coins} سکه — ${pkg.price}`
    );
    await ctx.reply(t.buyCoinsUnavailable(rows), { parse_mode: 'HTML' });
    await ctx.answerCallbackQuery();
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

    // Forward chat message
    await chatMessageHandler(ctx);
  });

  // ===== START BOT =====
  bot.catch((err) => {
    console.error(chalk.red('❌ Bot error:'), err);
  });

  await bot.start({
    drop_pending_updates: true,
    onStart: () => {
      console.log(chalk.green(`\n🤖 Bot started: @${config.bot.username}`));
      console.log(chalk.green(`👥 Admins: ${config.admins.join(', ')}`));
      console.log(chalk.green('✅ Ready to serve!\n'));
    },
  });
}
