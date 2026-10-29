const db = require('../modules/database');
const embeds = require('../modules/embeds');

module.exports = {
  name: 'guildBanRemove',
  async execute(ban) {
    const guild = ban.guild;
    const user = ban.user;
    const settings = db.getGuildSettings(guild.id);

    db.logEvent(guild.id, {
      action: 'Member Unbanned',
      target: user.tag,
      channel: guild.name,
      details: 'Ban revoked by administrator'
    });

    if (settings.modLogChannel) {
      try {
        const logChan = guild.channels.cache.get(settings.modLogChannel);
        if (logChan && logChan.isTextBased()) {
          const logEmbed = embeds.modLog('MEMBER UNBANNED', user, guild.members.me.user, 'Member unbanned');
          await logChan.send({ embeds: [logEmbed] });
        }
      } catch (e) {}
    }
  }
};

