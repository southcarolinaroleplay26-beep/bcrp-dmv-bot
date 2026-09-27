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
  "BCRP DMV Services | Vehicle Registration",
  "BCRP DMV Services | Driver Licensing",
  "BCRP DMV Services | Vehicle Inspections",
  "BCRP DMV Services | DMV Appointments",
  "BCRP DMV Services | Resident Services",
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
  console.log(`BCRP DMV Services online as ${readyClient.user.tag}`);
  console.log(`Loaded ${store.vehicles.length} vehicles, ${store.licenses.length} licenses, and ${store.appointments.length} appointments.`);
  void validateVerificationSetup(readyClient);
});

async function validateVerificationSetup(readyClient: Client<true>): Promise<void> {
  const guildId = process.env.GUILD_ID;
  const welcomeChannelId = process.env.WELCOME_CHANNEL_ID ?? "1553867583969824778";
  const residentRoleId = process.env.RESIDENT_ROLE_ID ?? "1553870910832771152";
  if (!guildId) {
    console.error("Verification setup incomplete: GUILD_ID is missing.");
    return;
  }
  const guild = await readyClient.guilds.fetch(guildId);
  const channel = await guild.channels.fetch(welcomeChannelId);
  const role = await guild.roles.fetch(residentRoleId);
  if (!channel || !channel.isTextBased() || !("send" in channel)) console.error(`Verification setup error: welcome channel ${welcomeChannelId} cannot receive messages.`);
  else console.log(`Verification welcome channel ready: #${"name" in channel ? channel.name : welcomeChannelId}`);
  if (!role) console.error(`Verification setup error: Resident role ${residentRoleId} was not found.`);
  else console.log(`Resident verification role ready: ${role.name}`);
}

client.on(Events.GuildMemberAdd, async (member) => {
  try {
    await sendWelcome(member);
    await logEvent(member.guild, "audit", "Member Joined", `<@${member.id}> joined BCRP and received a verification welcome message.`, 0x1976d2);
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