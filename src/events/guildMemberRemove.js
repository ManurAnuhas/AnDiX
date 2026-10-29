const db = require('../modules/database');
const embeds = require('../modules/embeds');
const logger = require('../utils/logger');

module.exports = {
  name: 'guildMemberRemove',
  async execute(member) {
    const guild = member.guild;
    const settings = db.getGuildSettings(guild.id);

    logger.info(`Member left: ${member.user.tag} from ${guild.name}`);

    // 1. Send Goodbye Embed if channel is configured
    if (settings.goodbyeChannel) {
      try {
        const goodbyeChan = guild.channels.cache.get(settings.goodbyeChannel);
        if (goodbyeChan && goodbyeChan.isTextBased()) {
          const goodbyeEmbed = embeds.goodbye(member, guild.memberCount);
          await goodbyeChan.send({ embeds: [goodbyeEmbed] });
        }
      } catch (err) {
        logger.error(`Failed to send goodbye message in ${guild.name}:`, err);
      }
    }

    // 2. Mod Log
    db.logEvent(guild.id, {
      action: 'Member Left',
      target: member.user.tag,
      channel: guild.name,
      details: `Left or was removed from server`
    });

    if (settings.modLogChannel) {
      try {
        const modChan = guild.channels.cache.get(settings.modLogChannel);
        if (modChan && modChan.isTextBased()) {
          const logEmbed = embeds.modLog('MEMBER LEFT', member.user, guild.members.me.user, 'Member left or was removed from the server', [
            { name: 'Remaining Members', value: `${guild.memberCount}`, inline: true }
          ]);
          await modChan.send({ embeds: [logEmbed] });
        }
      } catch (err) {
        // silent catch
      }
    }
  }
};

