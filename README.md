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
| 🎲 **Random Chat** | Connect with random陌生人 anonymously |
| 🔍 **Advanced Search** | Filter by gender, age, province (costs coins) |
| 📡 **Radar** | Find nearby users in your province |
| 👤 **Profile System** | Name, gender, age, province, city |
| 💰 **Coin Economy** | Earn, spend, and purchase coins |
| 📨 **Referral System** | Invite friends and earn bonuses |
| ❤️ **Like System** | Like chat partners |
| 🔇 **Block & Report** | Report inappropriate users |
| 📝 **Direct Messages** | Message past chat partners |
| 🗑️ **Delete Messages** | Delete messages for both sides |

### ⚙️ Admin Panel
| Feature | Description |
|---------|-------------|
| 📊 **Real-time Stats** | Total users, online, chatting, waiting, banned |
| 📣 **Broadcast** | Send messages to all or targeted users |
| 💰 **Coin Management** | Adjust user coins manually |
| 🚨 **Report System** | Handle user reports |
| 📢 **Campaigns** | Create targeted ad campaigns |
| 📈 **Analytics** | Hourly/daily activity charts |
| 🗺️ **User Map** | Province distribution |
| ⚡ **Smart Alerts** | Auto-notify admins of anomalies |
| 🔒 **Required Channels** | Force users to join channels |
| 📝 **Text Management** | Edit bot messages |

---

## 🛠️ Tech Stack

| Technology | Purpose |
|-----------|---------|
| **Node.js** | Runtime |
| **TypeScript** | Type safety |
| **grammY** | Telegram Bot Framework |
| **MongoDB** | Database |
| **Mongoose** | MongoDB ODM |
| **Redis** | Caching (optional) |

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
| `📢 کمپین‌ها` | Manage campaigns |
| `⚙️ تنظیمات` | Bot settings |

---

## 📄 License

**MIT** — Free for learning and production use.

---

<p align="center">
  <sub>Built with ❤️ by <a href="https://github.com/mmdverse">Mohammad</a></sub>
</p>
<p align="center">ساخته شده با ❤️ توسط <a href="https://github.com/mmdverse">Mohammad</a> | <a href="https://t.me/llllxyz">📱 تلگرام</a></p>