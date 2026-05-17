const { Client, GatewayIntentBits, EmbedBuilder, ActivityType } = require("discord.js");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require("axios");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// ── Config ──────────────────────────────────────────────────────────────────
const CONFIG = {
  // Comma-separated channel IDs where bot responds (blank = all channels)
  ALLOWED_CHANNELS: process.env.ALLOWED_CHANNELS
    ? process.env.ALLOWED_CHANNELS.split(",").map((c) => c.trim())
    : [],
  // Role name required to use the bot (blank = everyone)
  PREMIUM_ROLE: process.env.PREMIUM_ROLE || "",
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function hasPermission(message) {
  if (
    CONFIG.ALLOWED_CHANNELS.length > 0 &&
    !CONFIG.ALLOWED_CHANNELS.includes(message.channel.id)
  ) return false;

  if (CONFIG.PREMIUM_ROLE) {
    const hasRole = message.member?.roles.cache.some(
      (r) => r.name === CONFIG.PREMIUM_ROLE
    );
    if (!hasRole) return false;
  }
  return true;
}

async function downloadImageAsBase64(url) {
  const response = await axios.get(url, { responseType: "arraybuffer" });
  const base64 = Buffer.from(response.data).toString("base64");
  const mimeType = response.headers["content-type"] || "image/png";
  return { base64, mimeType };
}

async function analyseChart(base64Image, mimeType, pair, tf) {
  const prompt = `You are an elite professional trading analyst specialising in technical analysis.
Analyse this ${pair} ${tf} chart screenshot carefully.
Look at the price action, trends, support/resistance levels, any indicators visible, candlestick patterns, and momentum.
Base ALL price levels on the actual numbers you can see on the chart axes.

Respond with ONLY a valid JSON object, no markdown, no backticks, no explanation:
{
  "pair": "${pair}",
  "tf": "${tf}",
  "direction": "BUY or SELL",
  "entry": "exact price from chart",
  "sl": "stop loss price",
  "tp": "take profit price",
  "rr": "risk reward e.g. 1:2.5",
  "trend": "BULLISH or BEARISH or RANGING",
  "bias": "one sentence on market bias",
  "setup": "the pattern or setup you see e.g. Order Block, FVG, Engulfing, Support Bounce",
  "keyLevels": "key support and resistance levels you identified from the chart",
  "analysis": "3-4 sentence detailed technical analysis of what you see on this specific chart"
}`;

  const result = await model.generateContent([
    { text: prompt },
    { inlineData: { data: base64Image, mimeType } },
  ]);

  const text = result.response.text().trim();

  // Strip any accidental markdown fences
  const clean = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const match = clean.match(/\{[\s\S]+\}/);
  if (!match) throw new Error("No JSON in response");

  const parsed = JSON.parse(match[0]);
  if (!parsed.direction || !parsed.entry) throw new Error("Incomplete signal");
  return parsed;
}

function buildSignalEmbed(sig, username, avatarURL) {
  const isBuy = sig.direction === "BUY";
  const colour = isBuy ? 0x16a34a : 0xdc2626;
  const trendEmoji =
    sig.trend === "BULLISH" ? "📈" : sig.trend === "BEARISH" ? "📉" : "↔️";

  return new EmbedBuilder()
    .setColor(colour)
    .setTitle(`${isBuy ? "🟢" : "🔴"}  ${sig.pair}  —  ${sig.direction}  SIGNAL`)
    .setDescription(`**Timeframe:** ${sig.tf}  •  **Trend:** ${trendEmoji} ${sig.trend}`)
    .addFields(
      { name: "📍 Entry",         value: `\`${sig.entry}\``, inline: true },
      { name: "🛡 Stop Loss",     value: `\`${sig.sl}\``,    inline: true },
      { name: "🎯 Take Profit",   value: `\`${sig.tp}\``,    inline: true },
      { name: "⚖️ Risk/Reward",   value: `\`${sig.rr}\``,   inline: true },
      { name: "💡 Setup",         value: sig.setup,          inline: true },
      { name: "📐 Bias",          value: sig.bias,           inline: false },
      { name: "🔑 Key Levels",    value: sig.keyLevels,      inline: false },
      { name: "🤖 AI Analysis",   value: sig.analysis,       inline: false },
      {
        name: "⚠️ Risk Warning",
        value: "*Educational only. Always use proper risk management. Max 1-2% per trade.*",
        inline: false,
      }
    )
    .setFooter({
      text: `Botradesignals • Chart by ${username}`,
      iconURL: avatarURL,
    })
    .setTimestamp();
}

function buildErrorEmbed(msg) {
  return new EmbedBuilder()
    .setColor(0x7f1d1d)
    .setTitle("⚠️ Analysis Failed")
    .setDescription(msg)
    .setFooter({ text: "Botradesignals" })
    .setTimestamp();
}

function buildHelpEmbed() {
  return new EmbedBuilder()
    .setColor(0xfacc15)
    .setTitle("📊 Botradesignals — How To Use")
    .setDescription("Upload a chart screenshot with the pair and timeframe in your message. The AI will analyse it and post a full signal.")
    .addFields(
      {
        name: "📸 Example",
        value: "Type `XAUUSD H1` and attach your TradingView/MT4/MT5 screenshot.\n\nOther examples:\n`EURUSD M15` + screenshot\n`BTCUSD D1` + screenshot\n`GBPUSD H4` + screenshot",
      },
      {
        name: "⌨️ Commands",
        value: "`!help` — show this message\n`!ping` — check if bot is online",
      },
      {
        name: "⚠️ Disclaimer",
        value: "For educational purposes only. Always use proper risk management.",
      }
    )
    .setFooter({ text: "Botradesignals • Powered by Google Gemini (Free)" })
    .setTimestamp();
}

// ── Bot Events ───────────────────────────────────────────────────────────────

client.once("ready", () => {
  console.log(`✅ Botradesignals online — ${client.user.tag}`);
  client.user.setActivity("charts 📊", { type: ActivityType.Watching });
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  const content = message.content.trim();

  // Commands
  if (content === "!ping") return message.reply("🟢 Online! Upload a chart to get a signal.");
  if (content === "!help" || content === "!signal") return message.reply({ embeds: [buildHelpEmbed()] });

  // Only process messages with image attachments
  const attachments = [...message.attachments.values()];
  const imageAttachment = attachments.find((a) => a.contentType?.startsWith("image/"));
  if (!imageAttachment) return;

  // Check permissions
  if (!hasPermission(message)) {
    if (CONFIG.PREMIUM_ROLE) {
      return message.reply({
        embeds: [buildErrorEmbed(`🔒 You need the **${CONFIG.PREMIUM_ROLE}** role to use Botradesignals.`)],
      });
    }
    return;
  }

  // Parse pair and timeframe from the message text
  const upper = content.toUpperCase();
  const pairMatch = upper.match(/\b(XAUUSD|EURUSD|GBPUSD|USDJPY|BTCUSD|ETHUSD|USOIL|US30|NAS100|[A-Z]{6})\b/);
  const tfMatch   = upper.match(/\b(M1|M5|M15|M30|H1|H2|H4|H8|D1|W1)\b/);

  const pair = pairMatch ? pairMatch[0] : "UNKNOWN";
  const tf   = tfMatch   ? tfMatch[0]   : "UNKNOWN";

  await message.channel.sendTyping();
  await message.react("🔍").catch(() => {});

  try {
    const { base64, mimeType } = await downloadImageAsBase64(imageAttachment.url);
    const signal = await analyseChart(base64, mimeType, pair, tf);

    await message.reply({ embeds: [buildSignalEmbed(signal, message.author.username, message.author.displayAvatarURL())] });
    await message.reactions.cache.get("🔍")?.remove().catch(() => {});
    await message.react("✅").catch(() => {});
  } catch (err) {
    console.error("Error:", err.message);

    let userMsg = "Analysis failed. Please try again with a clearer chart screenshot.";
    if (err.message.includes("No JSON") || err.message.includes("Incomplete")) {
      userMsg = "Could not read the chart. Make sure the screenshot shows a clear price chart with visible price levels on the axes.";
    } else if (err.message.includes("API_KEY") || err.message.includes("401")) {
      userMsg = "API key error — please contact the server admin.";
    } else if (err.message.includes("quota") || err.message.includes("429")) {
      userMsg = "Rate limit hit. Please wait a moment and try again.";
    }

    await message.reply({ embeds: [buildErrorEmbed(userMsg)] });
    await message.reactions.cache.get("🔍")?.remove().catch(() => {});
    await message.react("❌").catch(() => {});
  }
});

client.login(process.env.DISCORD_TOKEN);
