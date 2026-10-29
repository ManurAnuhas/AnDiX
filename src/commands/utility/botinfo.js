const { SlashCommandBuilder, EmbedBuilder, version } = require('discord.js');
const config = require('../../../config.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('botinfo')
    .setDescription('Display information and statistics about AnDi StreamBot'),

  async execute(interaction) {
    const client = interaction.client;
    const uptime = Math.floor(client.uptime / 1000);
    const days = Math.floor(uptime / 86400);
    const hours = Math.floor((uptime % 86400) / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = uptime % 60;
    const uptimeStr = `${days}d ${hours}h ${minutes}m ${seconds}s`;

    const memoryUsage = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);

    const embed = new EmbedBuilder()
      .setColor(config.colors.gaming)
      .setTitle(`🤖 ${config.botName} • STATUS & SPECS`)
      .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
      .setDescription('Custom gaming & streaming Discord companion bot built for high performance, smart AutoMod, and community engagement.')
      .addFields(
        { name: '👑 Developer / Streamer', value: `\`${config.streamer.name}\``, inline: true },
        { name: '⏱️ Uptime', value: `\`${uptimeStr}\``, inline: true },
        { name: '💾 Memory Usage', value: `\`${memoryUsage} MB\``, inline: true },
        { name: '📦 Node.js', value: `\`${process.version}\``, inline: true },
        { name: '⚡ Discord.js', value: `\`v${version}\``, inline: true },
        { name: '🛡️ AutoMod Engine', value: '`Active (Real-time)`', inline: true },
        { name: '🌐 Servers', value: `\`${client.guilds.cache.size}\``, inline: true },
        { name: '👥 Total Users', value: `\`${client.users.cache.size}\``, inline: true },
        { name: '🕹️ Commands', value: `\`${client.commands.size}\``, inline: true }
      )
      .setFooter({ text: `${config.botName} • Ultimate Gaming Assistant` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};

