import { Bot, session } from 'grammy';
import { config } from '../config';
import { connectDatabase } from '../database/connection';
import { startHandler } from './handlers/start';
import { profileHandler, editProfileHandler, profileStates } from './handlers/profile';
import { startChatHandler, endChatHandler, confirmEndChat, nextChatHandler, likeUserHandler, reportUserHandler, blockUserHandler, chatMessageHandler } from './handlers/chat';
import { adminStatsHandler, adminBroadcastHandler, sendBroadcast, adminTargetedBroadcastHandler, sendTargetedBroadcast, adminManageCoinsHandler, manageCoins, adminReportsHandler, adminBanUser, adminUnbanUser, adminCampaignHandler, adminSettingsHandler } from './handlers/admin';
import { mainKeyboard, adminKeyboard } from './utils/keyboards';
import { t } from './utils/i18n';
import { UserService } from '../database/services/userService';
import { MyContext, SessionData } from '../types/context';
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
    }) 
  }));

  // ===== COMMANDS =====
  bot.command('start', startHandler);

  // ===== ADMIN COMMANDS =====
  bot.command('ban', adminBanUser);
  bot.command('unban', adminUnbanUser);
  bot.command('resolve', async (ctx) => {
    const telegramId = ctx.from!.id;
    if (!config.admins.includes(telegramId)) return;
    const args = ctx.message?.text?.split(' ');
    if (args && args.length >= 2) {
      const reportId = args[1];
      await Report.updateOne({ _id: reportId }, { resolved: true, resolvedBy: telegramId });
      await ctx.reply(`✅ گزارش ${reportId} بسته شد.`);
      await AdminLog.create({ adminId: telegramId, action: 'resolve_report', details: reportId });
    } else {
      await ctx.reply('❌ فرمت: /resolve reportId');
    }
  });

  // ===== TEXT HANDLERS =====
  bot.hears(t.startChat, startChatHandler);
  bot.hears(t.advancedSearch, async (ctx) => {
    const user = await UserService.getById(ctx.from!.id);
    if (!user || !user.profile.isComplete) { await ctx.reply(t.profileIncomplete); return; }
    if (user.coins < config.coins.advancedSearchCost) { await ctx.reply(t.notEnoughCoins(config.coins.advancedSearchCost)); return; }
    await UserService.spendCoins(user.telegramId, config.coins.advancedSearchCost, 'جستجوی پیشرفته');
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
    await ctx.reply(t.walletInfo(user.coins, user.totalCoinsEarned, user.totalCoinsSpent, user.isVip));
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
      const text = ctx.message?.text || '';
      // Parse filters from text (format: gender=male, minAge=18, ...)
      const filters: any = {};
      text.split(',').forEach(part => {
        const [key, value] = part.trim().split('=');
        if (key && value) {
          if (key.trim() === 'minAge' || key.trim() === 'maxAge') filters[key.trim()] = parseInt(value);
          else filters[key.trim()] = value;
        }
      });
      const user = await UserService.searchForPartner(ctx.from!.id, filters);
      if (user) {
        await User.findOneAndUpdate({ telegramId: ctx.from!.id }, { chatStatus: 'waiting' });
        await startChatHandler(ctx);
      } else {
        await ctx.reply('🔍 هم‌صحبتی با این فیلترها یافت نشد.');
      }
      sessionData.awaitingAdvancedSearch = false;
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
