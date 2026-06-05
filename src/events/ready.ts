import { Client } from "discord.js";

export function handleReady(client: Client): void {
  console.log(`✅ Logged in as ${client.user?.tag}`);
  console.log(`📡 Serving ${client.guilds.cache.size} guilds`);

  client.user?.setPresence({
    activities: [
      {
        name: "🎙️ Creating Temp Channels",
        type: 0,
      },
    ],
    status: "online",
  });
}
