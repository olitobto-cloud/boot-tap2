import { ChannelType, ModalSubmitInteraction, VoiceChannel } from "discord.js";
import { queries } from "../database/index.js";
import { applyPermit, applyReject } from "../utils/channel.js";
import { buildControlPanel } from "../utils/panel.js";
import { sendLog } from "../utils/logger.js";

function extractUserId(input: string): string {
  const mention = input.match(/^<@!?(\d+)>$/);
  if (mention) return mention[1];
  if (/^\d{17,20}$/.test(input.trim())) return input.trim();
  return input.trim();
}

export async function handleModal(interaction: ModalSubmitInteraction): Promise<void> {
  const { customId, guild, user } = interaction;
  if (!guild) return;

  const ownedChannel = queries.getTempChannelByOwner(user.id, guild.id);
  if (!ownedChannel) {
    await interaction.reply({ content: "❌ You don't own a temporary channel.", ephemeral: true });
    return;
  }

  const channel = guild.channels.cache.get(ownedChannel.channel_id);
  if (!channel || channel.type !== ChannelType.GuildVoice) {
    queries.deleteTempChannel(ownedChannel.channel_id);
    await interaction.reply({ content: "❌ Your channel no longer exists.", ephemeral: true });
    return;
  }

  const voiceChannel = channel as VoiceChannel;
  const settings = queries.getGuildSettings(guild.id);

  async function refreshPanel(): Promise<void> {
    const updated = queries.getTempChannel(ownedChannel!.channel_id);
    if (!updated || !settings?.control_channel_id || !updated.panel_message_id) return;
    try {
      const ctrl = guild!.channels.cache.get(settings.control_channel_id);
      if (!ctrl || ctrl.type !== ChannelType.GuildText) return;
      const msg = await (ctrl as import("discord.js").TextChannel).messages.fetch(updated.panel_message_id);
      await msg.edit({ content: `<@${user.id}>`, ...buildControlPanel(voiceChannel, updated, settings) });
    } catch {}
  }

  switch (customId) {
    case "modal_rename": {
      const newName = interaction.fields.getTextInputValue("channel_name");
      await voiceChannel.setName(newName).catch(() => {});
      queries.upsertUserPreferences(user.id, guild.id, { default_name: newName });
      await interaction.reply({ content: `✅ Channel renamed to **${newName}**`, ephemeral: true });
      await refreshPanel();
      await sendLog(interaction.client, guild.id, "rename", [
        { name: "Channel", value: newName, inline: true },
        { name: "Owner", value: `<@${user.id}>`, inline: true },
      ]);
      break;
    }

    case "modal_limit": {
      const limit = parseInt(interaction.fields.getTextInputValue("user_limit"), 10);
      if (isNaN(limit) || limit < 0 || limit > 99) {
        await interaction.reply({ content: "❌ Enter a number between 0 and 99.", ephemeral: true });
        return;
      }
      await voiceChannel.setUserLimit(limit).catch(() => {});
      queries.updateTempChannel(ownedChannel.channel_id, { user_limit: limit });
      await interaction.reply({ content: limit === 0 ? "✅ Limit removed (unlimited)." : `✅ Limit set to **${limit}**.`, ephemeral: true });
      await refreshPanel();
      break;
    }

    case "modal_bitrate": {
      const bitrate = parseInt(interaction.fields.getTextInputValue("bitrate_value"), 10);
      const max = guild.premiumTier === 3 ? 384 : guild.premiumTier === 2 ? 256 : guild.premiumTier === 1 ? 128 : 96;
      if (isNaN(bitrate) || bitrate < 8 || bitrate > max) {
        await interaction.reply({ content: `❌ Bitrate must be between 8 and ${max}kbps.`, ephemeral: true });
        return;
      }
      await voiceChannel.setBitrate(bitrate * 1000).catch(() => {});
      queries.updateTempChannel(ownedChannel.channel_id, { bitrate: bitrate * 1000 });
      await interaction.reply({ content: `✅ Bitrate set to **${bitrate}kbps**.`, ephemeral: true });
      break;
    }

    case "modal_permit": {
      const targetId = extractUserId(interaction.fields.getTextInputValue("user_id"));
      if (targetId === user.id) { await interaction.reply({ content: "❌ You can't permit yourself.", ephemeral: true }); return; }
      await applyPermit(voiceChannel, targetId);
      const permitted: string[] = JSON.parse(ownedChannel.permitted_users || "[]");
      const rejected: string[] = JSON.parse(ownedChannel.rejected_users || "[]").filter((id: string) => id !== targetId);
      if (!permitted.includes(targetId)) permitted.push(targetId);
      queries.updateTempChannel(ownedChannel.channel_id, { permitted_users: JSON.stringify(permitted), rejected_users: JSON.stringify(rejected) });
      await interaction.reply({ content: `✅ <@${targetId}> has been permitted.`, ephemeral: true });
      await sendLog(interaction.client, guild.id, "permit", [
        { name: "Channel", value: voiceChannel.name, inline: true },
        { name: "Owner", value: `<@${user.id}>`, inline: true },
        { name: "Permitted User", value: `<@${targetId}>`, inline: true },
      ]);
      break;
    }

    case "modal_reject": {
      const targetId = extractUserId(interaction.fields.getTextInputValue("user_id"));
      if (targetId === user.id) { await interaction.reply({ content: "❌ You can't reject yourself.", ephemeral: true }); return; }
      await applyReject(voiceChannel, targetId);
      const rejected: string[] = JSON.parse(ownedChannel.rejected_users || "[]");
      const permitted: string[] = JSON.parse(ownedChannel.permitted_users || "[]").filter((id: string) => id !== targetId);
      if (!rejected.includes(targetId)) rejected.push(targetId);
      queries.updateTempChannel(ownedChannel.channel_id, { permitted_users: JSON.stringify(permitted), rejected_users: JSON.stringify(rejected) });
      await interaction.reply({ content: `✅ <@${targetId}> has been rejected and removed.`, ephemeral: true });
      await sendLog(interaction.client, guild.id, "reject", [
        { name: "Channel", value: voiceChannel.name, inline: true },
        { name: "Owner", value: `<@${user.id}>`, inline: true },
        { name: "Rejected User", value: `<@${targetId}>`, inline: true },
      ]);
      break;
    }

    case "modal_kick": {
      const targetId = extractUserId(interaction.fields.getTextInputValue("user_id"));
      if (targetId === user.id) { await interaction.reply({ content: "❌ You can't kick yourself.", ephemeral: true }); return; }
      const target = voiceChannel.members.get(targetId);
      if (!target) { await interaction.reply({ content: "❌ That user is not in your channel.", ephemeral: true }); return; }
      await target.voice.disconnect("Kicked by channel owner").catch(() => {});
      await interaction.reply({ content: `✅ <@${targetId}> has been kicked.`, ephemeral: true });
      await sendLog(interaction.client, guild.id, "kick", [
        { name: "Channel", value: voiceChannel.name, inline: true },
        { name: "Owner", value: `<@${user.id}>`, inline: true },
        { name: "Kicked User", value: `<@${targetId}>`, inline: true },
      ]);
      break;
    }

    case "modal_transfer": {
      const targetId = extractUserId(interaction.fields.getTextInputValue("user_id"));
      if (targetId === user.id) { await interaction.reply({ content: "❌ You can't transfer to yourself.", ephemeral: true }); return; }
      const target = voiceChannel.members.get(targetId);
      if (!target) { await interaction.reply({ content: "❌ That user must be in your channel.", ephemeral: true }); return; }

      queries.updateTempChannelOwner(targetId, ownedChannel.channel_id);
      await voiceChannel.permissionOverwrites.edit(targetId, {
        Connect: true, Speak: true, ManageChannels: true,
        MoveMembers: true, MuteMembers: true, DeafenMembers: true,
      }).catch(() => {});

      await interaction.reply({ content: `✅ Ownership transferred to <@${targetId}>.`, ephemeral: true });

      const updated = queries.getTempChannel(ownedChannel.channel_id);
      if (settings?.control_channel_id && updated?.panel_message_id) {
        try {
          const ctrl = guild.channels.cache.get(settings.control_channel_id);
          if (ctrl?.type === ChannelType.GuildText) {
            const msg = await (ctrl as import("discord.js").TextChannel).messages.fetch(updated.panel_message_id);
            await msg.edit({ content: `<@${targetId}> 👑 You are now the channel owner!`, ...buildControlPanel(voiceChannel, updated, settings) });
          }
        } catch {}
      }

      await sendLog(interaction.client, guild.id, "transfer", [
        { name: "Channel", value: voiceChannel.name, inline: true },
        { name: "Old Owner", value: `<@${user.id}>`, inline: true },
        { name: "New Owner", value: `<@${targetId}>`, inline: true },
      ]);
      break;
    }
  }
}
