import "dotenv/config";
import {
  Client,
  GatewayIntentBits,
  Partials,
} from "discord.js";
import { handleReady } from "./events/ready.js";
import { handleVoiceStateUpdate } from "./events/voiceStateUpdate.js";
import { handleInteractionCreate } from "./events/interactionCreate.js";

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error("❌ DISCORD_TOKEN environment variable is not set!");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Channel],
});

client.once("ready", () => handleReady(client));

client.on("voiceStateUpdate", (oldState, newState) =>
  handleVoiceStateUpdate(client, oldState, newState).catch(console.error)
);

client.on("interactionCreate", (interaction) =>
  handleInteractionCreate(interaction).catch(console.error)
);

client.on("error", (err) => {
  console.error("Discord client error:", err);
});

process.on("unhandledRejection", (err) => {
  console.error("Unhandled rejection:", err);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
});

console.log("🚀 Starting Discord Temporary Channels Bot...");
client.login(token);
