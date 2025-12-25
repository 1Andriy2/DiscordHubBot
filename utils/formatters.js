/**
 * Отримати відображуване ім'я користувача Discord
 */
export function getDiscordDisplayName(message) {
  return (
    message.member?.displayName ||
    message.author.globalName ||
    message.author.username
  );
}

/**
 * Форматувати повідомлення Discord для Telegram
 */
export async function formatDiscordMessage(message, getUserByDiscordId) {
  let text = message.content;

  // Users
  for (const user of message.mentions.users.values()) {
    const entry = await getUserByDiscordId(user.id);
    const name =
      entry?.userName ||
      message.guild?.members.cache.get(user.id)?.displayName ||
      user.username ||
      "Unknown";

    if (name && name.trim()) {
      text = text.replace(
        new RegExp(`<@!?${user.id}>`, "g"),
        name.startsWith("@") ? name : `@${name}`
      );
    }
  }

  // Roles
  message.mentions.roles.forEach((role) => {
    text = text.replace(new RegExp(`<@&${role.id}>`, "g"), `@${role.name}`);
  });

  return text;
}

