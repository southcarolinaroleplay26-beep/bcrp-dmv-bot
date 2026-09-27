import "dotenv/config";
import { ActivityType, Client, Events, GatewayIntentBits, Partials } from "discord.js";
import { handleApplicationButton, handleApplicationMessage, handleApplicationReviewButton, handleApplicationReviewModal } from "./applications.js";
import { handleCommand } from "./commands.js";
import { loadStore } from "./database.js";
import { logEvent } from "./logging.js";
import { handleSupportInteraction } from "./support.js";
import { handleVerification, sendWelcome } from "./verification.js";

const token = process.env.DISCORD_TOKEN;
if (!token) throw new Error("DISCORD_TOKEN is missing. Copy .env.example to .env and add your bot token.");

const store = await loadStore();
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.DirectMessages, GatewayIntentBits.MessageContent],
  partials: [Partials.Channel],
});
const statusMessages = [
  "BCRP DMV | Vehicle Registration",
  "BCRP DMV | Driver Licensing",
  "BCRP DMV | Vehicle Inspections",
  "BCRP DMV | DMV Appointments",
  "BCRP DMV | Resident Services",
];
let statusIndex = 0;

function updateStatus(): void {
  client.user?.setPresence({
    activities: [{ name: statusMessages[statusIndex], type: ActivityType.Watching }],
    status: "online",
  });
  statusIndex = (statusIndex + 1) % statusMessages.length;
}

client.once(Events.ClientReady, (readyClient) => {
  updateStatus();
  setInterval(updateStatus, 30_000);
  console.log(`BCRP DMV bot online as ${readyClient.user.tag}`);
  console.log(`Loaded ${store.vehicles.length} vehicles, ${store.licenses.length} licenses, and ${store.appointments.length} appointments.`);
});

client.on(Events.GuildMemberAdd, async (member) => {
  try {
    await sendWelcome(member);
    await logEvent(member.guild, "audit", "Member Joined", `<@${member.id}> joined BCRP and received a verification welcome.`, 0x1976d2);
  } catch (error) {
    console.error("Unable to send welcome message:", error);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isModalSubmit()) {
      if (await handleApplicationReviewModal(interaction, client)) return;
    }
    if (interaction.isButton()) {
      if (await handleApplicationReviewButton(interaction)) return;
      if (await handleApplicationButton(interaction, client)) return;
      if (await handleSupportInteraction(interaction)) {
        void logEvent(interaction.guild, "bot", "Support Button Used", `**User:** <@${interaction.user.id}>\n**Action:** ${interaction.customId}`, 0x1976d2);
        return;
      }
      await handleVerification(interaction);
      void logEvent(interaction.guild, "bot", "Verification Button Used", `**User:** <@${interaction.user.id}>`, 0x2e7d32);
      return;
    }
    if (!interaction.isChatInputCommand()) return;
    void logEvent(interaction.guild, "bot", "Command Used", `**User:** <@${interaction.user.id}>\n**Command:** /${interaction.commandName}`, 0x1976d2);
    await handleCommand(interaction, store);
  } catch (error) {
    console.error(error);
    if (!interaction.isRepliable()) return;
    const response = { content: "The DMV system encountered an error. Please try again.", ephemeral: true };
    if (interaction.replied || interaction.deferred) await interaction.followUp(response);
    else await interaction.reply(response);
  }
});

client.on(Events.MessageCreate, async (message) => {
  try {
    await handleApplicationMessage(message, client);
  } catch (error) {
    console.error("Unable to process application response:", error);
  }
});

client.login(token);