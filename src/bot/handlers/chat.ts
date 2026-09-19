import { MyContext } from '../../types/context';
import { UserService } from '../../database/services/userService';
import { ChatService } from '../../database/services/chatService';
import { User } from '../../database/models/User';
import { Chat } from '../../database/models/Chat';
import { Report } from '../../database/models/Report';
import { chatKeyboard, endChatKeyboard, reportReasonKeyboard } from '../utils/keyboards';
import { t } from '../utils/i18n';
import { escapeHtml } from '../utils/html';
import { SearchFilters } from '../utils/filters';
import { config } from '../../config';

// ===== Start Random Chat =====
export async function startChatHandler(ctx: MyContext, filters?: SearchFilters) {
  const telegramId = ctx.from?.id!;
  const user = await UserService.getById(telegramId);
  if (!user) return;

  if (!user.profile.isComplete) {
    await ctx.reply(t.profileIncomplete, { parse_mode: 'HTML' });
    return;
  }

  // اگر همین حالا در چت فعالی هستیم، چت دوم ساخته نمی‌شود
  const existingChat = await ChatService.getActiveChat(telegramId);
  if (existingChat) {
    await ctx.reply('⚠️ شما در حال حاضر در یک چت فعال هستید. اول آن را ببندید.', {
      reply_markup: chatKeyboard(),
    });
    return;
  }

  // Set user as waiting
  await User.updateOne({ telegramId }, { chatStatus: 'waiting', isOnline: true });
  await ctx.reply(t.findingPartner, { parse_mode: 'HTML' });

  // Try to find a partner
  const partner = await UserService.searchForPartner(telegramId, filters);
  if (partner) {
    let chat;
    try {
      chat = await ChatService.createChat(telegramId, partner.telegramId);
    } catch (error) {
      // رزرو را برمی‌گردانیم تا هم‌صحبتی که پیدا شده برای نفر بعدی در صف بماند
      await User.updateOne(
        { telegramId: partner.telegramId },
        { chatStatus: 'waiting', currentPartner: null }
      );
      await ctx.reply('❌ خطا در ایجاد چت. لطفاً دوباره تلاش کنید.');
      return;
    }

    await ctx.reply(
      t.partnerFound(
        escapeHtml(partner.profile.name),
        partner.profile.age || 0,
        escapeHtml(partner.profile.province)
      ),
      { reply_markup: chatKeyboard(), parse_mode: 'HTML' }
    );

    try {
      await ctx.api.sendMessage(
        partner.telegramId,
        t.partnerFound(
          escapeHtml(user.profile.name),
          user.profile.age || 0,
          escapeHtml(user.profile.province)
        ),
        { reply_markup: chatKeyboard(), parse_mode: 'HTML' } as any
      );
    } catch {
      await ChatService.endChat(chat._id.toString(), telegramId);
      await ctx.reply('❌ هم‌صحبت شما ربات را مسدود کرده است.');
    }
  } else {
    // No partner found, timeout after waiting period
    setTimeout(async () => {
      const stillWaiting = await User.findOne({ telegramId, chatStatus: 'waiting' });
      if (stillWaiting) {
        await User.updateOne({ telegramId }, { chatStatus: 'idle' });

        // جستجوی پیشرفته پول گرفته ولی هم‌صحبتی پیدا نشد ⇒ هزینه برمی‌گردد
        let refundNote = '';
        if (filters) {
          await UserService.addCoins(telegramId, config.coins.advancedSearchCost, 'بازگشت هزینهٔ جستجوی پیشرفته');
          refundNote = `\n\n💰 هزینهٔ ${config.coins.advancedSearchCost} سکه‌ای جستجوی پیشرفته برگشت داده شد.`;
        }

        try {
          const msg = await ctx.reply(t.noChatPartner + refundNote, { parse_mode: 'HTML' });
          setTimeout(() => ctx.deleteMessages([msg.message_id]), 5000);
        } catch {}
      }
    }, config.limits.waitingTimeout);
  }
}

// ===== End Chat =====
export async function endChatHandler(ctx: MyContext) {
  const telegramId = ctx.from?.id!;
  const chat = await ChatService.getActiveChat(telegramId);
  if (!chat) {
    await ctx.reply('شما در حال حاضر چت فعالی ندارید.');
    return;
  }
  await ctx.reply('آیا مطمئن هستید؟', { reply_markup: endChatKeyboard() });
}

export async function confirmEndChat(ctx: MyContext) {
  const telegramId = ctx.from?.id!;
  const chat = await ChatService.getActiveChat(telegramId);
  if (!chat) return;

  const partnerId = chat.users.find(u => u !== telegramId);
  await ChatService.endChat(chat._id.toString(), telegramId);
  await ctx.reply(t.chatEnded, { parse_mode: 'HTML' });

  if (partnerId) {
    try {
      await ctx.api.sendMessage(partnerId, t.partnerDisconnected, { parse_mode: 'HTML' } as any);
      await User.updateOne({ telegramId: partnerId }, { chatStatus: 'idle', currentPartner: null });
    } catch {}
  }
}

export async function nextChatHandler(ctx: MyContext) {
  await confirmEndChat(ctx);
  setTimeout(() => startChatHandler(ctx), 500);
}

// ===== Like =====
export async function likeUserHandler(ctx: MyContext) {
  const telegramId = ctx.from?.id!;
  const chat = await ChatService.getActiveChat(telegramId);
  if (!chat) {
    await ctx.reply('چت فعالی وجود ندارد.');
    return;
  }
  await ChatService.likeUser(chat._id.toString(), telegramId);
  await ctx.reply('❤️ لایک ثبت شد!');
}

// ===== Report =====
export async function reportUserHandler(ctx: MyContext) {
  const telegramId = ctx.from?.id!;
  const chat = await ChatService.getActiveChat(telegramId);
  if (!chat) {
    await ctx.reply('چت فعالی وجود ندارد.');
    return;
  }
  await ctx.reply(t.reportReason, {
    reply_markup: reportReasonKeyboard(chat._id.toString()),
    parse_mode: 'HTML',
  });
}

// ===== Block =====
export async function blockUserHandler(ctx: MyContext) {
  const telegramId = ctx.from?.id!;
  const chat = await ChatService.getActiveChat(telegramId);
  if (!chat) {
    await ctx.reply('چت فعالی وجود ندارد.');
    return;
  }
  const partnerId = chat.users.find(u => u !== telegramId);
  if (partnerId) {
    await User.updateOne({ telegramId }, { $addToSet: { blockedUsers: partnerId } });
    await ctx.reply(t.blocked, { parse_mode: 'HTML' });
    await ChatService.endChat(chat._id.toString(), telegramId);
  }
}

// ===== Forward Chat Messages =====
export async function chatMessageHandler(ctx: MyContext) {
  const telegramId = ctx.from?.id!;
  const chat = await ChatService.getActiveChat(telegramId);
  if (!chat) return;

  const partnerId = chat.users.find(u => u !== telegramId);
  if (!partnerId) return;

  const text = ctx.message?.text;
  if (!text || text.startsWith('/')) return;

  try {
    // بدون parse_mode می‌فرستیم؛ وگرنه یک < ساده در متن باعث خطای ۴۰۰ تلگرام
    // می‌شود، پیام نمی‌رسد و هم‌صحبت اشتباهی قطع می‌شود.
    await ctx.api.sendMessage(partnerId, text);
    await Chat.updateOne({ _id: chat._id }, { $inc: { messagesCount: 1 } });
  } catch {
    await ctx.reply('❌ هم‌صحبت شما قادر به دریافت پیام نیست.');
    await ChatService.endChat(chat._id.toString(), telegramId);
  }
}

// ===== Direct Message =====
export async function directMessageHandler(ctx: MyContext) {
  // This would be triggered from a user's liked users list
  // For now, it's a placeholder
  await ctx.reply('📨 برای ارسال پیام دایرکت، از لیست کاربرانی که لایک کردید انتخاب کنید.');
}
