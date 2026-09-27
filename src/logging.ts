import { EmbedBuilder, Guild } from "discord.js";

export const logChannels = {
  appointments: process.env.APPOINTMENT_LOG_CHANNEL_ID ?? "1553894672030507009",
  audit: process.env.AUDIT_LOG_CHANNEL_ID ?? "1553870098266333258",
  bot: process.env.BOT_LOG_CHANNEL_ID ?? "1553870131271172286",
  tickets: process.env.TICKET_LOG_CHANNEL_ID ?? "1553870160043970570",
} as const;

export async function logEvent(
  guild: Guild | null,
  category: keyof typeof logChannels,
  title: string,
  description: string,
  color = 0x1976d2,
): Promise<void> {
  if (!guild) return;
  try {
    const channel = await guild.channels.fetch(logChannels[category]);
    if (!channel || !channel.isTextBased() || !("send" in channel)) return;
    await channel.send({
      embeds: [new EmbedBuilder().setColor(color).setTitle(title).setDescription(description).setTimestamp()],
      allowedMentions: { parse: [] },
    });
  } catch (error) {
    console.error(`Unable to write ${category} log:`, error);
  }
}