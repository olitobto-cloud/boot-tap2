import fs from "fs";
import path from "path";

const dbPath = process.env.DATABASE_PATH || "./data/bot.db.json";
const dir = path.dirname(dbPath);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GuildSettings {
  guild_id: string;
  jtc_channel_id: string | null;
  jtc_category_id: string | null;
  control_channel_id: string | null;
  log_channel_id: string | null;
  default_limit: number;
  default_bitrate: number;
  ghost_mode: boolean;     // auto-hide when locked
  auto_name: boolean;      // name channel after owner's game
  cooldown_seconds: number;
  max_channels: number;    // max simultaneous channels per guild (0 = unlimited)
  created_at: number;
}

export interface TempChannel {
  channel_id: string;
  guild_id: string;
  owner_id: string;
  panel_message_id: string | null;
  is_locked: number;
  is_hidden: number;
  user_limit: number;
  bitrate: number;
  permitted_users: string;  // JSON string[]
  rejected_users: string;   // JSON string[]
  created_at: number;
}

export interface UserPreferences {
  user_id: string;
  guild_id: string;
  default_name: string | null;
  default_limit: number;
  default_bitrate: number;
}

interface DbData {
  guildSettings: Record<string, GuildSettings>;
  tempChannels: Record<string, TempChannel>;
  userPreferences: Record<string, UserPreferences>;
  blacklist: Record<string, string[]>;     // guild_id → user_ids[]
  cooldowns: Record<string, number>;       // `userId:guildId` → unix timestamp
  channelStats: Record<string, GuildStats>; // guild_id → stats
}

export interface GuildStats {
  guild_id: string;
  total_created: number;
  total_deleted: number;
  peak_concurrent: number;
  last_activity: number;
}

// ─── DB helpers ───────────────────────────────────────────────────────────────

function loadDb(): DbData {
  if (!fs.existsSync(dbPath)) {
    return { guildSettings: {}, tempChannels: {}, userPreferences: {}, blacklist: {}, cooldowns: {}, channelStats: {} };
  }
  try {
    return JSON.parse(fs.readFileSync(dbPath, "utf8")) as DbData;
  } catch {
    return { guildSettings: {}, tempChannels: {}, userPreferences: {}, blacklist: {}, cooldowns: {}, channelStats: {} };
  }
}

function saveDb(data: DbData): void {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), "utf8");
}

const DEFAULT_GUILD_SETTINGS: Omit<GuildSettings, "guild_id" | "created_at"> = {
  jtc_channel_id: null,
  jtc_category_id: null,
  control_channel_id: null,
  log_channel_id: null,
  default_limit: 0,
  default_bitrate: 64000,
  ghost_mode: false,
  auto_name: false,
  cooldown_seconds: 5,
  max_channels: 0,
};

// ─── Queries ──────────────────────────────────────────────────────────────────

export const queries = {
  // Guild Settings
  getGuildSettings(guildId: string): GuildSettings | undefined {
    return loadDb().guildSettings[guildId];
  },

  upsertGuildSettings(guildId: string, updates: Partial<Omit<GuildSettings, "guild_id" | "created_at">>): void {
    const db = loadDb();
    const existing = db.guildSettings[guildId];
    db.guildSettings[guildId] = {
      ...DEFAULT_GUILD_SETTINGS,
      ...existing,
      ...updates,
      guild_id: guildId,
      created_at: existing?.created_at ?? Math.floor(Date.now() / 1000),
    };
    saveDb(db);
  },

  // Temp Channels
  getTempChannel(channelId: string): TempChannel | undefined {
    return loadDb().tempChannels[channelId];
  },

  getTempChannelByOwner(ownerId: string, guildId: string): TempChannel | undefined {
    const db = loadDb();
    return Object.values(db.tempChannels).find(
      (ch) => ch.owner_id === ownerId && ch.guild_id === guildId
    );
  },

  getAllGuildChannels(guildId: string): TempChannel[] {
    const db = loadDb();
    return Object.values(db.tempChannels).filter((ch) => ch.guild_id === guildId);
  },

  createTempChannel(channelId: string, guildId: string, ownerId: string, settings?: Partial<TempChannel>): void {
    const db = loadDb();
    const gs = db.guildSettings[guildId];
    db.tempChannels[channelId] = {
      channel_id: channelId,
      guild_id: guildId,
      owner_id: ownerId,
      panel_message_id: null,
      is_locked: 0,
      is_hidden: 0,
      user_limit: gs?.default_limit ?? 0,
      bitrate: gs?.default_bitrate ?? 64000,
      permitted_users: "[]",
      rejected_users: "[]",
      created_at: Math.floor(Date.now() / 1000),
      ...settings,
    };

    // Update stats
    const stats = db.channelStats[guildId] ?? { guild_id: guildId, total_created: 0, total_deleted: 0, peak_concurrent: 0, last_activity: 0 };
    stats.total_created++;
    const currentCount = Object.values(db.tempChannels).filter((ch) => ch.guild_id === guildId).length;
    if (currentCount > stats.peak_concurrent) stats.peak_concurrent = currentCount;
    stats.last_activity = Math.floor(Date.now() / 1000);
    db.channelStats[guildId] = stats;

    saveDb(db);
  },

  updateTempChannel(channelId: string, updates: Partial<Omit<TempChannel, "channel_id" | "guild_id" | "owner_id" | "created_at">>): void {
    const db = loadDb();
    const existing = db.tempChannels[channelId];
    if (!existing) return;
    db.tempChannels[channelId] = { ...existing, ...updates };
    saveDb(db);
  },

  updateTempChannelOwner(ownerId: string, channelId: string): void {
    const db = loadDb();
    const existing = db.tempChannels[channelId];
    if (!existing) return;
    db.tempChannels[channelId] = { ...existing, owner_id: ownerId };
    saveDb(db);
  },

  deleteTempChannel(channelId: string): void {
    const db = loadDb();
    const ch = db.tempChannels[channelId];
    if (ch) {
      const stats = db.channelStats[ch.guild_id];
      if (stats) {
        stats.total_deleted++;
        stats.last_activity = Math.floor(Date.now() / 1000);
      }
    }
    delete db.tempChannels[channelId];
    saveDb(db);
  },

  // User Preferences
  getUserPreferences(userId: string, guildId: string): UserPreferences | undefined {
    return loadDb().userPreferences[`${userId}:${guildId}`];
  },

  upsertUserPreferences(userId: string, guildId: string, updates: Partial<Omit<UserPreferences, "user_id" | "guild_id">>): void {
    const db = loadDb();
    const key = `${userId}:${guildId}`;
    const existing = db.userPreferences[key];
    const defaults: UserPreferences = { user_id: userId, guild_id: guildId, default_name: null, default_limit: 0, default_bitrate: 64000 };
    db.userPreferences[key] = Object.assign(defaults, existing ?? {}, updates, { user_id: userId, guild_id: guildId });
    saveDb(db);
  },

  // Blacklist
  isBlacklisted(userId: string, guildId: string): boolean {
    const db = loadDb();
    return (db.blacklist[guildId] ?? []).includes(userId);
  },

  getBlacklist(guildId: string): string[] {
    return loadDb().blacklist[guildId] ?? [];
  },

  addBlacklist(userId: string, guildId: string): void {
    const db = loadDb();
    if (!db.blacklist[guildId]) db.blacklist[guildId] = [];
    if (!db.blacklist[guildId].includes(userId)) db.blacklist[guildId].push(userId);
    saveDb(db);
  },

  removeBlacklist(userId: string, guildId: string): boolean {
    const db = loadDb();
    const list = db.blacklist[guildId] ?? [];
    const idx = list.indexOf(userId);
    if (idx === -1) return false;
    list.splice(idx, 1);
    db.blacklist[guildId] = list;
    saveDb(db);
    return true;
  },

  // Cooldowns
  getCooldown(userId: string, guildId: string): number {
    return loadDb().cooldowns[`${userId}:${guildId}`] ?? 0;
  },

  setCooldown(userId: string, guildId: string): void {
    const db = loadDb();
    db.cooldowns[`${userId}:${guildId}`] = Math.floor(Date.now() / 1000);
    saveDb(db);
  },

  // Stats
  getGuildStats(guildId: string): GuildStats | undefined {
    return loadDb().channelStats[guildId];
  },
};

export default queries;
