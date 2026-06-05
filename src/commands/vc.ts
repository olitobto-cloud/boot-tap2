import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
  Colors,
} from "discord.js";
import { queries } from "../database/index.js";

export const data = new SlashCommandBuilder()
  .setName("vc")
  .setDescription("Manage your personal channel preferences")
  .addSubcommand((sub) =>
    sub
      .setName("setname")
      .setDescription("Set your default channel name")
      .addStringOption((opt) =>
        opt
          .setName("name")
          .setDescription("Your default channel name")
          .setMinLength(1)
          .setMaxLength(100)
          .setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("setlimit")
      .setDescription("Set your default user limit")
      .addIntegerOption((opt) =>
        opt
          .setName("limit")
          .setDescription("User limit (0 = unlimited)")
          .setMinValue(0)
          .setMaxValue(99)
          .setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("setbitrate")
      .setDescription("Set your default bitrate")
      .addIntegerOption((opt) =>
        opt
          .setName("kbps")
          .setDescription("Bitrate in kbps (8-384)")
          .setMinValue(8)
          .setMaxValue(384)
          .setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub.setName("preferences").setDescription("View your saved preferences")
  )
  .addSubcommand((sub) =>
    sub.setName("reset").setDescription("Reset all your preferences to defaults")
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const { guild, user } = interaction;
  if (!guild) return;

  const sub = interaction.options.getSubcommand();

  if (sub === "setname") {
    const name = interaction.options.getString("name", true);
    queries.upsertUserPreferences(user.id, guild.id, { default_name: name });

    const existing = queries.getTempChannelByOwner(user.id, guild.id);
    let extra = "";
    if (existing) {
      const ch = guild.channels.cache.get(existing.channel_id);
      if (ch) {
        await ch.setName(name).catch(() => {});
        extra = "\nYour current channel has also been renamed.";
      }
    }

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(Colors.Green)
          .setTitle("✅ Default Name Set")
          .setDescription(`Your channels will now be named **${name}** by default.${extra}`)
          .setTimestamp(),
      ],
      ephemeral: true,
    });
    return;
  }

  if (sub === "setlimit") {
    const limit = interaction.options.getInteger("limit", true);
    queries.upsertUserPreferences(user.id, guild.id, { default_limit: limit });

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(Colors.Green)
          .setTitle("✅ Default Limit Set")
          .setDescription(
            limit === 0
              ? "Your channels will be **unlimited** by default."
              : `Your channels will have a limit of **${limit}** users by default.`
          )
          .setTimestamp(),
      ],
      ephemeral: true,
    });
    return;
  }

  if (sub === "setbitrate") {
    const kbps = interaction.options.getInteger("kbps", true);
    const maxBitrate =
      guild.premiumTier === 3 ? 384 : guild.premiumTier === 2 ? 256 : guild.premiumTier === 1 ? 128 : 96;

    if (kbps > maxBitrate) {
      await interaction.reply({
        content: `❌ Your server's boost level supports a maximum of **${maxBitrate}kbps**.`,
        ephemeral: true,
      });
      return;
    }

    queries.upsertUserPreferences(user.id, guild.id, { default_bitrate: kbps * 1000 });

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(Colors.Green)
          .setTitle("✅ Default Bitrate Set")
          .setDescription(`Your channels will use **${kbps}kbps** by default.`)
          .setTimestamp(),
      ],
      ephemeral: true,
    });
    return;
  }

  if (sub === "preferences") {
    const prefs = queries.getUserPreferences(user.id, guild.id);
    const settings = queries.getGuildSettings(guild.id);

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(Colors.Blurple)
          .setTitle("⚙️ Your Preferences")
          .addFields(
            {
              name: "✏️ Default Name",
              value: prefs?.default_name ?? `*(${settings?.auto_name ? "auto from game activity" : "your display name + channel"})*`,
              inline: true,
            },
            {
              name: "👥 Default Limit",
              value: prefs?.default_limit != null ? (prefs.default_limit === 0 ? "Unlimited" : `${prefs.default_limit}`) : `*(server default: ${settings?.default_limit ?? 0} = ${settings?.default_limit ? settings.default_limit : "unlimited"})*`,
              inline: true,
            },
            {
              name: "🎵 Default Bitrate",
              value: `${Math.floor((prefs?.default_bitrate ?? settings?.default_bitrate ?? 64000) / 1000)}kbps`,
              inline: true,
            }
          )
          .setFooter({ text: "Use /vc setname, setlimit, setbitrate to update" })
          .setTimestamp(),
      ],
      ephemeral: true,
    });
    return;
  }

  if (sub === "reset") {
    queries.upsertUserPreferences(user.id, guild.id, {
      default_name: null,
      default_limit: 0,
      default_bitrate: 64000,
    });

    await interaction.reply({
      content: "✅ Your preferences have been reset to defaults.",
      ephemeral: true,
    });
  }
}
