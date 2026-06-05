import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  VoiceChannel,
  Colors,
} from "discord.js";
import { TempChannel, GuildSettings } from "../database/index.js";

export function buildControlPanel(
  channel: VoiceChannel,
  data: TempChannel,
  settings?: GuildSettings
): {
  embeds: EmbedBuilder[];
  components: ActionRowBuilder<ButtonBuilder>[];
} {
  const isLocked = data.is_locked === 1;
  const isHidden = data.is_hidden === 1;
  const userLimit = data.user_limit;
  const memberCount = channel.members.size;
  const bitrate = Math.floor(data.bitrate / 1000);

  const statusParts: string[] = [];
  if (isLocked) statusParts.push("🔒 Locked");
  if (isHidden) statusParts.push("🌑 Hidden");
  if (!isLocked && !isHidden) statusParts.push("🟢 Open");

  const embed = new EmbedBuilder()
    .setColor(isLocked ? Colors.Orange : Colors.Blurple)
    .setAuthor({ name: "🎙️ Temporary Channel Control Panel" })
    .setTitle(channel.name)
    .setDescription(
      [
        `> 👑 **Owner:** <@${data.owner_id}>`,
        `> 👥 **Members:** **${memberCount}${userLimit ? `/${userLimit}` : ""}**  •  🎵 **${bitrate}kbps**`,
        `> ${statusParts.join("  •  ")}`,
      ].join("\n")
    )
    .addFields(
      {
        name: "⏱️ Created",
        value: `<t:${data.created_at}:R>`,
        inline: true,
      },
      {
        name: "🔐 Permitted",
        value: `${(JSON.parse(data.permitted_users || "[]") as string[]).length} users`,
        inline: true,
      },
      {
        name: "🚫 Rejected",
        value: `${(JSON.parse(data.rejected_users || "[]") as string[]).length} users`,
        inline: true,
      }
    )
    .setFooter({ text: "Only the channel owner can use these controls" })
    .setTimestamp();

  // Row 1 — Lock, Hide, Rename, Limit, Bitrate
  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("vc_lock")
      .setLabel(isLocked ? "Unlock" : "Lock")
      .setEmoji(isLocked ? "🔓" : "🔒")
      .setStyle(isLocked ? ButtonStyle.Success : ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId("vc_hide")
      .setLabel(isHidden ? "Show" : "Hide")
      .setEmoji(isHidden ? "👁️" : "🌑")
      .setStyle(isHidden ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("vc_rename")
      .setLabel("Rename")
      .setEmoji("✏️")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("vc_limit")
      .setLabel("Limit")
      .setEmoji("👥")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("vc_bitrate")
      .setLabel("Bitrate")
      .setEmoji("🎵")
      .setStyle(ButtonStyle.Primary)
  );

  // Row 2 — Permit, Reject, Kick, Transfer, Claim
  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("vc_permit")
      .setLabel("Permit")
      .setEmoji("✅")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("vc_reject")
      .setLabel("Reject")
      .setEmoji("⛔")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId("vc_kick")
      .setLabel("Kick")
      .setEmoji("👢")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId("vc_transfer")
      .setLabel("Transfer")
      .setEmoji("👑")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("vc_claim")
      .setLabel("Claim")
      .setEmoji("🏳️")
      .setStyle(ButtonStyle.Secondary)
  );

  // Row 3 — Invite, Clear Perms, Info, Delete
  const row3 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("vc_invite")
      .setLabel("Invite Link")
      .setEmoji("🔗")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("vc_clear")
      .setLabel("Clear Perms")
      .setEmoji("🧹")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("vc_info")
      .setLabel("Info")
      .setEmoji("ℹ️")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("vc_delete")
      .setLabel("Delete")
      .setEmoji("🗑️")
      .setStyle(ButtonStyle.Danger)
  );

  return { embeds: [embed], components: [row1, row2, row3] };
}

export function buildSetupEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(Colors.Green)
    .setTitle("✅ Setup Complete!")
    .setDescription(
      "The **Join To Create** system is now active!\n\n" +
        "**How it works:**\n" +
        "1. Join the **➕ Join To Create** voice channel\n" +
        "2. A personal channel is created just for you\n" +
        "3. Your control panel appears in the controls channel\n" +
        "4. The channel auto-deletes when everyone leaves"
    )
    .setFooter({ text: "Use /setup info to view configuration" })
    .setTimestamp();
}

export function buildInfoEmbed(channel: VoiceChannel, data: TempChannel): EmbedBuilder {
  const permittedUsers: string[] = JSON.parse(data.permitted_users || "[]");
  const rejectedUsers: string[] = JSON.parse(data.rejected_users || "[]");

  return new EmbedBuilder()
    .setColor(Colors.Blurple)
    .setTitle(`ℹ️ ${channel.name}`)
    .addFields(
      { name: "👑 Owner", value: `<@${data.owner_id}>`, inline: true },
      { name: "🔒 Locked", value: data.is_locked ? "Yes" : "No", inline: true },
      { name: "👁️ Hidden", value: data.is_hidden ? "Yes" : "No", inline: true },
      { name: "👥 Members", value: `${channel.members.size}${data.user_limit ? `/${data.user_limit}` : ""}`, inline: true },
      { name: "🎵 Bitrate", value: `${Math.floor(data.bitrate / 1000)}kbps`, inline: true },
      { name: "📅 Created", value: `<t:${data.created_at}:R>`, inline: true },
      {
        name: "✅ Permitted Users",
        value: permittedUsers.length ? permittedUsers.map((id) => `<@${id}>`).join(", ") : "None",
      },
      {
        name: "⛔ Rejected Users",
        value: rejectedUsers.length ? rejectedUsers.map((id) => `<@${id}>`).join(", ") : "None",
      }
    )
    .setTimestamp();
}

export function buildHelpEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(Colors.Blurple)
    .setTitle("🎙️ Temporary Channels Bot — Help")
    .setDescription("A full-featured **Join To Create** bot for Discord.")
    .addFields(
      {
        name: "🔧 Setup (Admin)",
        value: [
          "`/setup create` — Auto-create all channels",
          "`/setup manual` — Link existing channels",
          "`/setup config` — Configure advanced settings",
          "`/setup info` — View current configuration",
          "`/setup reset` — Reset configuration",
        ].join("\n"),
      },
      {
        name: "🎛️ Channel Controls (Panel Buttons)",
        value: [
          "**🔒 Lock / 🔓 Unlock** — Toggle who can join",
          "**🌑 Hide / 👁️ Show** — Toggle visibility",
          "**✏️ Rename** — Rename your channel",
          "**👥 Limit** — Set member cap (0 = unlimited)",
          "**🎵 Bitrate** — Adjust audio quality",
          "**✅ Permit** — Allow a specific user",
          "**⛔ Reject** — Block & remove a user",
          "**👢 Kick** — Remove a user from channel",
          "**👑 Transfer** — Give ownership to another",
          "**🏳️ Claim** — Take ownership if owner left",
          "**🔗 Invite Link** — Generate a channel invite",
          "**🧹 Clear Perms** — Reset all permission overrides",
          "**ℹ️ Info** — Show channel details",
          "**🗑️ Delete** — Delete your channel immediately",
        ].join("\n"),
      },
      {
        name: "⚙️ My Preferences",
        value: [
          "`/vc setname <name>` — Set your default channel name",
          "`/vc setlimit <n>` — Set your default user limit",
          "`/vc setbitrate <n>` — Set your default bitrate",
          "`/vc preferences` — View your saved preferences",
          "`/vc reset` — Reset all your preferences",
          "`/panel` — Resend your control panel",
        ].join("\n"),
      },
      {
        name: "🛡️ Admin Commands",
        value: [
          "`/admin channels` — List all active temp channels",
          "`/admin delete <channel>` — Force-delete a temp channel",
          "`/admin transfer <channel> <user>` — Force-transfer ownership",
          "`/admin info <channel>` — View a channel's details",
          "`/blacklist add <user>` — Block user from creating channels",
          "`/blacklist remove <user>` — Unblock a user",
          "`/blacklist list` — View all blacklisted users",
          "`/stats` — View server temp channel statistics",
        ].join("\n"),
      }
    )
    .setFooter({ text: "Join the JTC channel to get started!" })
    .setTimestamp();
}
