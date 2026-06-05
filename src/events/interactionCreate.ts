import {
  ButtonInteraction,
  ChatInputCommandInteraction,
  Interaction,
  ModalSubmitInteraction,
} from "discord.js";
import { commands } from "../commands/index.js";
import { handleButton } from "../handlers/buttons.js";
import { handleModal } from "../handlers/modals.js";

export async function handleInteractionCreate(
  interaction: Interaction
): Promise<void> {
  if (interaction.isChatInputCommand()) {
    const command = commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction as ChatInputCommandInteraction);
    } catch (err) {
      console.error(`Error handling /${interaction.commandName}:`, err);
      const msg = {
        content: "❌ An error occurred while executing this command.",
        ephemeral: true,
      };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(msg);
      } else {
        await interaction.reply(msg);
      }
    }
    return;
  }

  if (interaction.isButton()) {
    try {
      await handleButton(interaction as ButtonInteraction);
    } catch (err) {
      console.error("Error handling button interaction:", err);
      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: "❌ An error occurred.",
            ephemeral: true,
          });
        }
      } catch {}
    }
    return;
  }

  if (interaction.isModalSubmit()) {
    try {
      await handleModal(interaction as ModalSubmitInteraction);
    } catch (err) {
      console.error("Error handling modal submission:", err);
      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: "❌ An error occurred.",
            ephemeral: true,
          });
        }
      } catch {}
    }
    return;
  }
}
