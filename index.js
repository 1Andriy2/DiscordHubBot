import "dotenv/config";
import express from "express";
import { createDiscordClient } from "./handlers/discordHandler.js";
import { createTelegramBot } from "./handlers/telegramHandler.js";

// ==================== Configuration ====================
// Тимчасові коди для привʼязки
const pendingLinks = new Map(); // code -> discordUserId

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

// ==================== Initialize Bots ====================
const telegramBot = createTelegramBot(pendingLinks);
const discordClient = createDiscordClient(
  telegramBot,
  chatId,
  threadId,
  pendingLinks
);

// ==================== Login ====================
discordClient.login(process.env.DISCORD_TOKEN);

// ==================== Express Server ====================
const app = express();
const PORT = process.env.PORT || 5000;
app.get("/", (req, res) => res.send("Bot is alive!"));

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🌐 Express server running on port ${PORT}`);
});
