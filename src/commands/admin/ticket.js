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
    .setName('ticket')
    .setDescription('Manage the community support & inquiry ticket system')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addSubcommand(sub =>
      sub.setName('setup')
        .setDescription('Create the interactive ticket panel in a channel')
        .addChannelOption(opt =>
          opt.setName('channel')
            .setDescription('Channel where the ticket panel will be sent')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
        .addChannelOption(opt =>
          opt.setName('category')
            .setDescription('Category where new private ticket channels will be created')
            .addChannelTypes(ChannelType.GuildCategory)
            .setRequired(false)
        )
    ),

  async execute(interaction) {
    const channel = interaction.options.getChannel('channel');
    const category = interaction.options.getChannel('category');

    if (category) {
      db.updateGuildSettings(interaction.guild.id, 'ticketCategory', category.id);
    }
    db.updateGuildSettings(interaction.guild.id, 'ticketChannel', channel.id);

    const embed = new EmbedBuilder()
      .setColor(config.colors.gaming)
      .setTitle('📩 COMMUNITY SUPPORT & GIVEAWAY CLAIMS')
      .setDescription(
        `Need assistance from the staff, have a streamer business inquiry, or won a stream giveaway?\n\n` +
        `Click the **Create Ticket** button below to open a private 1-on-1 support channel with the moderation team! 🛡️\n\n` +
        `*Please be patient while staff responds.*`
      )
      .setThumbnail('https://cdn-icons-png.flaticon.com/512/3067/3067260.png')
      .setFooter({ text: `${config.botName} • Support Center` });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('ticket_create')
        .setLabel('Create Ticket')
        .setEmoji('📩')
        .setStyle(ButtonStyle.Primary)
    );

    await channel.send({ embeds: [embed], components: [row] });
    await interaction.reply({ content: `✔ Ticket system panel successfully deployed to ${channel}!`, ephemeral: true });
  }
};

