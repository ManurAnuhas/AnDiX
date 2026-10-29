const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require('discord.js');
const config = require('../../../config.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rolepanel')
    .setDescription('Create an interactive self-assign role panel for your community')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addRoleOption(opt =>
      opt.setName('stream_role')
        .setDescription('Role for Stream Notifications')
        .setRequired(true)
    )
    .addRoleOption(opt =>
      opt.setName('game_role_1')
        .setDescription('First Game Role (e.g. Valorant)')
        .setRequired(false)
    )
    .addRoleOption(opt =>
      opt.setName('game_role_2')
        .setDescription('Second Game Role (e.g. GTA V)')
        .setRequired(false)
    )
    .addRoleOption(opt =>
      opt.setName('game_role_3')
        .setDescription('Third Game Role (e.g. Free Fire / Minecraft)')
        .setRequired(false)
    ),

  async execute(interaction) {
    const streamRole = interaction.options.getRole('stream_role');
    const gameRole1 = interaction.options.getRole('game_role_1');
    const gameRole2 = interaction.options.getRole('game_role_2');
    const gameRole3 = interaction.options.getRole('game_role_3');

    const embed = new EmbedBuilder()
      .setColor(config.colors.gaming)
      .setTitle('🎭 SQUAD SELF-ASSIGN ROLES')
      .setDescription(
        `Click the buttons below to grab or remove your notification & game roles!\n\n` +
        `🔔 **${streamRole.name}** — Get pinged when the stream goes live!\n` +
        (gameRole1 ? `🎮 **${gameRole1.name}** — Team up for this game!\n` : '') +
        (gameRole2 ? `🎮 **${gameRole2.name}** — Team up for this game!\n` : '') +
        (gameRole3 ? `🎮 **${gameRole3.name}** — Team up for this game!\n` : '') +
        `\n*Click once to get the role, click again to remove it.*`
      )
      .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
      .setFooter({ text: `${config.botName} • Role Manager` });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`selfrole_${streamRole.id}`)
        .setLabel(streamRole.name)
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🔔')
    );

    if (gameRole1) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`selfrole_${gameRole1.id}`)
          .setLabel(gameRole1.name)
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🎮')
      );
    }
    if (gameRole2) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`selfrole_${gameRole2.id}`)
          .setLabel(gameRole2.name)
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🕹️')
      );
    }
    if (gameRole3) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`selfrole_${gameRole3.id}`)
          .setLabel(gameRole3.name)
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('⚡')
      );
    }

    await interaction.channel.send({ embeds: [embed], components: [row] });
    await interaction.reply({ content: '✔ Role panel has been created successfully!', ephemeral: true });
  }
};

