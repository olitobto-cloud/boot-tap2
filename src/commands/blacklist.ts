import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  Colors,
} from "discord.js";
import { queries } from "../database/index.js";

export const data = new SlashCommandBuilder()
  .setName("blacklist")
  .setDescription("Manage users blocked from creating temporary channels")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand((sub) =>
    sub
      .setName("add")
      .setDescription("Block a user from creating temporary channels")
      .addUserOption((opt) =>
        opt.setName("user").setDescription("The user to block").setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("remove")
      .setDescription("Unblock a user")
      .addUserOption((opt) =>
        opt.setName("user").setDescription("The user to unblock").setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub.setName("list").setDescription("View all blacklisted users")
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const { guild } = interaction;
  if (!guild) return;

  const sub = interaction.options.getSubcommand();

  if (sub === "add") {
    const target = interaction.options.getUser("user", true);

    if (target.id === interaction.user.id) {
      await interaction.reply({ content: "❌ You can't blacklist yourself.", ephemeral: true });
      return;
    }
    if (target.bot) {
      await interaction.reply({ content: "❌ You can't blacklist a bot.", ephemeral: true });
      return;
    }

    if (queries.isBlacklisted(target.id, guild.id)) {
      await interaction.reply({
        content: `⚠️ <@${target.id}> is already blacklisted.`,
        ephemeral: true,
      });
      return;
    }

    queries.addBlacklist(target.id, guild.id);

    const existingChannel = queries.getTempChannelByOwner(target.id, guild.id);
    if (existingChannel) {
      const ch = guild.channels.cache.get(existingChannel.channel_id);
      if (ch) {
        await ch.delete("Owner blacklisted").catch(() => {});
        queries.deleteTempChannel(existingChannel.channel_id);
      }
    }

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(Colors.Red)
          .setTitle("🚫 User Blacklisted")
          .setDescription(`<@${target.id}> has been blacklisted from creating temporary channels.`)
          .addFields({ name: "Action taken", value: existingChannel ? "Their channel was also deleted." : "No active channel." })
          .setTimestamp(),
      ],
    });
    return;
  }

  if (sub === "remove") {
    const target = interaction.options.getUser("user", true);
    const removed = queries.removeBlacklist(target.id, guild.id);

    if (!removed) {
      await interaction.reply({
        content: `⚠️ <@${target.id}> is not blacklisted.`,
        ephemeral: true,
      });
      return;
    }

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(Colors.Green)
          .setTitle("✅ User Unblacklisted")
          .setDescription(`<@${target.id}> can now create temporary channels again.`)
          .setTimestamp(),
      ],
    });
    return;
  }

  if (sub === "list") {
    const list = queries.getBlacklist(guild.id);

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(Colors.Orange)
          .setTitle("🚫 Blacklisted Users")
          .setDescription(
            list.length
              ? list.map((id) => `<@${id}>`).join("\n")
              : "No users are currently blacklisted."
          )
          .setFooter({ text: `${list.length} user${list.length !== 1 ? "s" : ""} blacklisted` })
          .setTimestamp(),
      ],
      ephemeral: true,
    });
  }
}
