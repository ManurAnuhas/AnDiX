const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require('discord.js');
const embeds = require('../../modules/embeds');
const config = require('../../../config.json');

// Store active giveaways in memory: messageId -> { entrants: Set<userId>, prize, winnersCount, endTime, hostId }
const activeGiveaways = new Map();

function parseDuration(str) {
  const match = str.match(/^(\d+)(s|m|h|d)$/i);
  if (!match) return null;
  const val = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  if (unit === 's') return val * 1000;
  if (unit === 'm') return val * 60 * 1000;
  if (unit === 'h') return val * 60 * 60 * 1000;
  if (unit === 'd') return val * 24 * 60 * 60 * 1000;
  return null;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Start an interactive giveaway for your stream viewers')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(opt =>
      opt.setName('prize')
        .setDescription('What are you giving away? (e.g. Steam Gift Card, Discord Nitro, Game Code)')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('duration')
        .setDescription('Giveaway duration (e.g. 30s, 5m, 1h, 1d)')
        .setRequired(true)
    )
    .addIntegerOption(opt =>
      opt.setName('winners')
        .setDescription('Number of winners (Default: 1)')
        .setMinValue(1)
        .setMaxValue(10)
        .setRequired(false)
    ),

  activeGiveaways,

  async execute(interaction) {
    const prize = interaction.options.getString('prize');
    const durationInput = interaction.options.getString('duration');
    const winnersCount = interaction.options.getInteger('winners') || 1;

    const durationMs = parseDuration(durationInput);
    if (!durationMs || durationMs < 5000 || durationMs > 7 * 24 * 60 * 60 * 1000) {
      return interaction.reply({
        embeds: [embeds.error('Invalid Duration', 'Please provide a valid duration like `30s`, `10m`, `2h`, or `1d` (min 5s, max 7d).')],
        ephemeral: true
      });
    }

    const endTime = Math.floor((Date.now() + durationMs) / 1000);

    const embed = new EmbedBuilder()
      .setColor(config.colors.gaming)
      .setTitle(`🎁 STREAM COMMUNITY GIVEAWAY: ${prize.toUpperCase()}!`)
      .setDescription(
        `Click the **🎉 Enter Giveaway** button below to participate!\n\n` +
        `• 🏆 **Prize:** **${prize}**\n` +
        `• 👥 **Winners:** **${winnersCount}**\n` +
        `• ⏳ **Ends In:** <t:${endTime}:R> (<t:${endTime}:f>)\n` +
        `• 👑 **Hosted by:** ${interaction.user}`
      )
      .setThumbnail('https://cdn-icons-png.flaticon.com/512/812/812851.png')
      .setFooter({ text: 'Total Entrants: 0 • Good luck!' })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('giveaway_enter')
        .setLabel('Enter Giveaway')
        .setEmoji('🎉')
        .setStyle(ButtonStyle.Success)
    );

    const replyMsg = await interaction.reply({
      content: '🚨 **GIVEAWAY STARTED!** @everyone',
      embeds: [embed],
      components: [row],
      fetchReply: true
    });

    const giveawayData = {
      messageId: replyMsg.id,
      channelId: interaction.channel.id,
      guildId: interaction.guild.id,
      prize,
      winnersCount,
      entrants: new Set(),
      endTime,
      hostId: interaction.user.id
    };

    activeGiveaways.set(replyMsg.id, giveawayData);

    // Schedule giveaway conclusion
    setTimeout(async () => {
      try {
        const ga = activeGiveaways.get(replyMsg.id);
        if (!ga) return;
        activeGiveaways.delete(replyMsg.id);

        const channel = interaction.guild.channels.cache.get(ga.channelId);
        if (!channel) return;
        const msg = await channel.messages.fetch(ga.messageId).catch(() => null);

        const entrantList = Array.from(ga.entrants);
        if (entrantList.length === 0) {
          const endEmbed = EmbedBuilder.from(embed)
            .setColor(config.colors.danger)
            .setTitle(`🎁 GIVEAWAY ENDED: ${prize}`)
            .setDescription(`No one entered the giveaway! The prize **${prize}** could not be awarded. 😢`)
            .setFooter({ text: 'Giveaway Ended' });

          if (msg) await msg.edit({ embeds: [endEmbed], components: [] });
          return;
        }

        // Pick winners
        const winners = [];
        const pool = [...entrantList];
        const numToPick = Math.min(ga.winnersCount, pool.length);

        for (let i = 0; i < numToPick; i++) {
          const randomIndex = Math.floor(Math.random() * pool.length);
          winners.push(pool.splice(randomIndex, 1)[0]);
        }

        const winnerMentions = winners.map(w => `<@${w}>`).join(', ');

        const endEmbed = EmbedBuilder.from(embed)
          .setColor(config.colors.success)
          .setTitle(`🎉 GIVEAWAY CONCLUDED: ${prize}!`)
          .setDescription(
            `Congratulations to our winner(s)!\n\n` +
            `🏆 **Winner(s):** ${winnerMentions}\n` +
            `🎁 **Prize:** **${prize}**\n` +
            `👥 **Total Participants:** **${entrantList.length}**\n\n` +
            `Please contact ${interaction.user} to claim your prize! 🚀`
          )
          .setFooter({ text: 'Giveaway Ended' });

        if (msg) {
          await msg.edit({ embeds: [endEmbed], components: [] });
          await channel.send({
            content: `🎊 GG ${winnerMentions}! You won the **${prize}**! 🎉`
          });
        }
      } catch (err) {
        console.error('Error ending giveaway:', err);
      }
    }, durationMs);
  }
};

