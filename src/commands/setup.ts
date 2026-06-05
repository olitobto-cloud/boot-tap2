import {
  ChannelType,
  ChatInputCommandInteraction,
  EmbedBuilder,
  OverwriteType,
  PermissionFlagsBits,
  SlashCommandBuilder,
  TextChannel,
  VoiceChannel,
  Colors,
} from "discord.js";
import { queries } from "../database/index.js";
import { buildSetupEmbed } from "../utils/panel.js";

export const data = new SlashCommandBuilder()
  .setName("setup")
  .setDescription("Configure the Temporary Channels system")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand((sub) =>
    sub
      .setName("create")
      .setDescription("Auto-create all required channels")
      .addStringOption((opt) =>
        opt.setName("category_name").setDescription("Category name (default: Temporary Channels)").setRequired(false)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("manual")
      .setDescription("Link existing channels manually")
      .addChannelOption((opt) =>
        opt.setName("jtc_channel").setDescription("Voice channel users join to create a temp channel").addChannelTypes(ChannelType.GuildVoice).setRequired(true)
      )
      .addChannelOption((opt) =>
        opt.setName("control_channel").setDescription("Text channel where control panels appear").addChannelTypes(ChannelType.GuildText).setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("config")
      .setDescription("Configure advanced server-wide settings")
      .addChannelOption((opt) =>
        opt.setName("log_channel").setDescription("Channel for activity logs").addChannelTypes(ChannelType.GuildText).setRequired(false)
      )
      .addBooleanOption((opt) =>
        opt.setName("ghost_mode").setDescription("Auto-hide channels when they are locked").setRequired(false)
      )
      .addBooleanOption((opt) =>
        opt.setName("auto_name").setDescription("Auto-name channels after the owner's game activity").setRequired(false)
      )
      .addIntegerOption((opt) =>
        opt.setName("cooldown").setDescription("Cooldown (seconds) between channel creations (0 = off)").setMinValue(0).setMaxValue(300).setRequired(false)
      )
      .addIntegerOption((opt) =>
        opt.setName("default_limit").setDescription("Default user limit for new channels (0 = unlimited)").setMinValue(0).setMaxValue(99).setRequired(false)
      )
      .addIntegerOption((opt) =>
        opt.setName("default_bitrate").setDescription("Default bitrate in kbps for new channels (8-384)").setMinValue(8).setMaxValue(384).setRequired(false)
      )
      .addIntegerOption((opt) =>
        opt.setName("max_channels").setDescription("Max simultaneous temp channels server-wide (0 = unlimited)").setMinValue(0).setMaxValue(500).setRequired(false)
      )
  )
  .addSubcommand((sub) =>
    sub.setName("info").setDescription("View current configuration")
  )
  .addSubcommand((sub) =>
    sub.setName("reset").setDescription("Reset all configuration for this server")
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const { guild } = interaction;
  if (!guild) return;

  const sub = interaction.options.getSubcommand();

  if (sub === "create") {
    await interaction.deferReply({ ephemeral: true });

    const categoryName = interaction.options.getString("category_name") || "Temporary Channels";

    const category = await guild.channels.create({ name: categoryName, type: ChannelType.GuildCategory });

    const jtcChannel = await guild.channels.create({
      name: "➕ Join To Create",
      type: ChannelType.GuildVoice,
      parent: category.id,
      permissionOverwrites: [
        { id: guild.roles.everyone.id, type: OverwriteType.Role, allow: [PermissionFlagsBits.Connect, PermissionFlagsBits.ViewChannel] },
      ],
    });

    const controlChannel = await guild.channels.create({
      name: "🎛️-channel-controls",
      type: ChannelType.GuildText,
      parent: category.id,
      topic: "Your temporary voice channel control panel appears here.",
      permissionOverwrites: [
        { id: guild.roles.everyone.id, type: OverwriteType.Role, deny: [PermissionFlagsBits.SendMessages], allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory] },
      ],
    });

    const logChannel = await guild.channels.create({
      name: "📋-vc-logs",
      type: ChannelType.GuildText,
      parent: category.id,
      permissionOverwrites: [
        { id: guild.roles.everyone.id, type: OverwriteType.Role, deny: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.ViewChannel] },
      ],
    });

    queries.upsertGuildSettings(guild.id, {
      jtc_channel_id: jtcChannel.id,
      jtc_category_id: category.id,
      control_channel_id: controlChannel.id,
      log_channel_id: logChannel.id,
    });

    const embed = buildSetupEmbed().addFields(
      { name: "📁 Category", value: `${category}`, inline: true },
      { name: "🎙️ JTC Channel", value: `${jtcChannel}`, inline: true },
      { name: "🎛️ Controls", value: `${controlChannel}`, inline: true },
      { name: "📋 Logs", value: `${logChannel}`, inline: true },
    );

    await interaction.editReply({ embeds: [embed] });

    await (controlChannel as TextChannel).send({
      embeds: [
        new EmbedBuilder()
          .setColor(Colors.Blurple)
          .setTitle("🎙️ Temporary Voice Channels")
          .setDescription(
            "**How to use:**\n" +
            "1. Join **➕ Join To Create** to get your own voice channel\n" +
            "2. Your personal control panel will appear here\n" +
            "3. Use the buttons to manage your channel\n" +
            "4. The channel auto-deletes when everyone leaves\n\n" +
            "Use `/help` to see all available commands."
          )
          .setFooter({ text: "Powered by Temporary Channels Bot" })
          .setTimestamp(),
      ],
    });
    return;
  }

  if (sub === "manual") {
    await interaction.deferReply({ ephemeral: true });

    const jtcChannel = interaction.options.getChannel("jtc_channel", true) as VoiceChannel;
    const controlChannel = interaction.options.getChannel("control_channel", true) as TextChannel;

    queries.upsertGuildSettings(guild.id, {
      jtc_channel_id: jtcChannel.id,
      jtc_category_id: jtcChannel.parentId,
      control_channel_id: controlChannel.id,
    });

    const embed = buildSetupEmbed().addFields(
      { name: "🎙️ JTC Channel", value: `${jtcChannel}`, inline: true },
      { name: "🎛️ Control Channel", value: `${controlChannel}`, inline: true }
    );
    await interaction.editReply({ embeds: [embed] });
    return;
  }

  if (sub === "config") {
    const updates: Record<string, unknown> = {};
    let changed: string[] = [];

    const logChannel = interaction.options.getChannel("log_channel");
    if (logChannel) { updates.log_channel_id = logChannel.id; changed.push(`📋 Log channel → ${logChannel}`); }

    const ghostMode = interaction.options.getBoolean("ghost_mode");
    if (ghostMode !== null) { updates.ghost_mode = ghostMode; changed.push(`👻 Ghost mode → **${ghostMode ? "Enabled" : "Disabled"}**`); }

    const autoName = interaction.options.getBoolean("auto_name");
    if (autoName !== null) { updates.auto_name = autoName; changed.push(`🎮 Auto-name → **${autoName ? "Enabled" : "Disabled"}**`); }

    const cooldown = interaction.options.getInteger("cooldown");
    if (cooldown !== null) { updates.cooldown_seconds = cooldown; changed.push(`⏱️ Cooldown → **${cooldown}s**`); }

    const defaultLimit = interaction.options.getInteger("default_limit");
    if (defaultLimit !== null) { updates.default_limit = defaultLimit; changed.push(`👥 Default limit → **${defaultLimit || "Unlimited"}**`); }

    const defaultBitrate = interaction.options.getInteger("default_bitrate");
    if (defaultBitrate !== null) { updates.default_bitrate = defaultBitrate * 1000; changed.push(`🎵 Default bitrate → **${defaultBitrate}kbps**`); }

    const maxChannels = interaction.options.getInteger("max_channels");
    if (maxChannels !== null) { updates.max_channels = maxChannels; changed.push(`🎙️ Max channels → **${maxChannels || "Unlimited"}**`); }

    if (changed.length === 0) {
      await interaction.reply({ content: "❌ No changes were specified.", ephemeral: true });
      return;
    }

    queries.upsertGuildSettings(guild.id, updates as any);

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(Colors.Green)
          .setTitle("✅ Configuration Updated")
          .setDescription(changed.join("\n"))
          .setTimestamp(),
      ],
      ephemeral: true,
    });
    return;
  }

  if (sub === "reset") {
    queries.upsertGuildSettings(guild.id, {
      jtc_channel_id: null,
      jtc_category_id: null,
      control_channel_id: null,
      log_channel_id: null,
    });
    await interaction.reply({ content: "✅ Configuration reset. Use `/setup create` to start fresh.", ephemeral: true });
    return;
  }

  if (sub === "info") {
    const s = queries.getGuildSettings(guild.id);

    if (!s?.jtc_channel_id) {
      await interaction.reply({ content: "❌ Not configured. Use `/setup create` to get started.", ephemeral: true });
      return;
    }

    const jtc = guild.channels.cache.get(s.jtc_channel_id);
    const ctrl = s.control_channel_id ? guild.channels.cache.get(s.control_channel_id) : null;
    const logs = s.log_channel_id ? guild.channels.cache.get(s.log_channel_id) : null;
    const cat = s.jtc_category_id ? guild.channels.cache.get(s.jtc_category_id) : null;

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(Colors.Blurple)
          .setTitle("⚙️ Server Configuration")
          .addFields(
            { name: "📁 Category", value: cat ? `${cat}` : "Not set", inline: true },
            { name: "🎙️ JTC Channel", value: jtc ? `${jtc}` : "❌ Missing", inline: true },
            { name: "🎛️ Controls", value: ctrl ? `${ctrl}` : "Not set", inline: true },
            { name: "📋 Logs", value: logs ? `${logs}` : "Not set", inline: true },
            { name: "👻 Ghost Mode", value: s.ghost_mode ? "✅ Enabled" : "❌ Disabled", inline: true },
            { name: "🎮 Auto-Name", value: s.auto_name ? "✅ Enabled" : "❌ Disabled", inline: true },
            { name: "⏱️ Cooldown", value: `${s.cooldown_seconds}s`, inline: true },
            { name: "👥 Default Limit", value: s.default_limit ? `${s.default_limit}` : "Unlimited", inline: true },
            { name: "🎵 Default Bitrate", value: `${Math.floor(s.default_bitrate / 1000)}kbps`, inline: true },
            { name: "🔢 Max Channels", value: s.max_channels ? `${s.max_channels}` : "Unlimited", inline: true },
          )
          .setTimestamp(),
      ],
      ephemeral: true,
    });
  }
}
