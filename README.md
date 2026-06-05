# 🎙️ Discord Temporary Channels Bot

A **professional, fully-featured Join To Create (JTC) bot** for Discord.  
When a user joins the designated voice channel, they get their own private temporary channel with a complete management panel.

---

## ✨ Features

### 🎙️ Join To Create System
- Auto-create temp channels when users join the JTC channel
- **Auto-name** channels based on the owner's game activity
- **Cooldown** system to prevent spam channel creation
- **Max channels** limit per server (configurable)
- **Blacklist** support — blocked users are disconnected immediately
- Auto-delete channels when they become empty
- Auto-transfer ownership when the owner leaves

### 🎛️ Interactive Control Panel (Buttons)
| Button | Function |
|--------|----------|
| 🔒 Lock / 🔓 Unlock | Toggle @everyone connect permission |
| 🌑 Hide / 👁️ Show | Toggle channel visibility |
| ✏️ Rename | Rename your channel (modal) |
| 👥 Limit | Set member cap 0–99 (modal) |
| 🎵 Bitrate | Adjust audio quality (modal) |
| ✅ Permit | Allow a specific user to join |
| ⛔ Reject | Kick and ban a specific user |
| 👢 Kick | Remove a user from the channel |
| 👑 Transfer | Hand ownership to another member |
| 🏳️ Claim | Take ownership if owner left |
| 🔗 Invite Link | Generate a 1-hour invite (max 10 uses) |
| 🧹 Clear Perms | Reset all permission overrides |
| ℹ️ Info | View full channel details |
| 🗑️ Delete | Delete the channel immediately |

### ⚙️ User Preferences
- `/vc setname` — Set your personal default channel name
- `/vc setlimit` — Set your personal default user limit
- `/vc setbitrate` — Set your personal default bitrate
- `/vc preferences` — View your saved settings
- `/vc reset` — Reset all preferences

### 🛡️ Admin Controls
- `/admin channels` — List all active temp channels with details
- `/admin delete` — Force-delete any temp channel
- `/admin transfer` — Force-transfer ownership
- `/admin info` — View details of any temp channel
- `/admin clearall` — Emergency reset (delete all temp channels)
- `/blacklist add/remove/list` — Block/unblock users

### 📊 Stats & Logging
- `/stats` — Total created, deleted, peak concurrent, blacklisted users, config
- **Log Channel** — Automatic logs for: create, delete, lock, unlock, hide, show, rename, permit, reject, kick, transfer, claim
- Ghost Mode — Auto-hide channels when locked

### 🔧 Advanced Server Config (`/setup config`)
| Option | Description |
|--------|-------------|
| `log_channel` | Channel to send activity logs |
| `ghost_mode` | Auto-hide when locked |
| `auto_name` | Name channels from game activity |
| `cooldown` | Seconds between channel creations |
| `default_limit` | Default user limit for new channels |
| `default_bitrate` | Default bitrate for new channels |
| `max_channels` | Max simultaneous channels |

---

## 🚀 Setup Guide

### Step 1 — Create Discord Bot

1. Go to [discord.com/developers/applications](https://discord.com/developers/applications)
2. Click **New Application** → give it a name
3. **Bot** tab → **Add Bot** → **Reset Token** → copy your token
4. Enable **Privileged Gateway Intents**:
   - ✅ Server Members Intent
   - ✅ Presence Intent (for game auto-name feature)
5. **OAuth2 → URL Generator**:
   - Scopes: `bot`, `applications.commands`
   - Bot Permissions: `Administrator`
6. Open the generated URL and invite the bot

### Step 2 — Configure Environment

```bash
cp .env.example .env
# Edit .env with your token and client ID
```

```env
DISCORD_TOKEN=your_bot_token_here
CLIENT_ID=your_application_client_id_here
```

### Step 3 — Install & Register Commands

```bash
npm install
npm run deploy
```

### Step 4 — Run

```bash
npm start          # production
npm run dev        # development with auto-restart
```

### Step 5 — Configure Server

In Discord, run:
```
/setup create
```
This auto-creates:
- 📁 **Temporary Channels** category
- 🎙️ **➕ Join To Create** voice channel
- 🎛️ **🎛️-channel-controls** text channel
- 📋 **📋-vc-logs** log channel (hidden from users)

---

## ☁️ Deploy on Railway

### Option A — GitHub (Recommended)

1. Push this folder to a GitHub repo
2. Go to [railway.app](https://railway.app) → **New Project → Deploy from GitHub**
3. Select your repo
4. Add environment variables in Railway dashboard:
   ```
   DISCORD_TOKEN = your_token
   CLIENT_ID = your_client_id
   ```
5. Railway auto-detects `railway.json` — bot starts automatically ✅

### Option B — Railway CLI

```bash
npm install -g @railway/cli
railway login
railway init
railway up
railway variables set DISCORD_TOKEN=your_token
railway variables set CLIENT_ID=your_client_id
```

> **Note on data persistence:** Settings are stored in `./data/bot.db.json`. On Railway the filesystem resets on redeploy. To make data permanent, add a Railway volume (persistent disk) mounted at `/app/data`.

---

## 📋 All Commands

| Command | Description | Permission |
|---------|-------------|------------|
| `/setup create` | Auto-create all required channels | Manage Server |
| `/setup manual` | Link existing channels | Manage Server |
| `/setup config` | Configure advanced settings | Manage Server |
| `/setup info` | View current config | Manage Server |
| `/setup reset` | Reset all config | Manage Server |
| `/panel` | Resend your control panel | Everyone |
| `/vc setname` | Set default channel name | Everyone |
| `/vc setlimit` | Set default user limit | Everyone |
| `/vc setbitrate` | Set default bitrate | Everyone |
| `/vc preferences` | View your preferences | Everyone |
| `/vc reset` | Reset preferences | Everyone |
| `/admin channels` | List all active channels | Manage Server |
| `/admin delete` | Force-delete a channel | Manage Server |
| `/admin transfer` | Force-transfer ownership | Manage Server |
| `/admin info` | View channel details | Manage Server |
| `/admin clearall` | Delete all temp channels | Manage Server |
| `/blacklist add` | Blacklist a user | Manage Server |
| `/blacklist remove` | Remove from blacklist | Manage Server |
| `/blacklist list` | View blacklist | Manage Server |
| `/stats` | Server statistics | Everyone |
| `/help` | Show this help | Everyone |

---

## 📁 Project Structure

```
discord-bot/
├── src/
│   ├── index.ts                  # Bot entry point
│   ├── deploy-commands.ts        # Register slash commands
│   ├── database/
│   │   └── index.ts              # JSON database (guild settings, channels, prefs, blacklist, cooldowns, stats)
│   ├── commands/
│   │   ├── index.ts              # Command loader
│   │   ├── setup.ts              # /setup (create, manual, config, info, reset)
│   │   ├── panel.ts              # /panel
│   │   ├── vc.ts                 # /vc (setname, setlimit, setbitrate, preferences, reset)
│   │   ├── admin.ts              # /admin (channels, delete, transfer, info, clearall)
│   │   ├── blacklist.ts          # /blacklist (add, remove, list)
│   │   ├── stats.ts              # /stats
│   │   └── help.ts               # /help
│   ├── events/
│   │   ├── ready.ts              # Bot ready
│   │   ├── voiceStateUpdate.ts   # JTC + cooldown + blacklist + auto-name + logging
│   │   └── interactionCreate.ts  # Buttons, modals, commands
│   ├── handlers/
│   │   ├── buttons.ts            # All 14 button handlers
│   │   └── modals.ts             # Modal submissions (rename, limit, bitrate, permit, reject, kick, transfer)
│   └── utils/
│       ├── panel.ts              # Embed & button builders
│       ├── channel.ts            # Discord voice channel helpers
│       ├── logger.ts             # Log channel system
│       └── cooldown.ts           # Cooldown management
├── data/                         # JSON database (auto-created)
├── .env.example                  # Environment template
├── railway.json                  # Railway deployment config
├── Procfile                      # Alternative process file
├── package.json
└── tsconfig.json
```

---

## 🔐 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DISCORD_TOKEN` | ✅ | Bot token from Discord Developer Portal |
| `CLIENT_ID` | ✅ | Application client ID |
| `GUILD_ID` | ❌ | Set for instant guild-only commands (testing) |
| `DATABASE_PATH` | ❌ | Custom DB path (default: `./data/bot.db.json`) |
