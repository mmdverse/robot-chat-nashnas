# Persian Anonymous Chat Bot 🤖

> **Telegram anonymous chat bot** built with **Node.js**, **TypeScript**, **MongoDB**, and **grammY**. Features random matching, profile system, coin economy, admin panel, and advanced analytics.

[![Node.js](https://img.shields.io/badge/Node.js-20-339933?logo=nodedotjs)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-3178C6?logo=typescript)](https://typescriptlang.org)
[![MongoDB](https://img.shields.io/badge/MongoDB-7-47A248?logo=mongodb)](https://mongodb.com)
[![Telegram](https://img.shields.io/badge/Telegram-Bot-2CA5E0?logo=telegram)](https://core.telegram.org/bots)

---

## ✨ Features

### 👤 User Features
| Feature | Description |
|---------|-------------|
| 🎲 **Random Chat** | Connect with random strangers anonymously |
| 🔍 **Advanced Search** | Filter by gender, age, province (costs coins) |
| 📡 **Radar** | Find nearby users in your province |
| 👤 **Profile System** | Name, gender, age, province, city |
| 💰 **Coin Economy** | Earn coins from the daily chat bonus, profile completion and referrals |
| 📨 **Referral System** | Invite friends and earn bonuses |
| ❤️ **Like System** | Like chat partners |
| 🔇 **Block & Report** | Block a user, or report them for harassment, spam, a fake profile or inappropriate content |
| 👥 **Liked Users** | Review the profiles you liked during chats |

### ⚙️ Admin Panel
| Feature | Description |
|---------|-------------|
| 📊 **Stats** | Users, online, chatting, waiting, banned, by gender and top provinces |
| 📣 **Broadcast** | Send a message to every active user |
| 🎯 **Targeted Broadcast** | Filter recipients by gender, age, province or coin balance |
| 💰 **Coin Management** | Adjust user coins manually |
| 🚨 **Report System** | List open reports and resolve them with `/resolve` |
| 📢 **Campaigns** | List campaigns with their send, view and entry counts |
| 🚫 **Ban / Unban** | Ban or unban a user with `/ban` and `/unban` |
| ⚙️ **Settings** | Overview of the bot settings |

### 🚧 Not implemented yet

Listed here so nobody plans around them — these are read from config or mentioned
in older docs, but no code path uses them:

- **Buying coins** — the packages and prices exist, but there is no payment
  integration, so the buy button only lists them.
- **Direct messages to past partners** — you cannot message someone after a chat
  ends; the button shows your liked users instead.
- **Required channels** — `REQUIRED_CHANNELS` is read from the environment but no
  join-check middleware runs.
- **Analytics charts** — the hourly and daily aggregation helpers exist but
  nothing calls them; statistics are shown as text.
- **Redis** — `ioredis` is installed and `REDIS_URL` is read, but nothing imports
  it. MongoDB is the only store in use.

---

## 🛠️ Tech Stack

| Technology | Purpose |
|-----------|---------|
| **Node.js** | Runtime |
| **TypeScript** | Type safety |
| **grammY** | Telegram Bot Framework |
| **MongoDB** | Database |
| **Mongoose** | MongoDB ODM |

---

## 🚀 Quick Start

```bash
# Clone
git clone https://github.com/mmdverse/robot-chat-nashnas.git
cd persian-anonymous-chat-bot

# Install
npm install

# Configure
cp .env.example .env
# Edit .env with your credentials

# Run
npm run dev
```

---

## 📁 Project Structure

```
src/
├── bot/
│   ├── handlers/      # Bot command handlers
│   │   ├── start.ts   # Start & referral
│   │   ├── profile.ts # Profile management
│   │   ├── chat.ts    # Chat logic & matching
│   │   └── admin.ts   # Admin panel
│   ├── utils/
│   │   ├── i18n.ts    # Persian translations
│   │   └── keyboards.ts # Inline & reply keyboards
│   └── bot.ts         # Bot engine & middlewares
├── database/
│   ├── models/        # Mongoose schemas
│   ├── services/      # Business logic layer
│   └── connection.ts  # MongoDB connection
├── config/            # App configuration
├── types/             # TypeScript types
└── index.ts           # Entry point
```

---

## 📋 Bot Commands

### User Commands
| Command | Description |
|---------|-------------|
| `/start` | Start the bot |
| `🎲 شروع چت تصادفی` | Start random chat |
| `🔍 جستجوی پیشرفته` | Advanced search |
| `📡 رادار افراد نزدیک` | Find nearby users |
| `👤 پروفایل من` | View/edit profile |
| `💰 کیف پول` | Check wallet |
| `📨 دعوت از دوستان` | Get referral link |
| `❓ راهنما` | Help & support |

### Admin Commands
| Command | Description |
|---------|-------------|
| `📊 آمار` | View statistics |
| `📣 پیام همگانی` | Broadcast message |
| `🎯 ارسال هدفمند` | Targeted broadcast |
| `💰 مدیریت سکه` | Manage coins |
| `🚨 گزارشات` | View reports |
| `📢 کمپین‌ها` | List campaigns |
| `⚙️ تنظیمات` | Bot settings |
| `/ban` · `/unban` | Ban or unban a user by id |
| `/resolve <id>` | Close a report |

---

## 📄 License

**MIT** — Free for learning and production use.

---

<p align="center">
  <sub>Built with ❤️ by <a href="https://github.com/mmdverse">Mohammad</a></sub>
</p>
<p align="center">ساخته شده با ❤️ توسط <a href="https://github.com/mmdverse">Mohammad</a> | <a href="https://t.me/llllxyz">📱 تلگرام</a></p>