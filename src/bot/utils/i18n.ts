import { escapeHtml } from './html';

// Persian translations for the bot
export const t = {
  welcome: `🌟 به ربات چت ناشناس خوش آمدید!

📝 لطفاً ابتدا پروفایل خود را تکمیل کنید تا بتوانید از امکانات ربات استفاده کنید.

💰 با تکمیل پروفایل ۳۰ سکه جایزه بگیرید!`,

  mainMenu: '🏠 منوی اصلی',
  startChat: '🎲 شروع چت تصادفی',
  advancedSearch: '🔍 جستجوی پیشرفته',
  radar: '📡 رادار افراد نزدیک',
  profile: '👤 پروفایل من',
  wallet: '💰 کیف پول',
  referral: '📨 دعوت از دوستان',
  support: '❓ راهنما و پشتیبانی',
  adminPanel: '⚙️ پنل مدیریت',

  // Profile
  profileTitle: '👤 پروفایل شما',
  profileInfo: (name?: string, gender?: string, age?: number, province?: string, city?: string, coins?: number) =>
    `📋 مشخصات شما:
    
👤 نام: ${name || 'ثبت نشده'}
👫 جنسیت: ${gender === 'male' ? '👨 پسر' : gender === 'female' ? '👩 دختر' : '❓ نامشخص'}
🎂 سن: ${age || 'ثبت نشده'}
📍 استان: ${province || 'ثبت نشده'}
🏙️ شهر: ${city || 'ثبت نشده'}
💰 سکه: ${coins || 0}

${!name || !gender || !age || !province ? '⚠️ لطفاً پروفایل خود را کامل کنید!' : '✅ پروفایل شما کامل است!'}`,

  editProfile: '✏️ ویرایش پروفایل',
  enterName: '👤 لطفاً نام خود را وارد کنید:',
  enterGender: '👫 لطفاً جنسیت خود را انتخاب کنید:',
  male: '👨 پسر',
  female: '👩 دختر',
  enterAge: '🎂 لطفاً سن خود را وارد کنید:',
  enterProvince: '📍 لطفاً استان خود را وارد کنید:',
  enterCity: '🏙️ لطفاً شهر خود را وارد کنید:',

  // Wallet
  walletInfo: (coins: number, totalEarned: number, totalSpent: number, isVip: boolean) =>
    `💰 کیف پول شما

موجودی: ${coins} سکه 🪙
مجموع دریافتی: ${totalEarned} سکه
مجموع هزینه: ${totalSpent} سکه
وضعیت VIP: ${isVip ? '✨ فعال' : '❌ غیرفعال'}

📌 راه‌های کسب سکه:
• دعوت از دوستان: +۲۰ سکه
• تکمیل پروفایل: +۳۰ سکه
• چت روزانه: +۵ سکه`,

  // Analytics
  analytics: '📈 نمودار فعالیت',
  analyticsHourly: (rows: string[], max: number) =>
    `📈 چت‌های ۲۴ ساعت گذشته (به وقت تهران)\n\n${rows.join('\n')}`,
  analyticsDaily: (rows: string[], total: number) =>
    `📅 چت‌های ۱۴ روز گذشته (مجموع: ${total})\n\n${rows.join('\n')}`,
  analyticsEmpty: '📈 هنوز چتی ثبت نشده است.',

  // Required channels
  joinRequiredChannels: (channels: string) =>
    `🔒 برای استفاده از ربات، اول عضو کانال‌های زیر شوید:\n\n${channels}\n\nبعد از عضویت دکمهٔ «✅ عضو شدم» را بزنید.`,
  membershipStillMissing: (channels: string) =>
    `❌ هنوز عضو این کانال‌ها نیستید:\n\n${channels}`,
  membershipConfirmed: '✅ عضویت شما تایید شد. حالا می‌توانید از ربات استفاده کنید.',

  // Wallet — history and packages
  transactionHistoryEmpty: '📊 هنوز تراکنشی ثبت نشده است.',
  walletHistory: (rows: string[], balance: number) =>
    `📊 آخرین تراکنش‌های شما\n\n💰 موجودی فعلی: ${balance} سکه\n\n${rows.join('\n\n')}`,
  transactionLine: (type: string, amount: number, description: string, date: string) => {
    const labels: Record<string, string> = {
      earn: '🪙 دریافت',
      spend: '💸 خرج',
      purchase: '💳 خرید',
      bonus: '🎁 پاداش',
      referral: '📨 زیرمجموعه',
      admin: '⚙️ ادمین',
    };
    const sign = amount > 0 ? '+' : '';
    return `${labels[type] || type}  ${sign}${amount} سکه\n   ${escapeHtml(description)} · ${date}`;
  },
  buyCoinsUnavailable: (rows: string[]) =>
    `💳 بسته‌های سکه\n\n${rows.join('\n')}\n\n⚠️ خرید آنلاین هنوز فعال نشده است؛ برای تهیهٔ سکه به پشتیبانی پیام دهید.`,

  // Referral
  referralInfo: (link: string, count: number) =>
    `📨 دعوت از دوستان

لینک دعوت اختصاصی شما:
${link}

✅ به ازای هر دعوت ۲۰ سکه جایزه بگیرید!
تعداد دعوت‌های موفق: ${count} نفر`,

  // Chat
  findingPartner: '🔍 در حال پیدا کردن هم‌صحبت...',
  partnerFound: (name: string, age: number, province: string) =>
    `✅ هم‌صحبت پیدا شد!
    
👤 ${name || 'ناشناس'} • ${age || '?'} ساله • ${province || 'ایران'}

💬 می‌تونید پیام خود را ارسال کنید.`,

  chatMenu: '💬 منوی چت',
  endChat: '🔚 پایان چت',
  nextChat: '⏭️ نفر بعدی',
  like: '❤️ لایک',
  report: '🚨 گزارش',
  blockUser: '🔇 بلاک',
  likedUsers: '❤️ لایک‌شده‌ها',
  likedUsersEmpty: '❤️ هنوز کسی را لایک نکرده‌اید.\nوقتی در چت کسی را لایک کنید، اینجا می‌بینیدش.',
  likedUsersTitle: (count: number) => `❤️ افرادی که لایک کرده‌اید (${count} نفر):`,
  likedUsersNote: '📌 این لیست فقط برای یادآوری است؛ برای حفظ ناشناسی، پیام فرستادن به این افراد در ربات وجود ندارد.',

  chatEnded: '🔚 چت به پایان رسید.\nاز چت کردن با شما خوشحال بودیم!',
  partnerDisconnected: '🔚 هم‌صحبت شما چت را ترک کرد.',

  // Report
  reportReason: '🚨 دلیل گزارش را انتخاب کنید:',
  harassment: '🔞 آزار و اذیت',
  spam: '📣 اسپم',
  fake: '🎭 پروفایل جعلی',
  inappropriate: '🚫 محتوای نامناسب',
  other: '📝 سایر',
  reportReceived: '✅ گزارش شما ثبت شد. با متخلفین برخورد خواهد شد.',

  // Block
  blocked: '🔇 کاربر مورد نظر مسدود شد.',
  unblocked: '✅ کاربر از لیست مسدود خارج شد.',

  // Support
  supportMenu: `❓ راهنما و پشتیبانی

🤔 سوالات متداول:

❓ چطور چت کنم؟
از منوی اصلی گزینه "شروع چت" را انتخاب کنید تا با یک کاربر تصادفی آشنا شوید.

❓ چطور سکه بگیرم؟
• دعوت از دوستان: +۲۰ سکه
• تکمیل پروفایل: +۳۰ سکه
• چت روزانه: +۵ سکه

❓ قوانین:
• ارسال پیام‌های نامناسب ممنوع
• ایجاد مزاحمت ممنوع
• در صورت تخلف حساب شما مسدود خواهد شد

❓ چطور پیشرفته جستجو کنم؟
با استفاده از سکه می‌توانید بر اساس جنسیت، سن و استان جستجو کنید.

❓ چطور پشتیبانی بگیرم؟
برای ارتباط با پشتیبانی به آیدی @llllxyz پیام دهید.\n\n💎 ساخته شده با ❤️ توسط <a href=\"tg://resolve?domain=llllxyz\">Mohammad</a>`,

  // Admin
  adminMenu: '⚙️ پنل مدیریت',
  stats: '📊 آمار',
  broadcast: '📣 پیام همگانی',
  targetedBroadcast: '🎯 ارسال هدفمند',
  manageCoins: '💰 مدیریت سکه',
  reports: '🚨 گزارشات',
  settings: '⚙️ تنظیمات',
  campaigns: '📢 کمپین‌ها',
  logout: '🚪 خروج',

  statsText: (s: any) =>
    `📊 آمار ربات

👥 کل کاربران: ${s.total}
🟢 آنلاین: ${s.online}
💬 در حال چت: ${s.chatting}
⏳ در صف: ${s.waiting}
🔇 مسدود شده: ${s.banned}
📅 امروز: ${s.today} نفر جدید

👫 جنسیت:
👨 پسر: ${s.byGender.male}
👩 دختر: ${s.byGender.female}
❓ نامشخص: ${s.byGender.unknown}

📍 استان‌های برتر:
${Object.entries(s.byProvince).slice(0, 5).map(([p, c]) => `  • ${escapeHtml(String(p))}: ${c} نفر`).join('\n')}`,

  noChatPartner: '😔 هم‌صحبتی یافت نشد. لطفاً بعداً تلاش کنید.',
  profileIncomplete: '⚠️ لطفاً ابتدا پروفایل خود را تکمیل کنید.',
  notEnoughCoins: (cost: number) => `⚠️ سکه کافی ندارید! نیاز به ${cost} سکه دارید.`,

  // Inline keyboard labels
  confirm: '✅ تایید',
  cancel: '❌ لغو',
  back: '🔙 بازگشت',
  skip: '⏭️ رد کردن',
};
