import {
  ChatInputCommandInteraction,
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  User,
} from "discord.js";
import { makeId, saveStore, Store } from "./database.js";
import { applicationPanel } from "./applications.js";
import { logEvent } from "./logging.js";
import { supportPanel, ticketDetails } from "./support.js";

const appointmentChannelId = process.env.APPOINTMENT_CHANNEL_ID ?? "1553893891944484864";
const dmvStaffRoleId = process.env.DMV_STAFF_ROLE_ID ?? "1553870746629967942";
const supportTeamRoleId = process.env.SUPPORT_TEAM_ROLE_ID ?? "1553870869720203405";

export const commands = [
  new SlashCommandBuilder().setName("help").setDescription("Show BCRP DMV commands"),
  new SlashCommandBuilder().setName("ping").setDescription("Check whether the DMV bot is online"),
  new SlashCommandBuilder().setName("userinfo").setDescription("View basic server user information")
    .addUserOption((o) => o.setName("citizen").setDescription("Citizen to view").setRequired(false)),
  new SlashCommandBuilder().setName("say").setDescription("Send a message as the DMV bot (staff only)")
    .addStringOption((o) => o.setName("message").setDescription("Message to send").setMaxLength(2000).setRequired(true)),
  new SlashCommandBuilder().setName("announce").setDescription("Send an official DMV announcement (supervisor only)")
    .addStringOption((o) => o.setName("title").setDescription("Announcement title").setMaxLength(256).setRequired(true))
    .addStringOption((o) => o.setName("message").setDescription("Announcement message").setMaxLength(4000).setRequired(true)),
  new SlashCommandBuilder().setName("dmv-info").setDescription("Manage official DMV information embeds (supervisor only)")
    .addSubcommand((sub) => sub.setName("send").setDescription("Send an official DMV information or rules embed")
      .addStringOption((o) => o.setName("type").setDescription("Embed to send").setRequired(true).addChoices({ name: "DMV Information", value: "info" }, { name: "Server Rules", value: "rules" })))
    .addSubcommand((sub) => sub.setName("edit").setDescription("Edit an existing DMV information or rules embed")
      .addStringOption((o) => o.setName("message-id").setDescription("ID of the embed message to edit").setRequired(true))
      .addStringOption((o) => o.setName("type").setDescription("Template to apply").setRequired(true).addChoices({ name: "DMV Information", value: "info" }, { name: "Server Rules", value: "rules" }))),
  new SlashCommandBuilder().setName("support-panel").setDescription("Post the DMV Support panel (supervisor only)"),
  new SlashCommandBuilder().setName("application-panel").setDescription("Post the DMV application panel (admin only)"),
  new SlashCommandBuilder().setName("add").setDescription("Add a member to the current DMV Support ticket")
    .addUserOption((o) => o.setName("member").setDescription("Member who should access this ticket").setRequired(true)),
  new SlashCommandBuilder().setName("unclaim").setDescription("Release the current claim on this DMV Support ticket"),
  new SlashCommandBuilder().setName("greet").setDescription("Introduce the assigned support representative in a ticket")
    .addStringOption((o) => o.setName("username").setDescription("Your support display name").setMaxLength(80).setRequired(true)),
  new SlashCommandBuilder().setName("vehicle").setDescription("Manage your DMV vehicle records")
    .addSubcommand((sub) => sub.setName("add").setDescription("Register a vehicle")
      .addStringOption((o) => o.setName("plate").setDescription("License plate").setRequired(true))
      .addStringOption((o) => o.setName("make").setDescription("Vehicle make").setRequired(true))
      .addStringOption((o) => o.setName("model").setDescription("Vehicle model").setRequired(true))
      .addIntegerOption((o) => o.setName("year").setDescription("Model year").setMinValue(1886).setMaxValue(2100).setRequired(true))
      .addStringOption((o) => o.setName("color").setDescription("Vehicle color").setRequired(true)))
    .addSubcommand((sub) => sub.setName("list").setDescription("List your registered vehicles"))
    .addSubcommand((sub) => sub.setName("remove").setDescription("Remove one of your vehicles")
      .addStringOption((o) => o.setName("plate").setDescription("License plate").setRequired(true)))
    .addSubcommand((sub) => sub.setName("transfer").setDescription("Transfer a vehicle to another citizen")
      .addStringOption((o) => o.setName("plate").setDescription("License plate").setRequired(true))
      .addUserOption((o) => o.setName("citizen").setDescription("New owner").setRequired(true))),
  new SlashCommandBuilder().setName("license").setDescription("Manage driver licenses")
    .addSubcommand((sub) => sub.setName("show").setDescription("Show your driver license"))
    .addSubcommand((sub) => sub.setName("issue").setDescription("Issue or renew a license (staff only)")
      .addUserOption((o) => o.setName("citizen").setDescription("Citizen receiving the license").setRequired(true))
      .addStringOption((o) => o.setName("name").setDescription("Legal name").setRequired(true))
      .addStringOption((o) => o.setName("class").setDescription("License class, such as C or M").setRequired(true))
      .addStringOption((o) => o.setName("expires").setDescription("Expiry date, YYYY-MM-DD").setRequired(true)))
    .addSubcommand((sub) => sub.setName("suspend").setDescription("Suspend a license (staff only)")
      .addUserOption((o) => o.setName("citizen").setDescription("Citizen").setRequired(true)))
    .addSubcommand((sub) => sub.setName("revoke").setDescription("Revoke a license permanently (staff only)")
      .addUserOption((o) => o.setName("citizen").setDescription("Citizen").setRequired(true))),
  new SlashCommandBuilder().setName("inspection").setDescription("Record a vehicle inspection (staff only)")
    .addStringOption((o) => o.setName("plate").setDescription("License plate").setRequired(true))
    .addStringOption((o) => o.setName("result").setDescription("Inspection result").setRequired(true).addChoices({ name: "Passed", value: "passed" }, { name: "Failed", value: "failed" }))
    .addStringOption((o) => o.setName("notes").setDescription("Inspection notes").setRequired(true)),
  new SlashCommandBuilder().setName("inspection-history").setDescription("View inspection history (staff only)")
    .addStringOption((o) => o.setName("plate").setDescription("License plate").setRequired(true)),
  new SlashCommandBuilder().setName("appointment").setDescription("Manage DMV appointments")
    .addSubcommand((sub) => sub.setName("book").setDescription("Book a DMV appointment")
      .addStringOption((o) => o.setName("service").setDescription("Service needed").setRequired(true))
      .addStringOption((o) => o.setName("date").setDescription("Date and time, YYYY-MM-DD HH:MM").setRequired(true))
      .addStringOption((o) => o.setName("notes").setDescription("Optional notes").setRequired(false)))
    .addSubcommand((sub) => sub.setName("list").setDescription("List your appointments"))
    .addSubcommand((sub) => sub.setName("cancel").setDescription("Cancel an appointment")
      .addStringOption((o) => o.setName("id").setDescription("Appointment ID").setRequired(true)))
    .addSubcommand((sub) => sub.setName("staff-list").setDescription("List all active appointments (staff only)"))
    .addSubcommand((sub) => sub.setName("complete").setDescription("Complete an appointment (staff only)")
      .addStringOption((o) => o.setName("id").setDescription("Appointment ID").setRequired(true))),
  new SlashCommandBuilder().setName("lookup").setDescription("Look up a public DMV record (staff only)")
    .addStringOption((o) => o.setName("plate").setDescription("License plate").setRequired(true)),
].map((command) => command.toJSON());

function staffOnly(interaction: ChatInputCommandInteraction): boolean {
  const roleId = process.env.STAFF_ROLE_ID;
  const member = interaction.member;
  if (!member) return false;
  return Boolean(roleId && "roles" in member && typeof member.roles !== "string" && "cache" in member.roles && member.roles.cache.has(roleId));
}

function staffAdminOnly(interaction: ChatInputCommandInteraction): boolean {
  const member = interaction.member;
  if (!member) return false;
  if ("permissions" in member && typeof member.permissions !== "string" && member.permissions.has(PermissionFlagsBits.ManageGuild)) return true;
  const roleId = process.env.STAFF_ADMIN_ROLE_ID;
  return Boolean(roleId && "roles" in member && typeof member.roles !== "string" && "cache" in member.roles && member.roles.cache.has(roleId));
}

function embed(title: string, description: string): EmbedBuilder {
  return new EmbedBuilder().setColor(0x1976d2).setTitle(title).setDescription(description).setTimestamp();
}

async function notifyUser(user: User, title: string, description: string, color = 0x1976d2): Promise<void> {
  try {
    await user.send({ embeds: [embed(title, description).setColor(color).setFooter({ text: "BCRP Department of Motor Vehicles | Private notice" })] });
  } catch (error) {
    console.error(`Unable to DM DMV notice to ${user.id}:`, error);
    await logEvent(null, "bot", "DM Notification Failed", `**User ID:** ${user.id}\n**Notice:** ${title}`, 0xff8f00);
  }
}

function dmvInfoEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0x1976d2)
    .setTitle("BCRP Department of Motor Vehicles")
    .setDescription("Official DMV services for the BCRP community. Please use the commands below and keep all records in-character.")
    .addFields(
      { name: "Driver Licensing", value: "Apply for, renew, or check your driver license through DMV staff." },
      { name: "Vehicle Services", value: "Register vehicles, transfer ownership, request inspections, and maintain valid plates." },
      { name: "Appointments", value: "Use `/appointment book` to schedule a DMV visit and include the service you need." },
      { name: "Need Assistance?", value: "Contact a DMV staff member or supervisor through the appropriate server channel." },
    )
    .setFooter({ text: "BCRP DMV | Official Information" })
    .setTimestamp();
}

function rulesEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0xc62828)
    .setTitle("BCRP Server Rules")
    .setDescription("By remaining in BCRP, you agree to follow these standards. Staff decisions are final when maintaining server safety and roleplay quality.")
    .addFields(
      { name: "1. Respect", value: "Treat members and staff respectfully. Harassment, discrimination, and targeted abuse are not allowed." },
      { name: "2. Roleplay Standards", value: "Stay in character during roleplay and follow BCRP department procedures." },
      { name: "3. No Abuse", value: "Do not exploit bugs, spam commands, impersonate staff, or abuse verification and DMV systems." },
      { name: "4. Appropriate Content", value: "Keep usernames, profiles, messages, and media appropriate for the community." },
      { name: "5. Staff Direction", value: "Follow moderator instructions and use the proper channels for reports or appeals." },
    )
    .setFooter({ text: "BCRP | Community Standards" })
    .setTimestamp();
}

function officialEmbed(type: string): EmbedBuilder {
  return type === "rules" ? rulesEmbed() : dmvInfoEmbed();
}

async function notifyAppointment(interaction: ChatInputCommandInteraction, appointment: Store["appointments"][number]): Promise<void> {
  if (!interaction.guild) return;
  try {
    const channel = await interaction.guild.channels.fetch(appointmentChannelId);
    if (!channel || !channel.isTextBased() || !("send" in channel)) {
      console.error(`Appointment channel ${appointmentChannelId} is not available.`);
      return;
    }
    await channel.send({
      content: `<@&${dmvStaffRoleId}>`,
      embeds: [embed("New DMV Appointment Request", `**Citizen:** <@${appointment.userId}>\n**Service:** ${appointment.service}\n**Requested date:** ${appointment.date}\n**Appointment ID:** ${appointment.id}${appointment.notes ? `\n**Notes:** ${appointment.notes}` : ""}`)],
      allowedMentions: { roles: [dmvStaffRoleId], users: [appointment.userId] },
    });
  } catch (error) {
    console.error("Unable to notify DMV staff about appointment:", error);
  }
}

export async function handleCommand(interaction: ChatInputCommandInteraction, store: Store): Promise<void> {
  const { commandName } = interaction;
  if (commandName === "ping") {
    await interaction.reply(`DMV systems operational. Latency: ${interaction.client.ws.ping}ms.`);
    return;
  }
  if (commandName === "userinfo") {
    const citizen = interaction.options.getUser("citizen") ?? interaction.user;
    const member = interaction.guild?.members.cache.get(citizen.id);
    await interaction.reply({ embeds: [embed("Citizen Information", `**User:** ${citizen}\n**Account created:** <t:${Math.floor(citizen.createdTimestamp / 1000)}:D>\n**Joined server:** ${member?.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:D>` : "Not available"}`)] });
    return;
  }
  if (commandName === "say") {
    if (!staffAdminOnly(interaction)) { await interaction.reply({ content: "This command is restricted to DMV administrators.", ephemeral: true }); return; }
    const message = interaction.options.getString("message", true);
    await interaction.reply({ content: "Message sent.", ephemeral: true });
    if (interaction.channel && "send" in interaction.channel) await interaction.channel.send({ content: message, allowedMentions: { parse: [] } });
    return;
  }
  if (commandName === "announce") {
    if (!staffAdminOnly(interaction)) { await interaction.reply({ content: "Official announcements require DMV supervisors.", ephemeral: true }); return; }
    const title = interaction.options.getString("title", true);
    const message = interaction.options.getString("message", true);
    await interaction.reply({ content: "Announcement sent.", ephemeral: true });
    if (interaction.channel && "send" in interaction.channel) await interaction.channel.send({ embeds: [embed(`BCRP DMV | ${title}`, message)], allowedMentions: { parse: [] } });
    return;
  }
  if (commandName === "dmv-info") {
    if (!staffAdminOnly(interaction)) { await interaction.reply({ content: "Official information embeds require DMV supervisors.", ephemeral: true }); return; }
    if (!interaction.channel || !("send" in interaction.channel) || !("messages" in interaction.channel)) { await interaction.reply({ content: "This command must be used in a text channel.", ephemeral: true }); return; }
    const action = interaction.options.getSubcommand();
    const type = interaction.options.getString("type", true);
    if (action === "send") {
      const message = await interaction.channel.send({ embeds: [officialEmbed(type)], allowedMentions: { parse: [] } });
      await interaction.reply({ content: `Embed sent. Message ID: ${message.id}`, ephemeral: true });
    } else {
      const messageId = interaction.options.getString("message-id", true);
      const message = await interaction.channel.messages.fetch(messageId);
      await message.edit({ embeds: [officialEmbed(type)], allowedMentions: { parse: [] } });
      await interaction.reply({ content: "Embed updated successfully.", ephemeral: true });
    }
    return;
  }
  if (commandName === "support-panel") {
    if (!staffAdminOnly(interaction)) { await interaction.reply({ content: "The support panel requires DMV supervisors.", ephemeral: true }); return; }
    if (!interaction.channel || !interaction.channel.isTextBased() || !("send" in interaction.channel)) { await interaction.reply({ content: "This command must be used in a text channel.", ephemeral: true }); return; }
    await interaction.channel.send(supportPanel());
    await logEvent(interaction.guild, "bot", "Support Panel Published", `**Published by:** <@${interaction.user.id}>\n**Channel:** ${interaction.channel}`, 0x1976d2);
    await interaction.reply({ content: "Support panel published.", ephemeral: true });
    return;
  }
  if (commandName === "application-panel") {
    if (!staffAdminOnly(interaction)) { await interaction.reply({ content: "Only DMV administrators can publish the application panel.", ephemeral: true }); return; }
    if (!interaction.channel || !interaction.channel.isTextBased() || !("send" in interaction.channel)) { await interaction.reply({ content: "This command must be used in a text channel.", ephemeral: true }); return; }
    await interaction.channel.send(applicationPanel());
    await logEvent(interaction.guild, "bot", "Application Panel Published", `**Published by:** <@${interaction.user.id}>\n**Channel:** ${interaction.channel}`, 0x1976d2);
    await interaction.reply({ content: "Application panel published. Anyone can click the button to apply.", ephemeral: true });
    return;
  }
  if (commandName === "add") {
    if (!supportStaffOnly(interaction)) { await interaction.reply({ content: "Only DMV Support staff can add members to tickets.", ephemeral: true }); return; }
    if (!interaction.channel || interaction.channel.type !== ChannelType.GuildText) { await interaction.reply({ content: "Use `/add` inside a DMV Support ticket.", ephemeral: true }); return; }
    const details = ticketDetails(interaction.channel.topic);
    if (!details) { await interaction.reply({ content: "This is not a DMV Support ticket.", ephemeral: true }); return; }
    const member = interaction.options.getMember("member");
    if (!member || !("id" in member)) { await interaction.reply({ content: "That member could not be found in this server.", ephemeral: true }); return; }
    await interaction.channel.permissionOverwrites.edit(member.id, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true });
    await interaction.channel.send({ content: `<@${member.id}>`, embeds: [embed("Member Added to Ticket", `<@${member.id}> has been granted access to this DMV Support ticket by <@${interaction.user.id}>.`)], allowedMentions: { users: [member.id, interaction.user.id] } });
    await logEvent(interaction.guild, "tickets", "Member Added to Support Ticket", `**Ticket:** ${interaction.channel.name}\n**Member:** <@${member.id}>\n**Added by:** <@${interaction.user.id}>`, 0x1976d2);
    await interaction.reply({ content: `${member} can now view and respond in this ticket.`, ephemeral: true });
    return;
  }
  if (commandName === "unclaim") {
    if (!supportStaffOnly(interaction)) { await interaction.reply({ content: "Only DMV Support staff can unclaim tickets.", ephemeral: true }); return; }
    if (!interaction.channel || interaction.channel.type !== ChannelType.GuildText) { await interaction.reply({ content: "Use `/unclaim` inside a DMV Support ticket.", ephemeral: true }); return; }
    const details = ticketDetails(interaction.channel.topic);
    if (!details) { await interaction.reply({ content: "This is not a DMV Support ticket.", ephemeral: true }); return; }
    if (!details.claimedBy) { await interaction.reply({ content: "This ticket is not currently claimed.", ephemeral: true }); return; }
    if (details.claimedBy !== interaction.user.id && !staffAdminOnly(interaction)) { await interaction.reply({ content: "Only the assigned representative or a DMV administrator can unclaim this ticket.", ephemeral: true }); return; }
    await interaction.channel.setTopic(`support:${details.ownerId}`);
    await interaction.channel.send({ embeds: [embed("Ticket Unclaimed", "This ticket is available for another DMV Support representative to claim.")] });
    await logEvent(interaction.guild, "tickets", "Support Ticket Unclaimed", `**Ticket:** ${interaction.channel.name}\n**Unclaimed by:** <@${interaction.user.id}>`, 0xff8f00);
    await interaction.reply({ content: "Ticket unclaimed. Another support representative can claim it now.", ephemeral: true });
    return;
  }
  if (commandName === "greet") {
    if (!supportStaffOnly(interaction)) { await interaction.reply({ content: "Only DMV Support staff can use this command.", ephemeral: true }); return; }
    if (!interaction.channel || interaction.channel.type !== ChannelType.GuildText) { await interaction.reply({ content: "Use `/greet` inside a DMV Support ticket.", ephemeral: true }); return; }
    const details = ticketDetails(interaction.channel.topic);
    if (!details) { await interaction.reply({ content: "This is not a DMV Support ticket.", ephemeral: true }); return; }
    if (details.claimedBy !== interaction.user.id) { await interaction.reply({ content: "Claim this ticket before using `/greet`.", ephemeral: true }); return; }
    const username = interaction.options.getString("username", true).replace(/[`*_~<>]/g, "").trim();
    await interaction.reply({
      content: `<@${details.ownerId}>`,
      embeds: [embed("Welcome to DMV Support", `Hello <@${details.ownerId}>. My name is **${username}**, and I will be assisting you with your request today. Please share any details that will help us resolve this quickly.`).setColor(0x1976d2).setFooter({ text: `Signed by ${username} | DMV Support` })],
      allowedMentions: { users: [details.ownerId] },
    });
    await logEvent(interaction.guild, "tickets", "Support Representative Greeted Citizen", `**Ticket:** ${interaction.channel.name}\n**Representative:** <@${interaction.user.id}>\n**Display name:** ${username}`, 0x1976d2);
    return;
  }
  if (commandName === "help") {
    await interaction.reply({ embeds: [embed("BCRP Department of Motor Vehicles", "**Utility commands**\n`/ping` | `/userinfo`\n\n**Citizen commands**\n`/vehicle add|list|remove|transfer`\n`/license show`\n`/appointment book|list|cancel`\n\n**DMV Support commands**\n`/add @member` | `/unclaim` | `/greet username` inside a ticket\n\n**DMV staff commands**\n`/say`\n`/inspection`\n`/inspection-history`\n`/appointment staff-list|complete`\n`/lookup`\n\n**Supervisor commands**\n`/announce`\n`/license issue|suspend|revoke`\n`/support-panel`\n\nKeep all records in-character and follow BCRP server rules.")] });
    return;
  }
  if (commandName === "vehicle") {
    const action = interaction.options.getSubcommand();
    if (action === "add") {
      const plate = interaction.options.getString("plate", true).toUpperCase();
      if (store.vehicles.some((vehicle) => vehicle.plate === plate)) { await interaction.reply({ content: "That plate is already registered.", ephemeral: true }); return; }
      store.vehicles.push({ id: makeId("veh"), ownerId: interaction.user.id, ownerTag: interaction.user.tag, plate, make: interaction.options.getString("make", true), model: interaction.options.getString("model", true), color: interaction.options.getString("color", true), year: interaction.options.getInteger("year", true), status: "active", createdAt: new Date().toISOString() });
      await saveStore(store);
      await notifyUser(interaction.user, "Vehicle Registration Confirmed", `Your vehicle registration is complete.\n\n**Plate:** ${plate}\n**Vehicle:** ${interaction.options.getInteger("year", true)} ${interaction.options.getString("color", true)} ${interaction.options.getString("make", true)} ${interaction.options.getString("model", true)}\n**Status:** Active` , 0x2e7d32);
      await logEvent(interaction.guild, "audit", "Vehicle Registered", `**Plate:** ${plate}\n**Owner:** <@${interaction.user.id}>`, 0x2e7d32);
      await interaction.reply({ embeds: [embed("Vehicle Registered", `**${plate}** has been registered to ${interaction.user}.`)] });
    } else if (action === "list") {
      const vehicles = store.vehicles.filter((vehicle) => vehicle.ownerId === interaction.user.id);
      await interaction.reply({ embeds: [embed("Your Vehicles", vehicles.length ? vehicles.map((vehicle) => `**${vehicle.plate}** | ${vehicle.year} ${vehicle.color} ${vehicle.make} ${vehicle.model} | ${vehicle.status}`).join("\n") : "You have no registered vehicles.")] });
    } else if (action === "remove") {
      const plate = interaction.options.getString("plate", true).toUpperCase();
      const before = store.vehicles.length;
      store.vehicles = store.vehicles.filter((vehicle) => !(vehicle.ownerId === interaction.user.id && vehicle.plate === plate));
      if (before === store.vehicles.length) { await interaction.reply({ content: "You do not own a vehicle with that plate.", ephemeral: true }); return; }
      await saveStore(store); await notifyUser(interaction.user, "Vehicle Registration Removed", `Your vehicle record for **${plate}** has been removed from the DMV registry.`, 0xc62828); await logEvent(interaction.guild, "audit", "Vehicle Removed", `**Plate:** ${plate}\n**Owner:** <@${interaction.user.id}>`, 0xc62828); await interaction.reply(`Vehicle **${plate}** removed from your records.`);
    } else {
      const plate = interaction.options.getString("plate", true).toUpperCase();
      const vehicle = store.vehicles.find((item) => item.plate === plate && item.ownerId === interaction.user.id);
      const citizen = interaction.options.getUser("citizen", true);
      if (!vehicle) { await interaction.reply({ content: "You do not own a vehicle with that plate.", ephemeral: true }); return; }
      vehicle.ownerId = citizen.id;
      vehicle.ownerTag = citizen.tag;
      await saveStore(store);
      await notifyUser(citizen, "Vehicle Transfer Received", `A vehicle has been transferred to you.\n\n**Plate:** ${plate}\n**Vehicle:** ${vehicle.year} ${vehicle.color} ${vehicle.make} ${vehicle.model}\n**Status:** ${vehicle.status}`, 0xff8f00);
      await logEvent(interaction.guild, "audit", "Vehicle Transferred", `**Plate:** ${plate}\n**From:** <@${interaction.user.id}>\n**To:** <@${citizen.id}>`, 0xff8f00);
      await interaction.reply({ embeds: [embed("Vehicle Transferred", `**${plate}** has been transferred to ${citizen}.`)] });
    }
    return;
  }
  if (commandName === "license") {
    const action = interaction.options.getSubcommand();
    if (action === "show") {
      const license = store.licenses.find((item) => item.userId === interaction.user.id);
      await interaction.reply({ embeds: [embed("Driver License", license ? `**Name:** ${license.name}\n**Class:** ${license.className}\n**Expires:** ${license.expiresAt}\n**Status:** ${license.status}` : "No license record found.")] });
    } else {
      if (!staffAdminOnly(interaction)) { await interaction.reply({ content: "License issue and suspension require DMV supervisors.", ephemeral: true }); return; }
      const citizen = interaction.options.getUser("citizen", true);
      const existing = store.licenses.find((item) => item.userId === citizen.id);
      if (action === "issue") {
        const record = { userId: citizen.id, userTag: citizen.tag, name: interaction.options.getString("name", true), className: interaction.options.getString("class", true).toUpperCase(), expiresAt: interaction.options.getString("expires", true), status: "valid" as const, issuedAt: new Date().toISOString() };
        if (existing) Object.assign(existing, record); else store.licenses.push(record);
        await saveStore(store); await notifyUser(citizen, "Driver License Issued", `Your driver license has been issued or renewed.\n\n**Name:** ${record.name}\n**Class:** ${record.className}\n**Expires:** ${record.expiresAt}\n**Status:** Valid`, 0x2e7d32); await logEvent(interaction.guild, "audit", "License Issued", `**Citizen:** <@${citizen.id}>\n**Issued by:** <@${interaction.user.id}>`, 0x2e7d32); await interaction.reply({ embeds: [embed("License Issued", `License issued to ${citizen}.`)] });
      } else if (action === "suspend") {
        if (!existing) { await interaction.reply({ content: "No license record found for that citizen.", ephemeral: true }); return; }
        existing.status = "suspended"; await saveStore(store); await notifyUser(citizen, "Driver License Suspended", "Your driver license has been suspended by DMV staff. Please contact DMV Support if you need assistance.", 0xff8f00); await logEvent(interaction.guild, "audit", "License Suspended", `**Citizen:** <@${citizen.id}>\n**Suspended by:** <@${interaction.user.id}>`, 0xff8f00); await interaction.reply({ embeds: [embed("License Suspended", `License for ${citizen} has been suspended.`)] });
      } else {
        if (!existing) { await interaction.reply({ content: "No license record found for that citizen.", ephemeral: true }); return; }
        store.licenses = store.licenses.filter((item) => item.userId !== citizen.id);
        await saveStore(store); await notifyUser(citizen, "Driver License Revoked", "Your driver license has been revoked by DMV staff. Please contact DMV Support if you need assistance.", 0xc62828); await logEvent(interaction.guild, "audit", "License Revoked", `**Citizen:** <@${citizen.id}>\n**Revoked by:** <@${interaction.user.id}>`, 0xc62828); await interaction.reply({ embeds: [embed("License Revoked", `License for ${citizen} has been revoked.`)] });
      }
    }
    return;
  }
  if (commandName === "inspection") {
    if (!staffOnly(interaction)) { await interaction.reply({ content: "This command is restricted to DMV staff.", ephemeral: true }); return; }
    const plate = interaction.options.getString("plate", true).toUpperCase();
    if (!store.vehicles.some((vehicle) => vehicle.plate === plate)) { await interaction.reply({ content: "No vehicle was found with that plate.", ephemeral: true }); return; }
    store.inspections.push({ id: makeId("insp"), plate, inspectorId: interaction.user.id, inspectorTag: interaction.user.tag, result: interaction.options.getString("result", true) as "passed" | "failed", notes: interaction.options.getString("notes", true), inspectedAt: new Date().toISOString() });
    const inspectedVehicle = store.vehicles.find((vehicle) => vehicle.plate === plate);
    if (inspectedVehicle) { const owner = await interaction.client.users.fetch(inspectedVehicle.ownerId); await notifyUser(owner, "Vehicle Inspection Update", `Your vehicle inspection has been recorded.\n\n**Plate:** ${plate}\n**Result:** ${interaction.options.getString("result", true)}\n**Notes:** ${interaction.options.getString("notes", true)}`, interaction.options.getString("result", true) === "passed" ? 0x2e7d32 : 0xc62828); }
    await saveStore(store); await logEvent(interaction.guild, "audit", "Vehicle Inspection Recorded", `**Plate:** ${plate}\n**Result:** ${interaction.options.getString("result", true)}\n**Inspector:** <@${interaction.user.id}>`, 0x1976d2); await interaction.reply({ embeds: [embed("Inspection Recorded", `Inspection for **${plate}** recorded as **${interaction.options.getString("result", true)}**.`)] });
    return;
  }
  if (commandName === "inspection-history") {
    if (!staffOnly(interaction)) { await interaction.reply({ content: "This command is restricted to DMV staff.", ephemeral: true }); return; }
    const plate = interaction.options.getString("plate", true).toUpperCase();
    const inspections = store.inspections.filter((item) => item.plate === plate);
    await interaction.reply({ embeds: [embed(`Inspection History: ${plate}`, inspections.length ? inspections.map((item) => `**${item.result.toUpperCase()}** | ${item.inspectedAt.slice(0, 10)} | ${item.inspectorTag}\n${item.notes}`).join("\n\n") : "No inspections recorded for this plate.")] });
    return;
  }
  if (commandName === "appointment") {
    const action = interaction.options.getSubcommand();
    if (action === "book") {
      const appointment = { id: makeId("appt"), userId: interaction.user.id, userTag: interaction.user.tag, service: interaction.options.getString("service", true), date: interaction.options.getString("date", true), notes: interaction.options.getString("notes") ?? "", status: "booked" as const };
      store.appointments.push(appointment); await saveStore(store); await notifyAppointment(interaction, appointment); await logEvent(interaction.guild, "appointments", "Appointment Booked", `**ID:** ${appointment.id}\n**Citizen:** <@${interaction.user.id}>\n**Service:** ${appointment.service}`, 0x2e7d32); await interaction.reply({ embeds: [embed("Appointment Booked", `**ID:** ${appointment.id}\n**Service:** ${appointment.service}\n**Date:** ${appointment.date}`)], ephemeral: true });
    } else if (action === "list") {
      const appointments = store.appointments.filter((item) => item.userId === interaction.user.id && item.status === "booked");
      await interaction.reply({ embeds: [embed("Your Appointments", appointments.length ? appointments.map((item) => `**${item.id}** | ${item.date} | ${item.service}`).join("\n") : "You have no active appointments.")] });
    } else if (action === "cancel") {
      const id = interaction.options.getString("id", true); const appointment = store.appointments.find((item) => item.id === id && item.userId === interaction.user.id && item.status === "booked");
      if (!appointment) { await interaction.reply({ content: "Active appointment not found.", ephemeral: true }); return; }
      appointment.status = "cancelled"; await saveStore(store); await logEvent(interaction.guild, "appointments", "Appointment Cancelled", `**ID:** ${id}\n**Cancelled by:** <@${interaction.user.id}>`, 0xc62828); await interaction.reply(`Appointment **${id}** cancelled.`);
    } else {
      if (!staffOnly(interaction)) { await interaction.reply({ content: "This command is restricted to DMV staff.", ephemeral: true }); return; }
      if (action === "staff-list") {
        const appointments = store.appointments.filter((item) => item.status === "booked");
        await interaction.reply({ embeds: [embed("Active DMV Appointments", appointments.length ? appointments.map((item) => `**${item.id}** | ${item.date} | ${item.service} | ${item.userTag}`).join("\n") : "There are no active appointments.")] });
      } else {
        const id = interaction.options.getString("id", true); const appointment = store.appointments.find((item) => item.id === id && item.status === "booked");
        if (!appointment) { await interaction.reply({ content: "Active appointment not found.", ephemeral: true }); return; }
        appointment.status = "completed"; await saveStore(store); await logEvent(interaction.guild, "appointments", "Appointment Completed", `**ID:** ${id}\n**Completed by:** <@${interaction.user.id}>`, 0x2e7d32); await interaction.reply(`Appointment **${id}** marked complete.`);
      }
    }
    return;
  }
  if (commandName === "lookup") {
    if (!staffOnly(interaction)) { await interaction.reply({ content: "This command is restricted to DMV staff.", ephemeral: true }); return; }
    const plate = interaction.options.getString("plate", true).toUpperCase(); const vehicle = store.vehicles.find((item) => item.plate === plate);
    if (!vehicle) { await interaction.reply({ content: "No vehicle record found.", ephemeral: true }); return; }
    const inspections = store.inspections.filter((item) => item.plate === plate).slice(-3).map((item) => `${item.result} (${item.inspectedAt.slice(0, 10)}): ${item.notes}`).join("\n") || "No inspections recorded.";
    await interaction.reply({ embeds: [embed(`DMV Lookup: ${plate}`, `**Owner:** ${vehicle.ownerTag}\n**Vehicle:** ${vehicle.year} ${vehicle.color} ${vehicle.make} ${vehicle.model}\n**Status:** ${vehicle.status}\n\n**Recent inspections**\n${inspections}`)] });
  }
}

function supportStaffOnly(interaction: ChatInputCommandInteraction): boolean {
  const member = interaction.member;
  if (!member) return false;
  if ("permissions" in member && typeof member.permissions !== "string" && member.permissions.has(PermissionFlagsBits.ManageGuild)) return true;
  if (!("roles" in member) || typeof member.roles === "string" || !("cache" in member.roles)) return false;
  return Boolean(member.roles.cache.has(supportTeamRoleId) || (process.env.STAFF_ROLE_ID && member.roles.cache.has(process.env.STAFF_ROLE_ID)) || (process.env.STAFF_ADMIN_ROLE_ID && member.roles.cache.has(process.env.STAFF_ADMIN_ROLE_ID)));
}