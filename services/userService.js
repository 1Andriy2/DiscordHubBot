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
  // Не шукаємо записи з telegramId = null (це означає відсутність прив'язки)
  if (!telegramId) {
    return null;
  }

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
 * Спочатку перевіряє discordId - якщо є, оновлює, якщо ні - створює новий
 */
export async function upsertUser(userData) {
  console.log("📝 Початок upsertUser з даними:", {
    discordId: userData.discordId,
    telegramId: userData.telegramId,
    telegramUsername: userData.telegramUsername,
    telegramFirstName: userData.telegramFirstName,
  });

  // Спочатку перевіряємо, чи існує запис з таким discordId
  const existingByDiscord = await getUserByDiscordId(userData.discordId);
  console.log("🔍 Існуючий запис за discordId:", existingByDiscord);

  // Якщо запис існує - оновлюємо його
  if (existingByDiscord) {
    console.log("🔄 Оновлюємо існуючий запис");

    // Якщо telegramId вже прив'язаний до іншого discordId - очищаємо стару прив'язку
    if (existingByDiscord.telegramId !== userData.telegramId) {
      const existingByTelegram = await getUserByTelegramId(userData.telegramId);
      if (
        existingByTelegram &&
        existingByTelegram.discordId !== userData.discordId
      ) {
        console.log("🗑 Очищаємо стару прив'язку telegramId");
        await unlinkTelegramId(userData.telegramId);
      }
    }

    // Оновлюємо запис
    const { data, error } = await supabase
      .from("UserProfile")
      .update({
        telegramId: userData.telegramId,
        userName: userData.telegramUsername,
        firstName: userData.telegramFirstName,
        updatedAt: new Date().toISOString(),
      })
      .eq("discordId", userData.discordId)
      .select()
      .single();

    if (error) {
      console.error("❌ Помилка оновлення користувача:", error);
      return null;
    }

    console.log("✅ Успішно оновлено:", data);
    return data;
  }

  // Якщо запису немає - створюємо новий
  console.log("➕ Створюємо новий запис");

  // Перевіряємо, чи telegramId вже прив'язаний до іншого discordId
  const existingByTelegram = await getUserByTelegramId(userData.telegramId);
  if (
    existingByTelegram &&
    existingByTelegram.discordId !== userData.discordId
  ) {
    console.log("🗑 Очищаємо стару прив'язку telegramId");
    await unlinkTelegramId(userData.telegramId);
  }

  // Створюємо новий запис
  const { data, error } = await supabase
    .from("UserProfile")
    .insert({
      discordId: userData.discordId,
      telegramId: userData.telegramId,
      userName: userData.telegramUsername,
      firstName: userData.telegramFirstName,
      updatedAt: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error("❌ Помилка створення користувача:", error);
    return null;
  }

  console.log("✅ Успішно створено:", data);
  return data;
}

/**
 * Очистити прив'язку за Discord ID (залишити discordId, очистити telegramId)
 */
export async function unlinkByDiscordId(discordId) {
  const { error } = await supabase
    .from("UserProfile")
    .update({
      telegramId: null,
      userName: null,
      firstName: null,
      updatedAt: new Date().toISOString(),
    })
    .eq("discordId", discordId);

  if (error) {
    console.error("❌ Помилка очищення прив'язки:", error);
    return false;
  }

  return true;
}

/**
 * Очистити прив'язку Telegram (залишити discordId, очистити telegramId)
 */
export async function unlinkTelegramId(telegramId) {
  const { error } = await supabase
    .from("UserProfile")
    .update({
      telegramId: null,
      userName: null,
      firstName: null,
      updatedAt: new Date().toISOString(),
    })
    .eq("telegramId", telegramId);

  if (error) {
    console.error("❌ Помилка очищення прив'язки:", error);
    return false;
  }

  return true;
}

/**
 * Видалити прив'язку користувача за Discord ID (стара функція, замінена на unlinkByDiscordId)
 */
export async function deleteUserByDiscordId(discordId) {
  return await unlinkByDiscordId(discordId);
}

/**
 * Видалити прив'язку користувача за Telegram ID (стара функція, замінена на unlinkTelegramId)
 */
export async function deleteUserByTelegramId(telegramId) {
  return await unlinkTelegramId(telegramId);
}
