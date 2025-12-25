import { Client, GatewayIntentBits } from "discord.js";
import {
  getUserByDiscordId,
  deleteUserByDiscordId,
} from "../services/userService.js";
import {
  getDiscordDisplayName,
  formatDiscordMessage,
} from "../utils/formatters.js";

/**
 * Ініціалізація та налаштування Discord бота
 */
export function createDiscordClient(
  telegramBot,
  chatId,
  threadId,
  pendingLinks
) {
  const discordClient = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  discordClient.once("ready", () => {
    console.log(`🤖 Discord logged in as ${discordClient.user.tag}`);
  });

  discordClient.on("messageCreate", async (message) => {
    if (message.author.bot) return;

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

    if (message.content === "!unlink") {
      const user = await getUserByDiscordId(message.author.id);
      if (!user || !user.telegramId) {
        message.reply("ℹ️ У тебе немає привʼязки");
        return;
      }

      const deleted = await deleteUserByDiscordId(message.author.id);
      if (deleted) {
        message.reply("🗑 Привʼязку видалено");
      } else {
        message.reply("❌ Помилка при видаленні привʼязки");
      }
      return;
    }

    if (
      message.mentions.users.size === 0 &&
      message.mentions.roles.size === 0 &&
      !message.mentions.everyone
    ) {
      return;
    }

    const displayName = getDiscordDisplayName(message);

    try {
      const formatted = await formatDiscordMessage(message, getUserByDiscordId);
      const hasAttachments = message.attachments.size > 0;

      if (message.content.trim()) {
        await telegramBot.sendMessage(
          chatId,
          `👤 ${displayName}\n${formatted}`,
          {
            message_thread_id: threadId,
          }
        );
      }

      let firstMedia = true;
      for (const attachment of message.attachments.values()) {
        const type = attachment.contentType || "";
        const url = attachment.url;
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

  return discordClient;
}
