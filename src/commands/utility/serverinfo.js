const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../../config.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('serverinfo')
    .setDescription('Display detailed statistics and details about this server'),

  async execute(interaction) {
    const guild = interaction.guild;
    const owner = await guild.fetchOwner();

    const textChannels = guild.channels.cache.filter(c => c.isTextBased()).size;
    const voiceChannels = guild.channels.cache.filter(c => c.isVoiceBased()).size;
    const memberCount = guild.memberCount;
    const botCount = guild.members.cache.filter(m => m.user.bot).size;
    const humanCount = memberCount - botCount;

    const embed = new EmbedBuilder()
      .setColor(config.colors.primary)
      .setTitle(`🏰 ${guild.name.toUpperCase()} • SERVER INFO`)
      .setThumbnail(guild.iconURL({ dynamic: true, size: 256 }))
      .addFields(
        { name: '👑 Server Owner', value: `${owner.user.tag} (${owner})`, inline: true },
        { name: '📅 Created On', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:D>`, inline: true },
        { name: '🆔 Server ID', value: `\`${guild.id}\``, inline: true },
        { name: `👥 Members (${memberCount})`, value: `👤 Gamers: **${humanCount}**\n🤖 Bots: **${botCount}**`, inline: true },
        { name: '💬 Channels', value: `💬 Text: **${textChannels}**\n🔊 Voice: **${voiceChannels}**`, inline: true },
        { name: '✨ Boost Level', value: `Level **${guild.premiumTier}** (${guild.premiumSubscriptionCount || 0} Boosts)`, inline: true },
        { name: '🎭 Roles', value: `\`${guild.roles.cache.size}\` roles`, inline: true },
        { name: '😀 Custom Emojis', value: `\`${guild.emojis.cache.size}\` emojis`, inline: true }
      )
      .setFooter({ text: `Requested by ${interaction.user.tag}` })
      .setTimestamp();

    if (guild.bannerURL()) {
      embed.setImage(guild.bannerURL({ size: 1024 }));
    }

    await interaction.reply({ embeds: [embed] });
  }
};

