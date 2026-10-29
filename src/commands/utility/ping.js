const { SlashCommandBuilder } = require('discord.js');
const embeds = require('../../modules/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check the bot latency and Discord API ping'),

  async execute(interaction) {
    const sent = await interaction.reply({
      content: '🏓 Pinging stream server...',
      fetchReply: true
    });

    const roundtrip = sent.createdTimestamp - interaction.createdTimestamp;
    const wsPing = interaction.client.ws.ping;

    await interaction.editReply({
      content: null,
      embeds: [
        embeds.default('🏓 PONG!',
          `⚡ **Roundtrip Latency:** \`${roundtrip}ms\`\n` +
          `📡 **Discord WebSocket API:** \`${wsPing}ms\`\n\n` +
          `${roundtrip < 150 ? '🟢 Excellent connection for gaming!' : '🟡 Normal latency'}`
        )
      ]
    });
  }
};

