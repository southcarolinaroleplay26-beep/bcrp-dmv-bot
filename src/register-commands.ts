import "dotenv/config";
import { REST, Routes } from "discord.js";
import { commands } from "./commands.js";

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
if (!token || !clientId) throw new Error("DISCORD_TOKEN and CLIENT_ID are required to register commands.");

const rest = new REST({ version: "10" }).setToken(token);
const route = process.env.GUILD_ID ? Routes.applicationGuildCommands(clientId, process.env.GUILD_ID) : Routes.applicationCommands(clientId);
await rest.put(route, { body: commands });
console.log(`${commands.length} slash commands registered.`);