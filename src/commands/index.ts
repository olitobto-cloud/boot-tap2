import { Collection } from "discord.js";
import type { SlashCommandBuilder, SlashCommandSubcommandsOnlyBuilder } from "discord.js";
import * as setup from "./setup.js";
import * as panel from "./panel.js";
import * as blacklist from "./blacklist.js";
import * as vc from "./vc.js";
import * as admin from "./admin.js";
import * as stats from "./stats.js";
import * as help from "./help.js";

export interface Command {
  data: SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder;
  execute: (interaction: any) => Promise<void>;
}

export const commands = new Collection<string, Command>();

const commandList: Command[] = [setup, panel, blacklist, vc, admin, stats, help];

for (const command of commandList) {
  commands.set(command.data.name, command);
}
