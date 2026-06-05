import { queries } from "../database/index.js";

export function checkCooldown(userId: string, guildId: string): number {
  const settings = queries.getGuildSettings(guildId);
  const cooldownSeconds = settings?.cooldown_seconds ?? 5;
  if (cooldownSeconds === 0) return 0;

  const last = queries.getCooldown(userId, guildId);
  const now = Math.floor(Date.now() / 1000);
  const remaining = cooldownSeconds - (now - last);
  return remaining > 0 ? remaining : 0;
}

export function applyCooldown(userId: string, guildId: string): void {
  queries.setCooldown(userId, guildId);
}
