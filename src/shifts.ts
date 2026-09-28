import { ChatInputCommandInteraction, EmbedBuilder, User } from "discord.js";
import { logEvent } from "./logging.js";
import { saveStore, Shift, Store } from "./database.js";

export const SHIFT_MINIMUM_MS = 90 * 60 * 1000;

function weekKey(date = new Date()): string {
  const value = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = value.getUTCDay() || 7;
  value.setUTCDate(value.getUTCDate() - day + 1);
  return value.toISOString().slice(0, 10);
}

function currentShift(store: Store, userId: string, userTag: string): Shift {
  const week = weekKey();
  let shift = store.shifts.find((item) => item.userId === userId && item.week === week);
  if (!shift) {
    shift = { userId, userTag, week, totalMs: 0, updatedAt: new Date().toISOString() };
    store.shifts.push(shift);
  }
  shift.userTag = userTag;
  return shift;
}

function elapsed(shift: Shift): number {
  return shift.totalMs + (shift.activeSince ? Date.now() - Date.parse(shift.activeSince) : 0);
}

function duration(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function shiftEmbed(title: string, description: string, color = 0x1976d2): EmbedBuilder {
  return new EmbedBuilder().setColor(color).setTitle(title).setDescription(description).setFooter({ text: "BCRP DMV Services | Weekly Shift Management" }).setTimestamp();
}

async function dm(user: User, title: string, description: string, color: number): Promise<void> {
  try { await user.send({ embeds: [shiftEmbed(title, description, color)] }); } catch { /* DMs may be disabled. */ }
}

export async function handleShiftCommand(interaction: ChatInputCommandInteraction, store: Store, isStaff: boolean, isAdmin: boolean): Promise<void> {
  const action = interaction.options.getSubcommand();
  if (["start", "end"].includes(action) && !isStaff) { await interaction.reply({ content: "Only DMV staff can manage shifts.", ephemeral: true }); return; }
  if (["leaderboard"].includes(action) && !isStaff) { await interaction.reply({ content: "Only DMV staff can view the shift leaderboard.", ephemeral: true }); return; }
  if (action === "review" && !isAdmin) { await interaction.reply({ content: "Only DMV administrators can run the weekly shift review.", ephemeral: true }); return; }

  const shift = currentShift(store, interaction.user.id, interaction.user.tag);
  if (action === "start") {
    if (shift.activeSince) { await interaction.reply({ content: `You are already clocked in. Current total: **${duration(elapsed(shift))}**.`, ephemeral: true }); return; }
    shift.activeSince = new Date().toISOString(); shift.updatedAt = new Date().toISOString(); await saveStore(store);
    await logEvent(interaction.guild, "audit", "Shift Started", `**Staff:** <@${interaction.user.id}>`, 0x2e7d32);
    await interaction.reply({ embeds: [shiftEmbed("Shift Started", `You are now clocked in.\n\n**Weekly requirement:** 1h 30m\n**Current total:** ${duration(elapsed(shift))}`)] });
  } else if (action === "end") {
    if (!shift.activeSince) { await interaction.reply({ content: "You are not currently clocked in.", ephemeral: true }); return; }
    shift.totalMs = elapsed(shift); shift.activeSince = undefined; shift.updatedAt = new Date().toISOString(); await saveStore(store);
    await logEvent(interaction.guild, "audit", "Shift Ended", `**Staff:** <@${interaction.user.id}>\n**Weekly total:** ${duration(shift.totalMs)}`, 0x1976d2);
    await interaction.reply({ embeds: [shiftEmbed("Shift Ended", `Your shift has been recorded.\n\n**This week:** ${duration(shift.totalMs)}\n**Remaining:** ${duration(Math.max(0, SHIFT_MINIMUM_MS - shift.totalMs))}`)] });
  } else if (action === "status") {
    await interaction.reply({ embeds: [shiftEmbed("Your Weekly Shift Status", `**Week beginning:** ${shift.week}\n**Total:** ${duration(elapsed(shift))}\n**Required:** 1h 30m\n**Status:** ${elapsed(shift) >= SHIFT_MINIMUM_MS ? "Requirement met" : "Below requirement"}${shift.activeSince ? "\n**Clock:** Active" : ""}`, elapsed(shift) >= SHIFT_MINIMUM_MS ? 0x2e7d32 : 0xff8f00)] });
  } else if (action === "leaderboard") {
    const week = weekKey(); const rows = store.shifts.filter((item) => item.week === week).sort((a, b) => elapsed(b) - elapsed(a));
    await interaction.reply({ embeds: [shiftEmbed("Weekly DMV Shift Leaderboard", rows.length ? rows.map((item, index) => `**${index + 1}.** <@${item.userId}> | ${duration(elapsed(item))} | ${elapsed(item) >= SHIFT_MINIMUM_MS ? "Met" : "Incomplete"}`).join("\n") : "No shifts have been recorded this week.")] });
  } else {
    const week = weekKey(); const tracked = store.shifts.filter((item) => item.week === week);
    let incomplete = 0;
    for (const item of tracked) {
      if (elapsed(item) >= SHIFT_MINIMUM_MS) continue;
      incomplete += 1;
      const user = await interaction.client.users.fetch(item.userId);
      await dm(user, "Weekly Shift Requirement Not Met", `Your recorded DMV shift time for the week beginning **${week}** is **${duration(elapsed(item))}**. The required minimum is **1h 30m**.\n\nThis is an official attendance notice. Please contact DMV administration if you believe this record is incorrect.`, 0xc62828);
    }
    await logEvent(interaction.guild, "audit", "Weekly Shift Review Completed", `**Reviewed by:** <@${interaction.user.id}>\n**Incomplete staff records:** ${incomplete}`, incomplete ? 0xff8f00 : 0x2e7d32);
    await interaction.reply({ embeds: [shiftEmbed("Weekly Shift Review Complete", `**Week beginning:** ${week}\n**Records reviewed:** ${tracked.length}\n**Below requirement:** ${incomplete}\n\nIncomplete staff members were sent a private attendance notice.`)] });
  }
}

export { weekKey, duration };