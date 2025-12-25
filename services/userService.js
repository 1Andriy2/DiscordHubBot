import { supabase } from "../config/database.js";

/**
 * Отримати прив'язку користувача за Discord ID
 */
export async function getUserByDiscordId(discordId) {
  const { data, error } = await supabase
    .from("UserProfile")
    .select("*")
    .eq("discordId", discordId)
    .single();

  if (error && error.code !== "PGRST116") {
    // PGRST116 = no rows returned
    console.error("❌ Помилка отримання користувача:", error);
    return null;
  }

  return data || null;
}

/**
 * Отримати прив'язку користувача за Telegram ID
 */
export async function getUserByTelegramId(telegramId) {
  const { data, error } = await supabase
    .from("UserProfile")
    .select("*")
    .eq("telegramId", telegramId)
    .single();

  if (error && error.code !== "PGRST116") {
    console.error("❌ Помилка отримання користувача:", error);
    return null;
  }

  return data || null;
}

/**
 * Створити або оновити прив'язку користувача
 */
export async function upsertUser(userData) {
  // Перевіряємо, чи існує запис з таким telegramId
  const existingByTelegram = await getUserByTelegramId(userData.telegramId);

  // Якщо існує запис з таким telegramId, але іншим discordId - видаляємо старий
  if (
    existingByTelegram &&
    existingByTelegram.discordId !== userData.discordId
  ) {
    await deleteUserByTelegramId(userData.telegramId);
  }

  // Перевіряємо, чи існує запис з таким discordId
  const existingByDiscord = await getUserByDiscordId(userData.discordId);

  // Якщо існує запис з таким discordId, але іншим telegramId - видаляємо старий
  if (
    existingByDiscord &&
    existingByDiscord.telegramId !== userData.telegramId
  ) {
    await deleteUserByDiscordId(userData.discordId);
  }

  // Виконуємо upsert
  const { data, error } = await supabase
    .from("UserProfile")
    .upsert(
      {
        discordId: userData.discordId,
        telegramId: userData.telegramId,
        Username: userData.telegramUsername,
        FirstName: userData.telegramFirstName,
        updatedAt: new Date().toISOString(),
      },
      {
        onConflict: "discordId",
      }
    )
    .select()
    .single();

  if (error) {
    console.error("❌ Помилка збереження користувача:", error);
    return null;
  }

  return data;
}

/**
 * Видалити прив'язку користувача за Discord ID
 */
export async function deleteUserByDiscordId(discordId) {
  const { error } = await supabase
    .from("UserProfile")
    .delete()
    .eq("discordId", discordId);

  if (error) {
    console.error("❌ Помилка видалення користувача:", error);
    return false;
  }

  return true;
}

/**
 * Видалити прив'язку користувача за Telegram ID
 */
export async function deleteUserByTelegramId(telegramId) {
  const { error } = await supabase
    .from("UserProfile")
    .delete()
    .eq("telegramId", telegramId);

  if (error) {
    console.error("❌ Помилка видалення користувача:", error);
    return false;
  }

  return true;
}
