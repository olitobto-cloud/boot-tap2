import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
  Colors,
} from "discord.js";
import { queries } from "../database/index.js";

export const data = new SlashCommandBuilder()
  .setName("stats")
  .setDescription("View temporary channel statistics for this server");

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const { guild } = interaction;
  if (!guild) return;

  const stats = queries.getGuildStats(guild.id);
  const activeChannels = queries.getAllGuildChannels(guild.id);
  const settings = queries.getGuildSettings(guild.id);
  const blacklist = queries.getBlacklist(guild.id);

  const embed = new EmbedBuilder()
    .setColor(Colors.Blurple)
    .setTitle(`📊 ${guild.name} — Temp Channel Stats`)
    .setThumbnail(guild.iconURL())
    .addFields(
      {
        name: "🎙️ Active Channels",
        value: `**${activeChannels.length}**${settings?.max_channels ? ` / ${settings.max_channels}` : ""}`,
        inline: true,
      },
      {
        name: "📈 Total Created",
        value: `**${stats?.total_created ?? 0}**`,
        inline: true,
      },
      {
        name: "📉 Total Deleted",
        value: `**${stats?.total_deleted ?? 0}**`,
        inline: true,
      },
      {
        name: "🏆 Peak Concurrent",
        value: `**${stats?.peak_concurrent ?? 0}** channels at once`,
        inline: true,
      },
      {
        name: "🚫 Blacklisted Users",
        value: `**${blacklist.length}**`,
        inline: true,
      },
      {
        name: "⏱️ Last Activity",
        value: stats?.last_activity ? `<t:${stats.last_activity}:R>` : "No activity yet",
        inline: true,
      }
    )
    .addFields({
      name: "⚙️ Server Config",
      value: [
        `🔒 Ghost Mode: **${settings?.ghost_mode ? "Enabled" : "Disabled"}**`,
        `🎮 Auto-Name: **${settings?.auto_name ? "Enabled" : "Disabled"}**`,
        `⏱️ Cooldown: **${settings?.cooldown_seconds ?? 5}s**`,
        `👥 Default Limit: **${settings?.default_limit ?? 0 ? settings!.default_limit : "Unlimited"}**`,
        `🎵 Default Bitrate: **${Math.floor((settings?.default_bitrate ?? 64000) / 1000)}kbps**`,
      ].join("\n"),
    })
    .setFooter({ text: `Server ID: ${guild.id}` })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}
