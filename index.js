import "dotenv/config";
import fs from "fs";
import { Client, GatewayIntentBits } from "discord.js";
import TelegramBot from "node-telegram-bot-api";
import express from "express";

// ==================== Storage ====================
const USER_MAP_FILE = "./userMap.json";
let userMap = loadUserMap();

// тимчасові коди для привʼязки
const pendingLinks = new Map(); // code -> discordUserId

function loadUserMap() {
  try {
    if (!fs.existsSync(USER_MAP_FILE)) return {};
    const data = fs.readFileSync(USER_MAP_FILE, "utf8");
    if (!data.trim()) return {};
    return JSON.parse(data);
  } catch (err) {
    console.error("❌ userMap.json corrupted, resetting", err);
    return {};
  }
}

function saveUserMap() {
  fs.writeFileSync(USER_MAP_FILE, JSON.stringify(userMap, null, 2));
}

// ==================== Helpers ====================
function getDiscordDisplayName(message) {
  return (
    message.member?.displayName ||
    message.author.globalName ||
    message.author.username
  );
}

function formatDiscordMessage(message) {
  let text = message.content;

  // Users
  message.mentions.users.forEach((user) => {
    const entry = userMap[user.id];
    const name =
      entry?.telegramUsername ||
      message.guild?.members.cache.get(user.id)?.displayName ||
      user.username;

    text = text.replace(
      new RegExp(`<@!?${user.id}>`, "g"),
      name.startsWith("@") ? name : `@${name}`
    );
  });

  // Roles
  message.mentions.roles.forEach((role) => {
    text = text.replace(new RegExp(`<@&${role.id}>`, "g"), `@${role.name}`);
  });

  return text;
}

// ==================== Discord ====================
const discordClient = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

discordClient.once("clientReady", () => {
  console.log(`🤖 Discord logged in as ${discordClient.user.tag}`);
});

// ==================== Telegram ====================
const telegramBot = new TelegramBot(process.env.TELEGRAM_TOKEN, {
  polling: true,
});

// Handle polling errors to prevent crash loops and handle multiple instances during deployment
telegramBot.on("polling_error", (error) => {
  if (error.code === "ETELEGRAM" && error.message.includes("409 Conflict")) {
    // This happens during deployment when the new instance starts before the old one stops
    return;
  }
  console.error("❌ Telegram polling error:", error);
});

// Розбираємо chat_id і thread_id з env
let chatId = null;
let threadId = null;

if (process.env.TELEGRAM_CHAT_ID.includes("/")) {
  const [chatStr, threadStr] = process.env.TELEGRAM_CHAT_ID.split("/");
  chatId = parseInt(chatStr, 10);
  threadId = parseInt(threadStr, 10);
} else {
  chatId = parseInt(process.env.TELEGRAM_CHAT_ID, 10);
  threadId = undefined;
}

// ==================== Telegram commands ====================
telegramBot.on("message", (msg) => {
  if (!msg.text) return;

  // ===== /link <code> =====
  if (msg.text.startsWith("/link")) {
    const [, code] = msg.text.split(" ");
    const discordId = pendingLinks.get(code);

    if (!discordId) {
      telegramBot.sendMessage(
        msg.chat.id,
        "❌ Код недійсний або протермінований"
      );
      return;
    }

    userMap[discordId] = {
      discordId,
      telegramId: msg.from.id,
      telegramUsername: msg.from.username ? `@${msg.from.username}` : null,
      telegramFirstName: msg.from.first_name,
    };

    saveUserMap();
    pendingLinks.delete(code);

    telegramBot.sendMessage(msg.chat.id, "✅ Акаунти успішно привʼязані");
    return;
  }

  // ===== /unlink =====
  if (msg.text === "/unlink") {
    const entry = Object.entries(userMap).find(
      ([, value]) => value.telegramId === msg.from.id
    );

    if (!entry) {
      telegramBot.sendMessage(msg.chat.id, "ℹ️ Привʼязки не знайдено");
      return;
    }

    delete userMap[entry[0]];
    saveUserMap();

    telegramBot.sendMessage(msg.chat.id, "🗑 Привʼязку видалено");
  }
});

// ==================== Discord messages ====================
discordClient.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  // ===== !link =====
  if (message.content === "!link") {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    pendingLinks.set(code, message.author.id);
    setTimeout(() => pendingLinks.delete(code), 5 * 60 * 1000);

    try {
      await message.author.send(
        `🔐 Твій код привʼязки: **${code}**\n\n` +
          `Надішли його боту в Telegram:\n/link ${code}\n\n` +
          `⏳ Код дійсний 5 хвилин`
      );

      await message.reply("📩 Я надіслав тобі код у приватні повідомлення");
    } catch (err) {
      await message.reply(
        "❌ Не можу надіслати DM. Увімкни приватні повідомлення від учасників сервера."
      );
    }
    return;
  }

  // ===== !unlink =====
  if (message.content === "!unlink") {
    if (!userMap[message.author.id]) {
      message.reply("ℹ️ У тебе немає привʼязки");
      return;
    }

    delete userMap[message.author.id];
    saveUserMap();

    message.reply("🗑 Привʼязку видалено");
    return;
  }

  // тільки повідомлення з тегами
  if (
    message.mentions.users.size === 0 &&
    message.mentions.roles.size === 0 &&
    !message.mentions.everyone
  ) {
    return;
  }

  const displayName = getDiscordDisplayName(message);

  try {
    const formatted = formatDiscordMessage(message);
    const hasAttachments = message.attachments.size > 0;

    // Якщо є текст, надсилаємо його
    // Якщо є і текст, і медіа - текст піде першим окремим повідомленням (як зараз)
    // АБО ми можемо додати текст як caption до першого медіа.
    // Для простоти зараз просто виправимо дублювання, якщо текст порожній.
    if (message.content.trim()) {
      await telegramBot.sendMessage(chatId, `👤 ${displayName}\n${formatted}`, {
        message_thread_id: threadId,
      });
    }

    let firstMedia = true;
    for (const attachment of message.attachments.values()) {
      const type = attachment.contentType || "";
      const url = attachment.url;
      // Якщо тексту в повідомленні не було, додамо ім'я автора до першого медіа
      const caption =
        !message.content.trim() && firstMedia ? `👤 ${displayName}` : "";
      firstMedia = false;

      if (type.startsWith("image/") && type !== "image/gif") {
        await telegramBot.sendPhoto(chatId, url, {
          caption: caption,
          message_thread_id: threadId,
        });
        continue;
      }

      if (type === "image/gif" || attachment.name?.endsWith(".gif")) {
        await telegramBot.sendAnimation(chatId, url, {
          caption: caption,
          message_thread_id: threadId,
        });
        continue;
      }

      if (type.startsWith("video/")) {
        await telegramBot.sendVideo(chatId, url, {
          caption: caption,
          message_thread_id: threadId,
        });
        continue;
      }

      await telegramBot.sendDocument(chatId, url, {
        caption: caption,
        message_thread_id: threadId,
      });
    }
  } catch (err) {
    console.error("Telegram error:", err);
  }
});

// ==================== Login ====================
discordClient.login(process.env.DISCORD_TOKEN);

const app = express();
const PORT = process.env.PORT || 5000;
app.get("/", (req, res) => res.send("Bot is alive!"));

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🌐 Express server running on port ${PORT}`);
});
