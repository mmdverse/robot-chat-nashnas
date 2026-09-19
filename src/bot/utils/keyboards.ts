import { Keyboard, InlineKeyboard } from 'grammy';
import { t } from './i18n';

export function mainKeyboard() {
  return new Keyboard()
    .text(t.startChat).text(t.advancedSearch).row()
    .text(t.profile).text(t.wallet).row()
    .text(t.radar).text(t.referral).row()
    .text(t.support).row()
    .resized().persistent();
}

export function adminKeyboard() {
  return new Keyboard()
    .text(t.stats).text(t.broadcast).row()
    .text(t.targetedBroadcast).text(t.manageCoins).row()
    .text(t.reports).text(t.campaigns).row()
    .text(t.settings).text(t.logout).row()
    .resized().persistent();
}

export function profileKeyboard() {
  return new InlineKeyboard()
    .text(t.editProfile, 'edit_profile')
    .text(t.back, 'back_main');
}

export function genderKeyboard() {
  return new InlineKeyboard()
    .text(t.male, 'gender_male')
    .text(t.female, 'gender_female');
}

export function chatKeyboard() {
  return new InlineKeyboard()
    .text(t.endChat, 'end_chat')
    .text(t.nextChat, 'next_chat')
    .text(t.like, 'like_user')
    .row()
    .text(t.report, 'report_user')
    .text(t.blockUser, 'block_user')
    .text(t.likedUsers, 'liked_users');
}

export function reportReasonKeyboard(chatId: string) {
  return new InlineKeyboard()
    .text(t.harassment, `report_harassment_${chatId}`)
    .text(t.spam, `report_spam_${chatId}`)
    .row()
    .text(t.fake, `report_fake_${chatId}`)
    .text(t.inappropriate, `report_inappropriate_${chatId}`)
    .row()
    .text(t.other, `report_other_${chatId}`)
    .text(t.cancel, 'cancel_report');
}

export function supportKeyboard() {
  return new InlineKeyboard()
    .text('📨 ارسال به پشتیبانی', 'contact_support')
    .text(t.back, 'back_main');
}

export function walletKeyboard() {
  return new InlineKeyboard()
    .text('💳 خرید سکه', 'buy_coins')
    .text('📊 تاریخچه', 'transaction_history')
    .row()
    .text(t.back, 'back_main');
}

export function backKeyboard() {
  return new InlineKeyboard().text(t.back, 'back_main');
}

export function endChatKeyboard() {
  return new InlineKeyboard()
    .text('🔚 بله، پایان چت', 'confirm_end_chat')
    .text('🔙 ادامه چت', 'cancel_end_chat');
}

export function confirmKeyboard(action: string) {
  return new InlineKeyboard()
    .text(t.confirm, `confirm_${action}`)
    .text(t.cancel, `cancel_${action}`);
}
