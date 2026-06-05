import {
  ChannelType,
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  TextChannel,
} from "discord.js";
import { queries } from "../database/index.js";
import { buildControlPanel } from "../utils/panel.js";

export const data = new SlashCommandBuilder()
  .setName("panel")
  .setDescription("Resend your channel control panel");

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const { guild, user } = interaction;
  if (!guild) return;

  const ownedChannel = queries.getTempChannelByOwner(user.id, guild.id);
  if (!ownedChannel) {
    await interaction.reply({ content: "❌ You don't own a temporary channel. Join the **Join To Create** channel first.", ephemeral: true });
    return;
  }

  const channel = guild.channels.cache.get(ownedChannel.channel_id);
  if (!channel || channel.type !== ChannelType.GuildVoice) {
    queries.deleteTempChannel(ownedChannel.channel_id);
    await interaction.reply({ content: "❌ Your channel no longer exists.", ephemeral: true });
    return;
  }

  const voiceChannel = channel as import("discord.js").VoiceChannel;
  const settings = queries.getGuildSettings(guild.id);

  if (!settings?.control_channel_id) {
    await interaction.reply({ content: "❌ No control channel configured. Ask an admin to run `/setup`.", ephemeral: true });
    return;
  }

  const controlChannel = guild.channels.cache.get(settings.control_channel_id) as TextChannel | undefined;
  if (!controlChannel) {
    await interaction.reply({ content: "❌ Control channel not found.", ephemeral: true });
    return;
  }

  if (ownedChannel.panel_message_id) {
    try {
      const old = await controlChannel.messages.fetch(ownedChannel.panel_message_id);
      await old.delete();
    } catch {}
  }

  const panel = buildControlPanel(voiceChannel, ownedChannel, settings);
  const msg = await controlChannel.send({ content: `<@${user.id}>`, ...panel });
  queries.updateTempChannel(ownedChannel.channel_id, { panel_message_id: msg.id });

  await interaction.reply({ content: `✅ Control panel sent to ${controlChannel}.`, ephemeral: true });
}
