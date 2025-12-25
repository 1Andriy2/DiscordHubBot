import TelegramBot from "node-telegram-bot-api";
import {
  getUserByTelegramId,
  upsertUser,
  deleteUserByTelegramId,
} from "../services/userService.js";

/**
 * Ініціалізація та налаштування Telegram бота
 */
export function createTelegramBot(pendingLinks) {
  const telegramBot = new TelegramBot(process.env.TELEGRAM_TOKEN, {
    polling: true,
  });

  telegramBot.on("polling_error", (error) => {
    if (error.code === "ETELEGRAM" && error.message.includes("409 Conflict")) {
      return;
    }
    console.error("❌ Telegram polling error:", error);
  });

  telegramBot.on("message", async (msg) => {
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

      // Перевіряємо, чи цей Telegram акаунт вже прив'язаний до іншого Discord
      const existingUser = await getUserByTelegramId(msg.from.id);
      if (existingUser && existingUser.discordId !== discordId) {
        telegramBot.sendMessage(
          msg.chat.id,
          "⚠️ Цей Telegram акаунт вже прив'язаний до іншого Discord акаунту. Стара прив'язка буде замінена."
        );
      }

      const userData = {
        discordId,
        telegramId: msg.from.id,
        telegramUsername: msg.from.username ? `@${msg.from.username}` : null,
        telegramFirstName: msg.from.first_name,
      };

      const result = await upsertUser(userData);
      if (result) {
        pendingLinks.delete(code);
        telegramBot.sendMessage(msg.chat.id, "✅ Акаунти успішно привʼязані");
      } else {
        telegramBot.sendMessage(
          msg.chat.id,
          "❌ Помилка при збереженні привʼязки"
        );
      }
      return;
    }

    if (msg.text === "/unlink") {
      const user = await getUserByTelegramId(msg.from.id);

      if (!user) {
        telegramBot.sendMessage(msg.chat.id, "ℹ️ Привʼязки не знайдено");
        return;
      }

      const deleted = await deleteUserByTelegramId(msg.from.id);
      if (deleted) {
        telegramBot.sendMessage(msg.chat.id, "🗑 Привʼязку видалено");
      } else {
        telegramBot.sendMessage(
          msg.chat.id,
          "❌ Помилка при видаленні привʼязки"
        );
      }
    }
  });

  return telegramBot;
}
