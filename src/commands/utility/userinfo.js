const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../../config.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('Display information about a server member')
    .addUserOption(opt =>
      opt.setName('target')
        .setDescription('The member to look up (Optional)')
        .setRequired(false)
    ),

  async execute(interaction) {
    const user = interaction.options.getUser('target') || interaction.user;
    const member = interaction.guild.members.cache.get(user.id);

    const roles = member
      ? member.roles.cache
          .filter(r => r.id !== interaction.guild.id)
          .map(r => r.toString())
          .slice(0, 15)
          .join(' ') || 'No custom roles'
      : 'N/A';

    const embed = new EmbedBuilder()
      .setColor(config.colors.gaming)
      .setTitle(`👤 ${user.username.toUpperCase()} • GAMER PROFILE`)
      .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }))
      .addFields(
        { name: '🎮 Username', value: `\`${user.tag}\``, inline: true },
        { name: '🆔 User ID', value: `\`${user.id}\``, inline: true },
        { name: '🤖 Account Type', value: user.bot ? 'Bot' : 'Human Gamer', inline: true },
        { name: '📅 Registered On', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:D>`, inline: true },
        { name: '📥 Joined Server', value: member ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : 'Unknown', inline: true },
        { name: '⭐ Key Permissions', value: member?.permissions.has('Administrator') ? '👑 Administrator' : (member?.permissions.has('ManageGuild') ? '🛡️ Moderator' : '🎮 Member'), inline: true },
        { name: '🎭 Roles', value: roles, inline: false }
      )
      .setFooter({ text: `${config.botName}` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};

