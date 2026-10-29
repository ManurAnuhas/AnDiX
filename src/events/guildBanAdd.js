const db = require('../modules/database');
const embeds = require('../modules/embeds');

module.exports = {
  name: 'guildBanAdd',
  async execute(ban) {
    const guild = ban.guild;
    const user = ban.user;
    const settings = db.getGuildSettings(guild.id);

    db.logEvent(guild.id, {
      action: 'Member Banned',
      target: user.tag,
      channel: guild.name,
      details: ban.reason || 'No reason provided'
    });

    if (settings.modLogChannel) {
      try {
        const logChan = guild.channels.cache.get(settings.modLogChannel);
        if (logChan && logChan.isTextBased()) {
          const logEmbed = embeds.modLog('MEMBER BANNED', user, guild.members.me.user, ban.reason || 'Banned from server');
          await logChan.send({ embeds: [logEmbed] });
        }
      } catch (e) {}
    }
  }
};

