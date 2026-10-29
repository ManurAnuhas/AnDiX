const db = require('../modules/database');
const embeds = require('../modules/embeds');

module.exports = {
  name: 'messageDelete',
  async execute(message) {
    if (!message || !message.guild || message.author?.bot) return;

    const settings = db.getGuildSettings(message.guild.id);
    if (!settings.modLogChannel) return;

    try {
      const logChan = message.guild.channels.cache.get(settings.modLogChannel);
      if (!logChan || !logChan.isTextBased()) return;

      const logEmbed = embeds.modLog(
        'MESSAGE DELETED',
        message.author,
        message.guild.members.me.user,
        `A message by ${message.author} was deleted in <#${message.channel.id}>`,
        [
          { name: 'Channel', value: `<#${message.channel.id}>`, inline: true },
          { name: 'Deleted Content', value: message.content ? `\`\`\`${message.content.slice(0, 1000)}\`\`\`` : '*Attachment or embed*' }
        ]
      );

      // Save to audit log buffer for web dashboard
      db.logEvent(message.guild.id, {
        action: 'Message Deleted',
        target: message.author.tag,
        channel: message.channel.name,
        details: message.content ? message.content.slice(0, 150) : '[Attachment/Embed]'
      });

      await logChan.send({ embeds: [logEmbed] });
    } catch (err) {
      // ignore
    }
  }
};

