const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../modules/database');
const config = require('../../../config.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('View the top 10 most active members in the server'),

  async execute(interaction) {
    const topUsers = db.getLeaderboard(interaction.guild.id, 10);

    if (topUsers.length === 0) {
      return interaction.reply({
        content: '🎮 No XP records yet! Start chatting in channels to climb the leaderboard!',
        ephemeral: true
      });
    }

    const medals = ['🥇', '🥈', '🥉'];
    const lines = topUsers.map((user, index) => {
      const medal = medals[index] || `**#${index + 1}**`;
      return `${medal} <@${user.userId}> — **Level ${user.level}** (${user.totalXp.toLocaleString()} XP)`;
    });

    const embed = new EmbedBuilder()
      .setColor(config.colors.gaming)
      .setTitle(`🏆 ${interaction.guild.name} TOP GAMERS LEADERBOARD`)
      .setDescription(lines.join('\n\n'))
      .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
      .setFooter({ text: 'Climb the ranks by actively chatting in text channels!' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};

