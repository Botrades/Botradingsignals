# 📊 Botradesignals — Discord Bot (Free Version)

AI-powered chart analysis Discord bot using **Google Gemini (100% free)**.
Members upload chart screenshots in Discord and get instant signal embeds.

---

## ⚡ Setup Guide

### Step 1 — Get your FREE Gemini API Key

1. Go to **https://aistudio.google.com**
2. Sign in with a Google account
3. Click **"Get API Key"** → **"Create API Key"**
4. Copy the key — this is completely free with generous limits

### Step 2 — Create your Discord Bot

1. Go to **https://discord.com/developers/applications**
2. Click **New Application** → name it `Botradesignals`
3. Go to **Bot** tab → click **Reset Token** → copy your token
4. Scroll down to **Privileged Gateway Intents** → turn on **Message Content Intent**
5. Go to **OAuth2 → URL Generator**:
   - Scopes: ✅ `bot`
   - Permissions: ✅ Send Messages, Read Messages, Embed Links, Add Reactions
6. Copy the URL → open it → invite bot to your server

### Step 3 — Deploy FREE on Railway

1. Go to **https://railway.app** → sign up free
2. New Project → Deploy from GitHub (upload this folder first to GitHub)
3. Add these environment variables:
   ```
   DISCORD_TOKEN=your_discord_bot_token
   GEMINI_API_KEY=your_gemini_api_key
   PREMIUM_ROLE=Premium Member
   ALLOWED_CHANNELS=your_channel_id
   ```
4. Railway runs it automatically — your bot stays online 24/7

---

## 💬 How Members Use It

In your premium signals channel, members type the pair + timeframe and attach a chart screenshot:

> `XAUUSD H1` + 📎 chart screenshot

The bot will:
- React 🔍 while analysing
- Post a full embed with Entry, Stop Loss, Take Profit, R:R, and AI analysis
- React ✅ when done

---

## 🔒 Locking to Premium Members

Set `PREMIUM_ROLE=Premium Member` in Railway env vars.

Use **Whop.com** to take payments and auto-assign the Discord role.

---

## ⌨️ Commands

| Input | Result |
|-------|--------|
| Image + `XAUUSD H1` | Full signal embed |
| `!help` | How to use |
| `!ping` | Check bot is alive |

---

## 💰 Cost

- **Gemini API** — Free (generous daily limits, no card needed)
- **Railway** — Free tier available (500 hours/month free)
- **Discord bot** — Free

Total cost: **$0**
