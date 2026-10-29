const db = require('../modules/database');
const embeds = require('../modules/embeds');
const logger = require('../utils/logger');

module.exports = {
  name: 'guildMemberAdd',
  async execute(member) {
    const guild = member.guild;
    const settings = db.getGuildSettings(guild.id);

    logger.info(`New member joined: ${member.user.tag} in ${guild.name}`);

    // 1. Assign Auto-Role if configured
    if (settings.autoRoleId) {
      try {
        const role = guild.roles.cache.get(settings.autoRoleId);
        if (role) {
          await member.roles.add(role);
          logger.info(`Assigned auto-role [${role.name}] to ${member.user.tag}`);
        }
      } catch (err) {
        logger.error(`Failed to assign auto-role to ${member.user.tag}:`, err);
      }
    }

    // 2. Send Gaming Welcome Embed
    if (settings.welcomeChannel) {
      try {
        const welcomeChan = guild.channels.cache.get(settings.welcomeChannel);
        if (welcomeChan && welcomeChan.isTextBased()) {
          const welcomeEmbed = embeds.welcome(member, guild.memberCount);
          await welcomeChan.send({
            content: `👋 Welcome to the squad, ${member}! 🎮`,
            embeds: [welcomeEmbed]
          });
        }
      } catch (err) {
        logger.error(`Failed to send welcome message in ${guild.name}:`, err);
      }
    }

    // 3. Mod Log
    db.logEvent(guild.id, {
      action: 'Member Joined',
      target: member.user.tag,
      channel: guild.name,
      details: `Account created: ${new Date(member.user.createdTimestamp).toLocaleDateString()}`
    });

    if (settings.modLogChannel) {
      try {
        const modChan = guild.channels.cache.get(settings.modLogChannel);
        if (modChan && modChan.isTextBased()) {
          const logEmbed = embeds.modLog('MEMBER JOINED', member.user, guild.members.me.user, 'New member connected to the server', [
            { name: 'Account Created', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true },
            { name: 'Total Members', value: `${guild.memberCount}`, inline: true }
          ]);
          await modChan.send({ embeds: [logEmbed] });
        }
      } catch (err) {
        // silent catch
      }
    }
  }
};

