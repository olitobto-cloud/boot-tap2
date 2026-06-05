import {
  CategoryChannel,
  ChannelType,
  Client,
  TextChannel,
  VoiceChannel,
  VoiceState,
} from "discord.js";
import { queries } from "../database/index.js";
import { createTempChannel, applyLock, applyHide } from "../utils/channel.js";
import { buildControlPanel } from "../utils/panel.js";
import { checkCooldown, applyCooldown } from "../utils/cooldown.js";
import { sendLog } from "../utils/logger.js";

export async function handleVoiceStateUpdate(
  client: Client,
  oldState: VoiceState,
  newState: VoiceState
): Promise<void> {
  const guildId = newState.guild.id;
  const settings = queries.getGuildSettings(guildId);
  if (!settings?.jtc_channel_id) return;

  const member = newState.member;
  if (!member || member.user.bot) return;

  // ── User joined the JTC channel ──────────────────────────────────────────
  if (
    newState.channelId === settings.jtc_channel_id &&
    oldState.channelId !== settings.jtc_channel_id
  ) {
    // Blacklist check
    if (queries.isBlacklisted(member.id, guildId)) {
      await member.voice.disconnect("Blacklisted from creating channels").catch(() => {});
      try {
        await member.send("🚫 You are blacklisted from creating temporary channels in that server.").catch(() => {});
      } catch {}
      return;
    }

    // Max channels check
    if (settings.max_channels > 0) {
      const activeCount = queries.getAllGuildChannels(guildId).length;
      if (activeCount >= settings.max_channels) {
        await member.voice.disconnect("Server reached max temp channels").catch(() => {});
        try {
          await member.send(`⚠️ The server has reached the maximum of **${settings.max_channels}** temporary channels. Please try again later.`).catch(() => {});
        } catch {}
        return;
      }
    }

    // Cooldown check
    const remaining = checkCooldown(member.id, guildId);
    if (remaining > 0) {
      await member.voice.disconnect("Cooldown active").catch(() => {});
      try {
        await member.send(`⏱️ Please wait **${remaining}** more second${remaining !== 1 ? "s" : ""} before creating another channel.`).catch(() => {});
      } catch {}
      return;
    }

    // If owner already has a channel, move them there
    const existingChannel = queries.getTempChannelByOwner(member.id, guildId);
    if (existingChannel) {
      const ch = newState.guild.channels.cache.get(existingChannel.channel_id);
      if (ch && ch.type === ChannelType.GuildVoice) {
        await member.voice.setChannel(ch.id).catch(() => {});
        return;
      }
    }

    // Find category
    let category: CategoryChannel | null = null;
    if (settings.jtc_category_id) {
      const cat = newState.guild.channels.cache.get(settings.jtc_category_id);
      if (cat && cat.type === ChannelType.GuildCategory) category = cat as CategoryChannel;
    }

    // Create temp channel
    const tempChannel = await createTempChannel(member, category);
    await member.voice.setChannel(tempChannel.id).catch(() => {});

    // Apply default preferences
    const prefs = queries.getUserPreferences(member.id, guildId);
    if ((prefs?.default_limit ?? settings.default_limit) > 0) {
      await tempChannel.setUserLimit(prefs?.default_limit ?? settings.default_limit).catch(() => {});
    }

    queries.createTempChannel(tempChannel.id, guildId, member.id, {
      user_limit: prefs?.default_limit ?? settings.default_limit,
      bitrate: prefs?.default_bitrate ?? settings.default_bitrate,
    });

    applyCooldown(member.id, guildId);

    // Send panel inside the temp voice channel itself
    const data = queries.getTempChannel(tempChannel.id);
    if (data) {
      const panel = buildControlPanel(tempChannel, data, settings);
      const msg = await tempChannel.send({ content: `<@${member.id}>`, ...panel }).catch(() => null);
      if (msg) queries.updateTempChannel(tempChannel.id, { panel_message_id: msg.id });
    }

    // Log channel creation
    await sendLog(client, guildId, "create", [
      { name: "Channel", value: `${tempChannel} (${tempChannel.name})`, inline: true },
      { name: "Owner", value: `<@${member.id}> (${member.user.tag})`, inline: true },
    ]);

    return;
  }

  // ── User left a temp channel ─────────────────────────────────────────────
  if (
    oldState.channelId &&
    oldState.channelId !== settings.jtc_channel_id &&
    oldState.channelId !== newState.channelId
  ) {
    const data = queries.getTempChannel(oldState.channelId);
    if (!data) return;

    const channel = oldState.guild.channels.cache.get(oldState.channelId);
    if (!channel || channel.type !== ChannelType.GuildVoice) {
      queries.deleteTempChannel(oldState.channelId);
      return;
    }

    const voiceChannel = channel as VoiceChannel;

    // Channel is empty — delete it
    if (voiceChannel.members.size === 0) {

      const channelName = voiceChannel.name;
      queries.deleteTempChannel(oldState.channelId);
      await voiceChannel.delete("Empty — auto deleted").catch(() => {});

      await sendLog(client, guildId, "delete", [
        { name: "Channel", value: channelName, inline: true },
        { name: "Owner", value: `<@${data.owner_id}>`, inline: true },
        { name: "Reason", value: "Empty (all members left)", inline: true },
      ]);
      return;
    }

    // Owner left — auto-transfer to next member
    if (data.owner_id === member.id) {
      const newOwner = voiceChannel.members.first();
      if (!newOwner) return;

      queries.updateTempChannelOwner(newOwner.id, oldState.channelId);

      await voiceChannel.permissionOverwrites.edit(newOwner.id, {
        Connect: true, Speak: true, ManageChannels: true,
        MoveMembers: true, MuteMembers: true, DeafenMembers: true,
      }).catch(() => {});

      await sendLog(client, guildId, "transfer", [
        { name: "Channel", value: `${voiceChannel.name}`, inline: true },
        { name: "Old Owner", value: `<@${member.id}>`, inline: true },
        { name: "New Owner", value: `<@${newOwner.id}>`, inline: true },
        { name: "Reason", value: "Owner left the channel", inline: false },
      ]);

      const updatedData = queries.getTempChannel(oldState.channelId);
      if (updatedData?.panel_message_id) {
        try {
          const msg = await voiceChannel.messages.fetch(updatedData.panel_message_id);
          const panel = buildControlPanel(voiceChannel, updatedData, settings);
          await msg.edit({ content: `<@${newOwner.id}> 👑 You are now the channel owner!`, ...panel });
        } catch {}
      }
    }
  }
}
