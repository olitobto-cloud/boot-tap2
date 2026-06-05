import {
  CategoryChannel,
  ChannelType,
  GuildMember,
  OverwriteType,
  PermissionFlagsBits,
  VoiceChannel,
} from "discord.js";
import { queries, TempChannel } from "../database/index.js";

export function getAutoName(member: GuildMember): string {
  const activity = member.presence?.activities?.find(
    (a) => a.type === 0 /* ActivityType.Playing */
  );
  if (activity?.name) return `${member.displayName} • ${activity.name}`;
  return `${member.displayName}'s Channel`;
}

export async function createTempChannel(
  member: GuildMember,
  category: CategoryChannel | null
): Promise<VoiceChannel> {
  const settings = queries.getGuildSettings(member.guild.id);
  const prefs = queries.getUserPreferences(member.id, member.guild.id);

  let channelName: string;
  if (settings?.auto_name) {
    channelName = getAutoName(member);
  } else {
    channelName = prefs?.default_name ?? `${member.displayName}'s Channel`;
  }

  const userLimit = prefs?.default_limit ?? settings?.default_limit ?? 0;
  const bitrate = prefs?.default_bitrate ?? settings?.default_bitrate ?? 64000;

  const channel = await member.guild.channels.create({
    name: channelName,
    type: ChannelType.GuildVoice,
    parent: category ?? undefined,
    userLimit,
    bitrate,
    permissionOverwrites: [
      {
        id: member.id,
        type: OverwriteType.Member,
        allow: [
          PermissionFlagsBits.Connect,
          PermissionFlagsBits.Speak,
          PermissionFlagsBits.ManageChannels,
          PermissionFlagsBits.MoveMembers,
          PermissionFlagsBits.MuteMembers,
          PermissionFlagsBits.DeafenMembers,
          PermissionFlagsBits.Stream,
          PermissionFlagsBits.UseVAD,
        ],
      },
    ],
  });

  return channel as VoiceChannel;
}

export async function applyLock(
  channel: VoiceChannel,
  lock: boolean
): Promise<void> {
  await channel.permissionOverwrites.edit(channel.guild.roles.everyone, {
    Connect: lock ? false : null,
  });
}

export async function applyHide(
  channel: VoiceChannel,
  hide: boolean
): Promise<void> {
  await channel.permissionOverwrites.edit(channel.guild.roles.everyone, {
    ViewChannel: hide ? false : null,
  });
}

export async function applyPermit(
  channel: VoiceChannel,
  userId: string
): Promise<void> {
  await channel.permissionOverwrites.edit(userId, {
    Connect: true,
    ViewChannel: true,
  });
}

export async function applyReject(
  channel: VoiceChannel,
  userId: string
): Promise<void> {
  const member = channel.members.get(userId);
  if (member) await member.voice.disconnect("Rejected by channel owner").catch(() => {});
  await channel.permissionOverwrites.edit(userId, {
    Connect: false,
    ViewChannel: false,
  });
}

export async function clearPermissions(channel: VoiceChannel, ownerId: string): Promise<void> {
  for (const [id, overwrite] of channel.permissionOverwrites.cache) {
    if (id !== channel.guild.roles.everyone.id && id !== ownerId) {
      await overwrite.delete().catch(() => {});
    }
  }
}

export function isChannelOwner(data: TempChannel, userId: string): boolean {
  return data.owner_id === userId;
}
