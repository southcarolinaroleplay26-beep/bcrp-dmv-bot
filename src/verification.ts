import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  EmbedBuilder,
  GuildMember,
} from "discord.js";

const verifyButtonPrefix = "bcrp_verify_account";
const residentRoleId = process.env.RESIDENT_ROLE_ID ?? "1553870910832771152";

export function verificationRow(memberId: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${verifyButtonPrefix}:${memberId}`)
      .setLabel("Verify My Account")
      .setStyle(ButtonStyle.Success),
  );
}

export async function sendWelcome(member: GuildMember): Promise<void> {
  const { guild } = member;
  const configuredChannel = process.env.WELCOME_CHANNEL_ID;
  const channel = configuredChannel
    ? await guild.channels.fetch(configuredChannel)
    : guild.systemChannel;
  if (!channel || !channel.isTextBased() || !("send" in channel)) {
    console.warn(`No welcome channel is available for ${guild.name}. Set WELCOME_CHANNEL_ID in .env.`);
    return;
  }

  const welcomeEmbed = new EmbedBuilder()
    .setColor(0x1976d2)
    .setTitle("Welcome to BCRP | Account Verification")
    .setDescription(
      `Welcome to BCRP, <@${member.id}>. Complete the verification below to unlock the server and receive your Resident role.`,
    )
    .addFields(
      { name: "Your next step", value: "Click **Verify My Account** below." },
      { name: "What happens next", value: "Your Discord account will receive access to the resident areas of BCRP." },
      { name: "Need help?", value: "Contact a DMV supervisor or server staff." },
    )
    .setThumbnail(member.user.displayAvatarURL())
    .setFooter({ text: "BCRP Department of Motor Vehicles" })
    .setTimestamp();

  await channel.send({
    content: `<@${member.id}>`,
    embeds: [welcomeEmbed],
    components: [verificationRow(member.id)],
    allowedMentions: { users: [member.id] },
  });
}

export async function handleVerification(interaction: ButtonInteraction): Promise<void> {
  const [buttonPrefix, targetMemberId] = interaction.customId.split(":");
  if (buttonPrefix !== verifyButtonPrefix || !interaction.guild) return;
  if (targetMemberId !== interaction.user.id) {
    await interaction.reply({ content: "This verification button belongs to the member who joined. Please wait for your own welcome message.", ephemeral: true });
    return;
  }

  const role = await interaction.guild.roles.fetch(residentRoleId);
  if (!role) {
    await interaction.reply({ content: "The Resident role is not configured correctly. Please contact staff.", ephemeral: true });
    return;
  }

  const member = await interaction.guild.members.fetch(interaction.user.id);
  if (member.roles.cache.has(role.id)) {
    await interaction.reply({ content: "Your account is already verified.", ephemeral: true });
    return;
  }

  try {
    await member.roles.add(role, "BCRP account verification button");
    await interaction.reply({ content: "Your account is verified. Welcome to BCRP.", ephemeral: true });
  } catch (error) {
    console.error("Unable to assign Resident role:", error);
    await interaction.reply({ content: "Verification could not be completed. Please contact staff.", ephemeral: true });
  }
}