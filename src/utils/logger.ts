import { Client, EmbedBuilder, TextChannel, Colors } from "discord.js";
import { queries } from "../database/index.js";

export type LogType = "create" | "delete" | "transfer" | "lock" | "unlock" | "hide" | "show" | "kick" | "permit" | "reject" | "rename" | "claim";

const LOG_CONFIG: Record<LogType, { color: number; emoji: string; title: string }> = {
  create:   { color: Colors.Green,   emoji: "🎙️", title: "Channel Created" },
  delete:   { color: Colors.Red,     emoji: "🗑️", title: "Channel Deleted" },
  transfer: { color: Colors.Gold,    emoji: "👑", title: "Ownership Transferred" },
  lock:     { color: Colors.Orange,  emoji: "🔒", title: "Channel Locked" },
  unlock:   { color: Colors.Green,   emoji: "🔓", title: "Channel Unlocked" },
  hide:     { color: Colors.Grey,    emoji: "🌑", title: "Channel Hidden" },
  show:     { color: Colors.Blue,    emoji: "👁️", title: "Channel Shown" },
  kick:     { color: Colors.Red,     emoji: "👢", title: "User Kicked" },
  permit:   { color: Colors.Green,   emoji: "✅", title: "User Permitted" },
  reject:   { color: Colors.Red,     emoji: "⛔", title: "User Rejected" },
  rename:   { color: Colors.Blue,    emoji: "✏️", title: "Channel Renamed" },
  claim:    { color: Colors.Purple,  emoji: "🏳️", title: "Channel Claimed" },
};

export async function sendLog(
  client: Client,
  guildId: string,
  type: LogType,
  fields: { name: string; value: string; inline?: boolean }[],
  extra?: string
): Promise<void> {
  const settings = queries.getGuildSettings(guildId);
  if (!settings?.log_channel_id) return;

  const guild = client.guilds.cache.get(guildId);
  if (!guild) return;

  const logChannel = guild.channels.cache.get(settings.log_channel_id) as TextChannel | undefined;
  if (!logChannel) return;

  const cfg = LOG_CONFIG[type];

  const embed = new EmbedBuilder()
    .setColor(cfg.color)
    .setTitle(`${cfg.emoji} ${cfg.title}`)
    .addFields(fields)
    .setTimestamp();

  if (extra) embed.setFooter({ text: extra });

  try {
    await logChannel.send({ embeds: [embed] });
  } catch {}
}
