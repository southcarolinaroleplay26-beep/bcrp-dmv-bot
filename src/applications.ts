import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  Client,
  EmbedBuilder,
  Message,
  ModalBuilder,
  ModalSubmitInteraction,
  PermissionFlagsBits,
  TextChannel,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";

const applicationButtonId = "bcrp_application_start";
const applicationChannelId = process.env.APPLICATION_CHANNEL_ID ?? "1553900225373012129";
const applicationReviewChannelId = process.env.APPLICATION_REVIEW_CHANNEL_ID ?? "1553900225373012129";
const acceptPrefix = "bcrp_application_accept";
const denyPrefix = "bcrp_application_deny";
const reviewModalPrefix = "bcrp_application_review";
const traineeRoleId = "1553870809838256218";

type ApplicationSession = {
  userId: string;
  questionIndex: number;
  answers: string[];
  timeout: NodeJS.Timeout;
};

const sessions = new Map<string, ApplicationSession>();

const questions = [
  "What is your Roblox username?",
  "What is your Roblox user ID?",
  "What is your Discord username?",
  "What is your Discord user ID?",
  "Which DMV position or division are you applying for?",
  "Describe any previous DMV, government, customer service, or department experience you have in Roblox roleplay.",
  "Why do you want to work for the BCRP Department of Motor Vehicles?",
  "What responsibilities do you believe a DMV worker should handle?",
  "How would you provide professional and respectful service to a citizen?",
  "How would you verify that a vehicle registration or license request is complete and accurate?",
  "How would you keep DMV records organized and up to date?",
  "How would you handle a busy DMV with several citizens waiting for assistance?",
  "How would you respond to a citizen who is frustrated with a DMV decision?",
  "What would you do if you were unsure about the correct DMV procedure?",
  "How would you work with another DMV employee during a complicated request?",
  "How should a DMV worker communicate with supervisors and department leadership?",
  "How would you handle confidential or restricted DMV information?",
  "What qualities would make you a reliable DMV employee?",
  "What level of activity and commitment can you provide as a DMV worker?",
  "How would you contribute to professional and enjoyable DMV roleplay?",
  "What is one strength you would bring to the DMV team?",
  "Is there anything else you would like DMV administration to know about your application?",
  "Do you agree to follow DMV procedures, supervisor direction, and BCRP standards while representing the department?",
];

export function applicationPanel(): { embeds: EmbedBuilder[]; components: ActionRowBuilder<ButtonBuilder>[] } {
  return {
    embeds: [new EmbedBuilder()
      .setColor(0x1976d2)
      .setTitle("BCRP DMV | Department Application")
      .setDescription("Interested in joining the Department of Motor Vehicles? Click the button below to begin a professional 20-question application in your Discord direct messages.")
      .addFields(
        { name: "Application process", value: "Your application is completed privately in DMs, one question at a time." },
        { name: "What we review", value: "Roblox identity, Discord identity, roleplay knowledge, professionalism, and department readiness." },
        { name: "Before you begin", value: "Make sure you can receive DMs from server members and answer every question clearly." },
      )
      .setFooter({ text: "BCRP DMV | Recruitment and Standards" })
      .setTimestamp()],
    components: [new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(applicationButtonId).setLabel("Reply / Start Application").setEmoji("📋").setStyle(ButtonStyle.Primary),
    )],
  };
}

async function askNext(session: ApplicationSession, user: { send: (payload: string | { embeds: EmbedBuilder[] }) => Promise<unknown> }): Promise<void> {
  const questionNumber = session.questionIndex + 1;
  await user.send({ embeds: [new EmbedBuilder().setColor(0x1976d2).setTitle(`DMV Application | Question ${questionNumber} of ${questions.length}`).setDescription(questions[session.questionIndex]).setFooter({ text: "Reply to this DM with your answer | Type CANCEL to stop" }).setTimestamp()] });
}

function startTimeout(userId: string): NodeJS.Timeout {
  return setTimeout(async () => {
    const session = sessions.get(userId);
    if (!session) return;
    sessions.delete(userId);
    try {
      await sessionUser(userId)?.send({ embeds: [new EmbedBuilder().setColor(0xff8f00).setTitle("DMV Application Expired").setDescription("Your application session expired after 30 minutes of inactivity. You may click the application panel again to restart.").setTimestamp()] });
    } catch {
      // The user may have closed DMs.
    }
  }, 30 * 60 * 1000);
}

let applicationClient: Client | null = null;
function sessionUser(userId: string): ReturnType<Client["users"]["cache"]["get"]> {
  return applicationClient?.users.cache.get(userId);
}

export async function handleApplicationButton(interaction: ButtonInteraction, client: Client): Promise<boolean> {
  if (interaction.customId !== applicationButtonId) return false;
  applicationClient = client;
  if (sessions.has(interaction.user.id)) {
    await interaction.reply({ content: "You already have an application in progress. Check your DMs to continue.", ephemeral: true });
    return true;
  }
  try {
    const timeout = startTimeout(interaction.user.id);
    const session: ApplicationSession = { userId: interaction.user.id, questionIndex: 0, answers: [], timeout };
    sessions.set(interaction.user.id, session);
    await interaction.user.send({ embeds: [new EmbedBuilder().setColor(0x1976d2).setTitle("DMV Application Started").setDescription("Thank you for your interest in the BCRP Department of Motor Vehicles. Please answer all 20 questions clearly. Your responses will be reviewed by DMV administrators.").setFooter({ text: "BCRP DMV | Application Intake" }).setTimestamp()] });
    await askNext(session, interaction.user);
    await interaction.reply({ content: "Your application has started. Check your DMs for the first question.", ephemeral: true });
  } catch {
    const session = sessions.get(interaction.user.id);
    if (session) clearTimeout(session.timeout);
    sessions.delete(interaction.user.id);
    await interaction.reply({ content: "I could not DM you. Enable direct messages from server members, then try again.", ephemeral: true });
  }
  return true;
}

export async function handleApplicationMessage(message: Message, client: Client): Promise<void> {
  if (message.author.bot || !message.channel.isDMBased()) return;
  const session = sessions.get(message.author.id);
  if (!session) return;
  if (!("send" in message.channel)) return;
  applicationClient = client;
  clearTimeout(session.timeout);
  if (message.content.trim().toLowerCase() === "cancel") {
    sessions.delete(message.author.id);
    await message.channel.send({ embeds: [new EmbedBuilder().setColor(0xc62828).setTitle("DMV Application Cancelled").setDescription("Your application was cancelled. You may start again from the application panel whenever you are ready.").setTimestamp()] });
    return;
  }
  if (!message.content.trim()) {
    session.timeout = startTimeout(message.author.id);
    await message.channel.send("Please provide an answer before continuing.");
    return;
  }
  session.answers.push(message.content.trim().slice(0, 1000));
  session.questionIndex += 1;
  if (session.questionIndex < questions.length) {
    session.timeout = startTimeout(message.author.id);
    await askNext(session, message.author);
    return;
  }
  sessions.delete(message.author.id);
  await submitApplication(message, client, session);
}

async function submitApplication(message: Message, client: Client, session: ApplicationSession): Promise<void> {
  if (!("send" in message.channel)) return;
  const channel = await client.channels.fetch(applicationReviewChannelId || applicationChannelId);
  if (!channel || !channel.isTextBased() || !("send" in channel)) {
    await message.channel.send("Your application was completed, but the review channel is unavailable. Please contact DMV administration.");
    return;
  }
  const embeds = [0, 10].map((start) => new EmbedBuilder()
    .setColor(0x1976d2)
    .setTitle(start === 0 ? "New DMV Department Application" : "DMV Application | Continued")
    .setDescription(start === 0 ? `**Applicant:** <@${session.userId}>\n**Discord ID:** ${session.userId}\n**Status:** Awaiting administrative review` : "Responses 11 through 20")
    .addFields(session.answers.slice(start, start + 10).map((answer, index) => ({ name: `${start + index + 1}. ${questions[start + index]}`, value: answer })))
    .setFooter({ text: "BCRP DMV | Confidential application review" })
    .setTimestamp());
  await (channel as TextChannel).send({ content: startMention(session.userId), embeds, components: [reviewRow(session.userId)], allowedMentions: { users: [session.userId] } });
  await message.channel.send({ embeds: [new EmbedBuilder().setColor(0x2e7d32).setTitle("Application Submitted").setDescription("Thank you. Your application has been submitted to DMV administration for review. Please wait for a decision through the server’s normal staff process.").setTimestamp()] });
}

function reviewRow(applicantId: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`${acceptPrefix}:${applicantId}`).setLabel("Accept Applicant").setEmoji("✅").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`${denyPrefix}:${applicantId}`).setLabel("Deny Applicant").setEmoji("❌").setStyle(ButtonStyle.Danger),
  );
}

function canReview(interaction: ButtonInteraction | ModalSubmitInteraction): boolean {
  if (interaction.channelId !== applicationReviewChannelId) return false;
  if (!interaction.member || !interaction.channel || !("permissionsFor" in interaction.channel) || !interaction.isRepliable()) return false;
  return Boolean(interaction.channel.permissionsFor(interaction.user.id)?.has(PermissionFlagsBits.ViewChannel));
}

function reviewModal(decision: "accept" | "deny", applicantId: string): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(`${reviewModalPrefix}:${decision}:${applicantId}`)
    .setTitle(decision === "accept" ? "Accept DMV Applicant" : "Deny DMV Applicant")
    .addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId("reason").setLabel(decision === "accept" ? "Acceptance reason" : "Denial reason").setStyle(TextInputStyle.Paragraph).setPlaceholder("Provide a clear, professional reason...").setMinLength(3).setMaxLength(1000).setRequired(true),
    ));
}

export async function handleApplicationReviewButton(interaction: ButtonInteraction): Promise<boolean> {
  const [prefix, applicantId] = interaction.customId.split(":");
  if (prefix !== acceptPrefix && prefix !== denyPrefix) return false;
  if (!canReview(interaction)) {
    await interaction.reply({ content: "Only members who can access the application review channel may review applications.", ephemeral: true });
    return true;
  }
  await interaction.showModal(reviewModal(prefix === acceptPrefix ? "accept" : "deny", applicantId));
  return true;
}

export async function handleApplicationReviewModal(interaction: ModalSubmitInteraction, client: Client): Promise<boolean> {
  const [prefix, decision, applicantId] = interaction.customId.split(":");
  if (prefix !== reviewModalPrefix || (decision !== "accept" && decision !== "deny")) return false;
  if (!canReview(interaction)) {
    await interaction.reply({ content: "Only members who can access the application review channel may review applications.", ephemeral: true });
    return true;
  }
  const reason = interaction.fields.getTextInputValue("reason").trim();
  const applicant = await client.users.fetch(applicantId);
  if (decision === "accept") {
    const guild = interaction.guild ?? client.guilds.cache.get(process.env.GUILD_ID ?? "");
    const member = guild ? await guild.members.fetch(applicantId) : null;
    const staffRole = guild ? await guild.roles.fetch(process.env.STAFF_ROLE_ID ?? "") : null;
    const traineeRole = guild ? await guild.roles.fetch(traineeRoleId) : null;
    if (!member || !staffRole || !traineeRole) {
      await interaction.reply({ content: "The applicant or required DMV roles could not be found.", ephemeral: true });
      return true;
    }
    await member.roles.add([staffRole, traineeRole], `Application accepted by ${interaction.user.tag}`);
    await applicant.send({ embeds: [new EmbedBuilder().setColor(0x2e7d32).setTitle("DMV Application Accepted").setDescription(`Congratulations. Your BCRP DMV application has been accepted.\n\n**Review reason:** ${reason}\n**Reviewed by:** ${interaction.user}\n\nYou have been assigned the DMV Staff and DMV Trainee roles. Please review department procedures before beginning duties.`).setFooter({ text: "BCRP DMV | Recruitment Decision" }).setTimestamp()] });
  } else {
    await applicant.send({ embeds: [new EmbedBuilder().setColor(0xc62828).setTitle("DMV Application Decision").setDescription(`Thank you for applying to the BCRP DMV. Your application was not accepted at this time.\n\n**Reason:** ${reason}\n**Reviewed by:** ${interaction.user}\n\nYou may contact DMV administration if you have questions about this decision.`).setFooter({ text: "BCRP DMV | Recruitment Decision" }).setTimestamp()] });
  }
  if (interaction.message) await interaction.message.edit({ components: [] });
  await interaction.reply({ content: `Application ${decision === "accept" ? "accepted" : "denied"}. The applicant was notified by DM.`, ephemeral: true });
  return true;
}

function startMention(userId: string): string {
  return `New application received for <@${userId}>.`;
}

export { applicationButtonId, questions };
