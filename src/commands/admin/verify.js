const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ChannelType
} = require('discord.js');
const db = require('../../modules/database');
const config = require('../../../config.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('verify')
    .setDescription('Set up an anti-raid 1-click verification gate')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption(opt =>
      opt.setName('channel')
        .setDescription('Channel where the verification gate will be posted')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
    .addRoleOption(opt =>
      opt.setName('role')
        .setDescription('Role granted to users upon successful verification (e.g. Gamer / Member)')
        .setRequired(true)
    ),

  async execute(interaction) {
    const channel = interaction.options.getChannel('channel');
    const role = interaction.options.getRole('role');

    db.updateGuildSettings(interaction.guild.id, 'verificationRole', role.id);
    db.updateGuildSettings(interaction.guild.id, 'verificationChannel', channel.id);

    const embed = new EmbedBuilder()
      .setColor(config.colors.primary)
      .setTitle('🛡️ SERVER SECURITY & VERIFICATION GATE')
      .setDescription(
        `Welcome to **${interaction.guild.name}**!\n\n` +
        `To protect our streaming community from automated raid bots and spammers, please click the verification button below.\n\n` +
        `✅ Click **"Verify Membership"** to unlock full access to community chats and voice rooms!`
      )
      .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
      .setFooter({ text: `${config.botName} • Security Shield` });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('btn_verify_member')
        .setLabel('Verify Membership')
        .setEmoji('🛡️')
        .setStyle(ButtonStyle.Success)
    );

    await channel.send({ embeds: [embed], components: [row] });
    await interaction.reply({ content: `✔ Security verification gate posted in ${channel}! Verified members will receive ${role}.`, ephemeral: true });
  }
};

