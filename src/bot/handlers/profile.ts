import { MyContext } from '../../types/context';
import { UserService } from '../../database/services/userService';
import { profileKeyboard, genderKeyboard } from '../utils/keyboards';
import { t } from '../utils/i18n';

export async function profileHandler(ctx: MyContext) {
  const telegramId = ctx.from?.id!;
  const user = await UserService.getById(telegramId);
  if (!user) return;

  await ctx.reply(
    t.profileInfo(
      user.profile.name,
      user.profile.gender,
      user.profile.age,
      user.profile.province,
      user.profile.city,
      user.coins
    ),
    { reply_markup: profileKeyboard(), parse_mode: 'HTML' }
  );
}

export async function editProfileHandler(ctx: MyContext) {
  await ctx.reply(t.enterName, { parse_mode: 'HTML' });
  // Set session state to await name input
  ctx.session.awaitingProfileInput = 'name';
}

// These will be triggered by callback queries and text responses
export const profileStates = {
  async handleNameInput(ctx: MyContext) {
    const name = ctx.message?.text;
    if (!name || name.length > 50) {
      await ctx.reply('⚠️ لطفاً یک نام معتبر (حداکثر ۵۰ حرف) وارد کنید:');
      return;
    }
    const telegramId = ctx.from?.id!;
    await UserService.updateProfile(telegramId, { name } as any);
    ctx.session.awaitingProfileInput = 'gender';
    await ctx.reply(t.enterGender, { reply_markup: genderKeyboard() });
  },

  async handleGenderSelection(ctx: MyContext, gender: 'male' | 'female') {
    const telegramId = ctx.from?.id!;
    await UserService.updateProfile(telegramId, { gender } as any);
    ctx.session.awaitingProfileInput = 'age';
    await ctx.reply(t.enterAge);
  },

  async handleAgeInput(ctx: MyContext) {
    const ageText = ctx.message?.text;
    const age = parseInt(ageText || '');
    if (isNaN(age) || age < 10 || age > 100) {
      await ctx.reply('⚠️ لطفاً یک سن معتبر بین ۱۰ تا ۱۰۰ وارد کنید:');
      return;
    }
    const telegramId = ctx.from?.id!;
    await UserService.updateProfile(telegramId, { age } as any);
    ctx.session.awaitingProfileInput = 'province';
    await ctx.reply(t.enterProvince);
  },

  async handleProvinceInput(ctx: MyContext) {
    const province = ctx.message?.text;
    if (!province || province.length > 50) {
      await ctx.reply('⚠️ لطفاً نام استان را وارد کنید:');
      return;
    }
    const telegramId = ctx.from?.id!;
    await UserService.updateProfile(telegramId, { province } as any);
    ctx.session.awaitingProfileInput = 'city';
    await ctx.reply(t.enterCity);
  },

  async handleCityInput(ctx: MyContext) {
    const city = ctx.message?.text;
    if (!city || city.length > 50) {
      await ctx.reply('⚠️ لطفاً نام شهر را وارد کنید:');
      return;
    }
    const telegramId = ctx.from?.id!;
    await UserService.updateProfile(telegramId, { city } as any);
    ctx.session.awaitingProfileInput = null;
    await ctx.reply('✅ پروفایل شما با موفقیت تکمیل شد! +۳۰ سکه جایزه گرفتید.', {
      reply_markup: { remove_keyboard: true },
      parse_mode: 'HTML',
    });
    await profileHandler(ctx);
  },
};
