import {
  ActionRowBuilder,
  ButtonInteraction,
  ChannelType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  VoiceChannel,
} from "discord.js";
import { queries } from "../database/index.js";
import { applyHide, applyLock, clearPermissions, isChannelOwner } from "../utils/channel.js";
import { buildControlPanel, buildInfoEmbed } from "../utils/panel.js";
import { sendLog } from "../utils/logger.js";

function modal(id: string, title: string, inputId: string, label: string, placeholder: string, maxLength = 100): ModalBuilder {
  const m = new ModalBuilder().setCustomId(id).setTitle(title);
  const input = new TextInputBuilder()
    .setCustomId(inputId)
    .setLabel(label)
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(maxLength)
    .setPlaceholder(placeholder);
  m.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
  return m;
}

export async function handleButton(interaction: ButtonInteraction): Promise<void> {
  const { customId, guild, user } = interaction;
  if (!guild) return;

  const ownedChannel = queries.getTempChannelByOwner(user.id, guild.id);

  if (!ownedChannel) {
    await interaction.reply({
      content: "❌ You don't own a temporary channel. Join the **Join To Create** channel to create one.",
      ephemeral: true,
    });
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

  const noOwnerRequired = ["vc_claim", "vc_info"];
  if (!noOwnerRequired.includes(customId) && !isChannelOwner(ownedChannel, user.id)) {
    await interaction.reply({ content: "❌ Only the channel owner can use these controls.", ephemeral: true });
    return;
  }

  switch (customId) {
    case "vc_lock": {
      const newLocked = ownedChannel.is_locked === 0;
      await applyLock(voiceChannel, newLocked);

      // Ghost mode: also hide/show when locking/unlocking
      let newHidden = ownedChannel.is_hidden === 1;
      if (settings?.ghost_mode) {
        newHidden = newLocked;
        await applyHide(voiceChannel, newHidden);
      }

      queries.updateTempChannel(ownedChannel.channel_id, {
        is_locked: newLocked ? 1 : 0,
        is_hidden: newHidden ? 1 : 0,
      });

      const updated = queries.getTempChannel(ownedChannel.channel_id)!;
      await interaction.update(buildControlPanel(voiceChannel, updated, settings));

      await sendLog(interaction.client, guild.id, newLocked ? "lock" : "unlock", [
        { name: "Channel", value: voiceChannel.name, inline: true },
        { name: "Owner", value: `<@${user.id}>`, inline: true },
      ]);
      break;
    }

    case "vc_hide": {
      const newHidden = ownedChannel.is_hidden === 0;
      await applyHide(voiceChannel, newHidden);
      queries.updateTempChannel(ownedChannel.channel_id, { is_hidden: newHidden ? 1 : 0 });
      const updated = queries.getTempChannel(ownedChannel.channel_id)!;
      await interaction.update(buildControlPanel(voiceChannel, updated, settings));

      await sendLog(interaction.client, guild.id, newHidden ? "hide" : "show", [
        { name: "Channel", value: voiceChannel.name, inline: true },
        { name: "Owner", value: `<@${user.id}>`, inline: true },
      ]);
      break;
    }

    case "vc_rename":
      await interaction.showModal(modal("modal_rename", "Rename Your Channel", "channel_name", "New Channel Name", "Enter a name..."));
      break;

    case "vc_limit":
      await interaction.showModal(modal("modal_limit", "Set User Limit", "user_limit", "User Limit (0 = Unlimited)", "Enter 0-99...", 2));
      break;

    case "vc_bitrate":
      await interaction.showModal(modal("modal_bitrate", "Set Channel Bitrate", "bitrate_value", "Bitrate in kbps (8-384)", "e.g. 64 or 128...", 3));
      break;

    case "vc_permit":
      await interaction.showModal(modal("modal_permit", "Permit a User", "user_id", "User ID or @mention", "Paste user ID..."));
      break;

    case "vc_reject":
      await interaction.showModal(modal("modal_reject", "Reject a User", "user_id", "User ID or @mention", "Paste user ID..."));
      break;

    case "vc_kick":
      await interaction.showModal(modal("modal_kick", "Kick a User", "user_id", "User ID or @mention", "Paste user ID..."));
      break;

    case "vc_transfer":
      await interaction.showModal(modal("modal_transfer", "Transfer Ownership", "user_id", "New Owner User ID or @mention", "Paste user ID..."));
      break;

    case "vc_claim": {
      const current = queries.getTempChannel(ownedChannel.channel_id);
      if (!current) { await interaction.reply({ content: "❌ Channel not found.", ephemeral: true }); return; }
      if (current.owner_id === user.id) { await interaction.reply({ content: "✅ You already own this channel.", ephemeral: true }); return; }
      if (voiceChannel.members.has(current.owner_id)) {
        await interaction.reply({ content: "❌ The current owner is still in the channel.", ephemeral: true });
        return;
      }
      if (!voiceChannel.members.has(user.id)) {
        await interaction.reply({ content: "❌ You must be in the channel to claim it.", ephemeral: true });
        return;
      }

      queries.updateTempChannelOwner(user.id, ownedChannel.channel_id);
      await voiceChannel.permissionOverwrites.edit(user.id, {
        Connect: true, Speak: true, ManageChannels: true,
        MoveMembers: true, MuteMembers: true, DeafenMembers: true,
      }).catch(() => {});

      const updated = queries.getTempChannel(ownedChannel.channel_id)!;
      await interaction.update({ content: `<@${user.id}> 👑 You have claimed ownership!`, ...buildControlPanel(voiceChannel, updated, settings) });

      await sendLog(interaction.client, guild.id, "claim", [
        { name: "Channel", value: voiceChannel.name, inline: true },
        { name: "New Owner", value: `<@${user.id}>`, inline: true },
        { name: "Old Owner", value: `<@${current.owner_id}>`, inline: true },
      ]);
      break;
    }

    case "vc_invite": {
      try {
        const invite = await voiceChannel.createInvite({ maxAge: 3600, maxUses: 10, reason: "Channel invite via panel" });
        await interaction.reply({
          content: `🔗 **Invite Link** (expires in 1 hour, max 10 uses):\n${invite.url}`,
          ephemeral: true,
        });
      } catch {
        await interaction.reply({ content: "❌ Failed to create invite link.", ephemeral: true });
      }
      break;
    }

    case "vc_clear": {
      await clearPermissions(voiceChannel, user.id);
      queries.updateTempChannel(ownedChannel.channel_id, {
        permitted_users: "[]",
        rejected_users: "[]",
      });
      const updated = queries.getTempChannel(ownedChannel.channel_id)!;
      await interaction.update(buildControlPanel(voiceChannel, updated, settings));
      break;
    }

    case "vc_info": {
      const current = queries.getTempChannel(ownedChannel.channel_id);
      if (!current) { await interaction.reply({ content: "❌ Channel not found.", ephemeral: true }); return; }
      await interaction.reply({ embeds: [buildInfoEmbed(voiceChannel, current)], ephemeral: true });
      break;
    }

    case "vc_delete": {
      await interaction.reply({ content: "🗑️ Deleting your channel...", ephemeral: true });

      if (settings?.control_channel_id && ownedChannel.panel_message_id) {
        try {
          const ctrl = guild.channels.cache.get(settings.control_channel_id);
          if (ctrl?.type === ChannelType.GuildText) {
            const msg = await (ctrl as import("discord.js").TextChannel).messages.fetch(ownedChannel.panel_message_id);
            await msg.delete();
          }
        } catch {}
      }

      const channelName = voiceChannel.name;
      queries.deleteTempChannel(ownedChannel.channel_id);
      await voiceChannel.delete("Deleted by owner").catch(() => {});

      await sendLog(interaction.client, guild.id, "delete", [
        { name: "Channel", value: channelName, inline: true },
        { name: "Owner", value: `<@${user.id}>`, inline: true },
        { name: "Reason", value: "Manually deleted by owner", inline: true },
      ]);
      break;
    }
  }
}
