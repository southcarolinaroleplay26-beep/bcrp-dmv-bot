import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
} from "discord.js";
import { logEvent } from "./logging.js";

const openSupportId = "bcrp_support_open";
const claimSupportId = "bcrp_support_claim";
const closeSupportId = "bcrp_support_close";
const staffRoleId = process.env.STAFF_ROLE_ID;
const adminRoleId = process.env.STAFF_ADMIN_ROLE_ID;
const supportRoleId = process.env.SUPPORT_TEAM_ROLE_ID ?? "1553870869720203405";

export function supportPanel(): { embeds: EmbedBuilder[]; components: ActionRowBuilder<ButtonBuilder>[] } {
  return {
    embeds: [new EmbedBuilder()
      .setColor(0x1976d2)
      .setTitle("DMV Support Center")
      .setDescription("A private support desk for BCRP residents. Open a ticket for DMV services, server access, roleplay questions, or technical help.")
      .addFields(
        { name: "Before you open", value: "Have your appointment, vehicle, or license details ready when relevant." },
        { name: "Private by default", value: "Only you and the DMV Support team can see your ticket." },
        { name: "How it works", value: "Open a ticket, wait for a team member to claim it, then describe what you need." },
      )
      .setFooter({ text: "DMV Support | Department of Motor Vehicles" })
      .setTimestamp()],
    components: [new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(openSupportId).setLabel("Open DMV Support Ticket").setEmoji("📩").setStyle(ButtonStyle.Primary),
    )],
  };
}

function closeRow(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(claimSupportId).setLabel("Claim Ticket").setEmoji("🙋").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(closeSupportId).setLabel("Close Ticket").setEmoji("🔒").setStyle(ButtonStyle.Danger),
  );
}

export function ticketDetails(topic?: string | null): { ownerId: string; claimedBy?: string } | null {
  const parts = topic?.split(":") ?? [];
  if (parts[0] !== "support" || !parts[1]) return null;
  return { ownerId: parts[1], claimedBy: parts[2] === "claimed" ? parts[3] : undefined };
}

function hasStaffAccess(interaction: ButtonInteraction): boolean {
  const member = interaction.member;
  if (!member) return false;
  if ("permissions" in member && typeof member.permissions !== "string" && member.permissions.has(PermissionFlagsBits.ManageGuild)) return true;
  if (!("roles" in member) || typeof member.roles === "string" || !("cache" in member.roles)) return false;
  return Boolean((staffRoleId && member.roles.cache.has(staffRoleId)) || (adminRoleId && member.roles.cache.has(adminRoleId)) || member.roles.cache.has(supportRoleId));
}

export async function handleSupportInteraction(interaction: ButtonInteraction): Promise<boolean> {
  if (interaction.customId !== openSupportId && interaction.customId !== claimSupportId && interaction.customId !== closeSupportId) return false;
  if (!interaction.guild) {
    await interaction.reply({ content: "Support tickets can only be opened inside the BCRP server.", ephemeral: true });
    return true;
  }

  if (interaction.customId === closeSupportId) {
    if (!interaction.channel || interaction.channel.type !== ChannelType.GuildText) {
      await interaction.reply({ content: "This ticket channel is no longer available.", ephemeral: true });
      return true;
    }
    const ownerId = ticketDetails(interaction.channel.topic)?.ownerId ?? "";
    if (interaction.user.id !== ownerId && !hasStaffAccess(interaction)) {
      await interaction.reply({ content: "Only the ticket owner or DMV staff can close this ticket.", ephemeral: true });
      return true;
    }
    await interaction.reply({ content: "This ticket is being closed.", ephemeral: true });
    await logEvent(interaction.guild, "tickets", "Support Ticket Closed", `**Channel:** ${interaction.channel.name}\n**Closed by:** <@${interaction.user.id}>`, 0xc62828);
    await interaction.channel.delete("Support ticket closed");
    return true;
  }

  if (interaction.customId === claimSupportId) {
    if (!interaction.channel || interaction.channel.type !== ChannelType.GuildText) {
      await interaction.reply({ content: "This ticket channel is no longer available.", ephemeral: true });
      return true;
    }
    if (!hasStaffAccess(interaction)) {
      await interaction.reply({ content: "Only DMV Support staff can claim tickets.", ephemeral: true });
      return true;
    }
    const details = ticketDetails(interaction.channel.topic);
    if (!details) {
      await interaction.reply({ content: "This is not a valid DMV Support ticket.", ephemeral: true });
      return true;
    }
    if (details.claimedBy && details.claimedBy !== interaction.user.id) {
      await interaction.reply({ content: `This ticket is already claimed by <@${details.claimedBy}>.`, ephemeral: true });
      return true;
    }
    await interaction.channel.setTopic(`support:${details.ownerId}:claimed:${interaction.user.id}`);
    await interaction.reply({
      content: `<@${details.ownerId}>`,
      embeds: [new EmbedBuilder().setColor(0x2e7d32).setTitle("Ticket Claimed").setDescription(`This ticket is now being handled by <@${interaction.user.id}>.`).setFooter({ text: "DMV Support | Assigned representative" }).setTimestamp()],
      allowedMentions: { users: [details.ownerId] },
    });
    await logEvent(interaction.guild, "tickets", "Support Ticket Claimed", `**Channel:** ${interaction.channel.name}\n**Claimed by:** <@${interaction.user.id}>`, 0x2e7d32);
    return true;
  }

  const existing = interaction.guild.channels.cache.find((channel) => channel.type === ChannelType.GuildText && ticketDetails(channel.topic)?.ownerId === interaction.user.id);
  if (existing) {
    await interaction.reply({ content: `You already have an open ticket: ${existing}`, ephemeral: true });
    return true;
  }

  const permissionOverwrites = [
    { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
  ];
  for (const roleId of [staffRoleId, adminRoleId, supportRoleId]) {
    if (roleId) permissionOverwrites.push({ id: roleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] });
  }

  const ticket = await interaction.guild.channels.create({
    name: `dmv-support-${interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, "-").slice(0, 16)}`,
    type: ChannelType.GuildText,
    topic: `support:${interaction.user.id}`,
    parent: process.env.TICKET_CATEGORY_ID || undefined,
    permissionOverwrites,
  });
  await ticket.send({
    content: `<@&${supportRoleId}> <@${interaction.user.id}>`,
    embeds: [new EmbedBuilder().setColor(0x1976d2).setTitle("DMV Support Ticket Opened").setDescription("Thank you for contacting DMV Support. Please describe what you need help with, and a support team member will respond here.").addFields({ name: "Ticket owner", value: `<@${interaction.user.id}>` }, { name: "Next step", value: "A support team member will claim this ticket and introduce themselves." }).setFooter({ text: "DMV Support | Ticket intake" }).setTimestamp()],
    components: [closeRow()],
    allowedMentions: { roles: [supportRoleId], users: [interaction.user.id] },
  });
  await logEvent(interaction.guild, "tickets", "Support Ticket Opened", `**Channel:** ${ticket}\n**Opened by:** <@${interaction.user.id}>`, 0x2e7d32);
  await interaction.reply({ content: `Your private support ticket is ready: ${ticket}`, ephemeral: true });
  return true;
}

export { openSupportId, closeSupportId };