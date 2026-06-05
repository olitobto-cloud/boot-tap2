import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { buildHelpEmbed } from "../utils/panel.js";

export const data = new SlashCommandBuilder()
  .setName("help")
  .setDescription("Show all bot commands and how to use them");

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.reply({ embeds: [buildHelpEmbed()], ephemeral: true });
}
