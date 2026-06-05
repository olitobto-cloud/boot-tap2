import {
  ChannelType,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  VoiceChannel,
  Colors,
} from "discord.js";
import { queries } from "../database/index.js";
import { buildControlPanel } from "../utils/panel.js";

export const data = new SlashCommandBuilder()
  .setName("admin")
  .setDescription("Admin controls for temporary channels")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand((sub) =>
    sub.setName("channels").setDescription("List all active temporary channels")
  )
  .addSubcommand((sub) =>
    sub
      .setName("delete")
      .setDescription("Force-delete a temporary channel")
      .addChannelOption((opt) =>
        opt
          .setName("channel")
          .setDescription("The voice channel to delete")
          .addChannelTypes(ChannelType.GuildVoice)
          .setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("transfer")
      .setDescription("Force-transfer channel ownership")
      .addChannelOption((opt) =>
        opt
          .setName("channel")
          .setDescription("The voice channel")
          .addChannelTypes(ChannelType.GuildVoice)
          .setRequired(true)
      )
      .addUserOption((opt) =>
        opt
          .setName("user")
          .setDescription("The new owner (must be in the channel)")
          .setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("info")
      .setDescription("View details of a specific temporary channel")
      .addChannelOption((opt) =>
        opt
          .setName("channel")
          .setDescription("The voice channel")
          .addChannelTypes(ChannelType.GuildVoice)
          .setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("clearall")
      .setDescription("Delete ALL temporary channels in this server (emergency reset)")
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const { guild } = interaction;
  if (!guild) return;

  const sub = interaction.options.getSubcommand();
  const settings = queries.getGuildSettings(guild.id);

  if (sub === "channels") {
    const channels = queries.getAllGuildChannels(guild.id);

    if (channels.length === 0) {
      await interaction.reply({
        content: "📭 There are no active temporary channels right now.",
        ephemeral: true,
      });
      return;
    }

    const lines = channels.map((ch, i) => {
      const vc = guild.channels.cache.get(ch.channel_id);
      const name = vc?.name ?? "*(deleted)*";
      const memberCount = vc?.type === ChannelType.GuildVoice ? (vc as VoiceChannel).members.size : 0;
      return `\`${i + 1}.\` **${name}** — Owner: <@${ch.owner_id}> — 👥 ${memberCount} members${ch.is_locked ? " 🔒" : ""}${ch.is_hidden ? " 🌑" : ""}`;
    });

    const embed = new EmbedBuilder()
      .setColor(Colors.Blurple)
      .setTitle("🎙️ Active Temporary Channels")
      .setDescription(lines.join("\n"))
      .setFooter({ text: `${channels.length} active channel${channels.length !== 1 ? "s" : ""}` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }

  if (sub === "delete") {
    const target = interaction.options.getChannel("channel", true) as VoiceChannel;
    const data = queries.getTempChannel(target.id);

    if (!data) {
      await interaction.reply({
        content: "❌ That channel is not a registered temporary channel.",
        ephemeral: true,
      });
      return;
    }

    if (settings?.control_channel_id && data.panel_message_id) {
      try {
        const ctrl = guild.channels.cache.get(settings.control_channel_id);
        if (ctrl?.type === ChannelType.GuildText) {
          const msg = await (ctrl as import("discord.js").TextChannel).messages.fetch(data.panel_message_id);
          await msg.delete();
        }
      } catch {}
    }

    queries.deleteTempChannel(target.id);
    await target.delete("Force deleted by admin").catch(() => {});

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(Colors.Red)
          .setTitle("🗑️ Channel Deleted")
          .setDescription(`**${target.name}** has been force-deleted.\nPrevious owner: <@${data.owner_id}>`)
          .setTimestamp(),
      ],
    });
    return;
  }

  if (sub === "transfer") {
    const target = interaction.options.getChannel("channel", true) as VoiceChannel;
    const newOwner = interaction.options.getUser("user", true);
    const data = queries.getTempChannel(target.id);

    if (!data) {
      await interaction.reply({ content: "❌ That is not a temporary channel.", ephemeral: true });
      return;
    }

    const newOwnerMember = guild.members.cache.get(newOwner.id);
    if (!newOwnerMember) {
      await interaction.reply({ content: "❌ User not found in this server.", ephemeral: true });
      return;
    }

    const oldOwnerId = data.owner_id;
    queries.updateTempChannelOwner(newOwner.id, target.id);

    await target.permissionOverwrites.edit(newOwner.id, {
      Connect: true, Speak: true, ManageChannels: true,
      MoveMembers: true, MuteMembers: true, DeafenMembers: true,
    }).catch(() => {});

    const updated = queries.getTempChannel(target.id)!;

    if (settings?.control_channel_id && data.panel_message_id) {
      try {
        const ctrl = guild.channels.cache.get(settings.control_channel_id);
        if (ctrl?.type === ChannelType.GuildText) {
          const msg = await (ctrl as import("discord.js").TextChannel).messages.fetch(data.panel_message_id);
          await msg.edit({
            content: `<@${newOwner.id}> You are now the channel owner! (Force-transferred by admin)`,
            ...buildControlPanel(target, updated, settings),
          });
        }
      } catch {}
    }

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(Colors.Gold)
          .setTitle("👑 Ownership Transferred")
          .addFields(
            { name: "Channel", value: `${target}`, inline: true },
            { name: "Old Owner", value: `<@${oldOwnerId}>`, inline: true },
            { name: "New Owner", value: `<@${newOwner.id}>`, inline: true },
          )
          .setTimestamp(),
      ],
    });
    return;
  }

  if (sub === "info") {
    const target = interaction.options.getChannel("channel", true) as VoiceChannel;
    const data = queries.getTempChannel(target.id);

    if (!data) {
      await interaction.reply({ content: "❌ That is not a temporary channel.", ephemeral: true });
      return;
    }

    const permitted: string[] = JSON.parse(data.permitted_users || "[]");
    const rejected: string[] = JSON.parse(data.rejected_users || "[]");

    const embed = new EmbedBuilder()
      .setColor(Colors.Blurple)
      .setTitle(`ℹ️ ${target.name}`)
      .addFields(
        { name: "👑 Owner", value: `<@${data.owner_id}>`, inline: true },
        { name: "🔒 Locked", value: data.is_locked ? "Yes" : "No", inline: true },
        { name: "👁️ Hidden", value: data.is_hidden ? "Yes" : "No", inline: true },
        { name: "👥 Members", value: `${target.members.size}${data.user_limit ? `/${data.user_limit}` : ""}`, inline: true },
        { name: "🎵 Bitrate", value: `${Math.floor(data.bitrate / 1000)}kbps`, inline: true },
        { name: "📅 Created", value: `<t:${data.created_at}:R>`, inline: true },
        { name: "✅ Permitted", value: permitted.length ? permitted.map((id) => `<@${id}>`).join(", ") : "None" },
        { name: "⛔ Rejected", value: rejected.length ? rejected.map((id) => `<@${id}>`).join(", ") : "None" },
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }

  if (sub === "clearall") {
    const channels = queries.getAllGuildChannels(guild.id);
    if (channels.length === 0) {
      await interaction.reply({ content: "📭 No active temporary channels to clear.", ephemeral: true });
      return;
    }

    await interaction.deferReply();
    let deleted = 0;

    for (const ch of channels) {
      const vc = guild.channels.cache.get(ch.channel_id);
      if (vc) {
        await vc.delete("Admin clearall").catch(() => {});
        deleted++;
      }
      if (settings?.control_channel_id && ch.panel_message_id) {
        try {
          const ctrl = guild.channels.cache.get(settings.control_channel_id);
          if (ctrl?.type === ChannelType.GuildText) {
            const msg = await (ctrl as import("discord.js").TextChannel).messages.fetch(ch.panel_message_id);
            await msg.delete();
          }
        } catch {}
      }
      queries.deleteTempChannel(ch.channel_id);
    }

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(Colors.Red)
          .setTitle("🗑️ All Channels Cleared")
          .setDescription(`Deleted **${deleted}** temporary channel${deleted !== 1 ? "s" : ""}.`)
          .setTimestamp(),
      ],
    });
  }
}
