import "dotenv/config";
import { REST, Routes } from "discord.js";
import { commands } from "./commands/index.js";

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;

if (!token || !clientId) {
  console.error("❌ DISCORD_TOKEN and CLIENT_ID must be set in .env");
  process.exit(1);
}

const rest = new REST({ version: "10" }).setToken(token);

const commandData = [...commands.values()].map((cmd) => cmd.data.toJSON());

(async () => {
  try {
    console.log(`📡 Registering ${commandData.length} slash command(s)...`);

    const guildId = process.env.GUILD_ID;

    if (guildId) {
      // Guild-specific (instant, for testing)
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
        body: commandData,
      });
      console.log(`✅ Commands registered to guild ${guildId}`);
    } else {
      // Global (takes up to 1 hour)
      await rest.put(Routes.applicationCommands(clientId), {
        body: commandData,
      });
      console.log("✅ Commands registered globally (may take up to 1 hour)");
    }
  } catch (err) {
    console.error("❌ Failed to register commands:", err);
    process.exit(1);
  }
})();
