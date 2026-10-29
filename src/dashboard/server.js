const express = require('express');
const path = require('path');
const fs = require('fs');
const { ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const db = require('../modules/database');
const auth = require('../modules/auth');
const embeds = require('../modules/embeds');
const serverArchitect = require('../modules/serverArchitect');
const logger = require('../utils/logger');
const config = require('../../config.json');

function createServer(client) {
  const app = express();

  // Support JSON and base64 slips up to 20MB
  app.use(express.json({ limit: '20mb' }));
  app.use(express.urlencoded({ extended: true, limit: '20mb' }));
  app.use(express.static(path.join(__dirname, 'public')));

  // ==========================================
  // 1. PUBLIC SAAS INFORMATION & AUTH
  // ==========================================

  // Public SaaS info (Pricing & Bank Details)
  app.get('/api/public/info', (req, res) => {
    res.json({
      productName: config.saas?.productName || 'AnDiX Pro Discord Suite',
      pricing: config.saas?.pricing || { setupFeeLkr: 2000, monthlyFeeLkr: 500 },
      bankDetails: config.saas?.bankDetails || {},
      contact: config.saas?.contact || {},
      botInviteUrl: `https://discord.com/oauth2/authorize?client_id=${process.env.CLIENT_ID || '1565283272072761424'}&permissions=8&integration_type=0&scope=bot+applications.commands`
    });
  });

  // Client Registration (Sign Up)
  app.post('/api/auth/register', async (req, res) => {
    const { fullName, email, password, discordTag, discordServerName } = req.body;

    if (!fullName || !email || !password) {
      return res.status(400).json({ error: 'Full name, email, and password are required.' });
    }

    const existing = db.findUserByEmail(email);
    if (existing) {
      return res.status(400).json({ error: 'An account with this email already exists. Please log in.' });
    }

    try {
      const passwordHash = await auth.hashPassword(password);
      const isFreeMode = config.saas?.freeTrialMode === true;
      const user = db.createUser({
        fullName,
        email: email.toLowerCase().trim(),
        passwordHash,
        discordTag: discordTag || '',
        discordServerName: discordServerName || '',
        role: 'client',
        subscription: {
          status: isFreeMode ? 'active' : 'pending_payment',
          setupPaid: isFreeMode,
          monthlyFeeLkr: 0,
          setupFeeLkr: 0,
          activatedAt: isFreeMode ? Date.now() : null,
          expiresAt: isFreeMode ? (Date.now() + 60 * 24 * 60 * 60 * 1000) : null // 60 Days Free Trial
        }
      });

      const token = auth.generateToken(user);
      logger.info(`New client registered: ${user.fullName} (${user.email})`);

      res.json({
        success: true,
        token,
        user: {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
          subscription: user.subscription
        }
      });
    } catch (err) {
      res.status(500).json({ error: 'Registration failed: ' + err.message });
    }
  });

  // Client & Admin Login
  app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const cleanEmail = email.toLowerCase().trim();

    // 1. Check Master Admin Login
    const adminEmail = (process.env.ADMIN_EMAIL || 'admin@andix.bot').toLowerCase().trim();
    const adminPass = process.env.ADMIN_PASSWORD || 'admin123';

    if (cleanEmail === adminEmail && password === adminPass) {
      const adminUser = {
        id: 'admin_master',
        email: adminEmail,
        fullName: 'AnDiX Master Admin',
        role: 'admin'
      };
      const token = auth.generateToken(adminUser);
      logger.success(`Master Admin logged in: ${adminEmail}`);
      return res.json({ success: true, token, user: adminUser });
    }

    // 2. Check Client User Login
    const user = db.findUserByEmail(cleanEmail);
    if (!user) {
      return res.status(401).json({ error: 'No account found with this email address.' });
    }

    const isMatch = await auth.comparePassword(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid password. Please try again.' });
    }

    const token = auth.generateToken(user);
    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        discordTag: user.discordTag,
        discordServerName: user.discordServerName,
        role: user.role,
        subscription: user.subscription
      }
    });
  });

  // Discord OAuth2 Initiate
  app.get('/api/auth/discord', (req, res) => {
    const clientId = process.env.CLIENT_ID || '1565283272072761424';
    const host = req.get('host');
    const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
    const redirectUri = encodeURIComponent(`${protocol}://${host}/api/auth/discord/callback`);
    const discordAuthUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=identify%20email%20guilds`;
    res.redirect(discordAuthUrl);
  });

  // Discord OAuth2 Callback
  app.get('/api/auth/discord/callback', async (req, res) => {
    const { code } = req.query;
    if (!code) return res.redirect('/auth.html?error=no_code');

    const clientId = process.env.CLIENT_ID || '1565283272072761424';
    const clientSecret = process.env.CLIENT_SECRET || 'EOWs4HJ_PIuHdIR-0rnQ0zzTN8U-zi58';
    const host = req.get('host');
    const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
    const redirectUri = `${protocol}://${host}/api/auth/discord/callback`;

    try {
      const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: 'authorization_code',
          code: code.toString(),
          redirect_uri: redirectUri
        })
      });

      const tokenData = await tokenRes.json();
      if (!tokenData.access_token) {
        logger.error('Discord OAuth Token Error:', tokenData);
        return res.redirect('/auth.html?error=token_failed');
      }

      const userRes = await fetch('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` }
      });
      const discordUser = await userRes.json();

      const email = discordUser.email || `${discordUser.id}@discord.user`;
      let user = db.findUserByEmail(email);

      if (!user) {
        const isFreeMode = config.saas?.freeTrialMode === true;
        user = db.createUser({
          fullName: discordUser.global_name || discordUser.username,
          email: email.toLowerCase(),
          passwordHash: 'DISCORD_OAUTH_ACCOUNT',
          discordTag: `${discordUser.username}#${discordUser.discriminator || '0'}`,
          discordServerName: '',
          role: 'client',
          subscription: {
            status: isFreeMode ? 'active' : 'pending_payment',
            setupPaid: isFreeMode,
            monthlyFeeLkr: 0,
            setupFeeLkr: 0,
            activatedAt: isFreeMode ? Date.now() : null,
            expiresAt: isFreeMode ? (Date.now() + 60 * 24 * 60 * 60 * 1000) : null
          }
        });
      }

      const jwtToken = auth.generateToken(user);
      res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>Logging in...</title></head>
        <body style="background:#090a0f;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;">
          <div style="text-align:center;">
            <h2>✔ Discord Login Successful!</h2>
            <p>Redirecting to your Dashboard...</p>
          </div>
          <script>
            localStorage.setItem('andix_token', '${jwtToken}');
            localStorage.setItem('andix_user', JSON.stringify(${JSON.stringify(user)}));
            window.location.href = '/client.html';
          </script>
        </body>
        </html>
      `);
    } catch (err) {
      logger.error('OAuth Callback Exception:', err);
      res.redirect('/auth.html?error=server_error');
    }
  });

  // ==========================================
  // 2. CLIENT DASHBOARD APIS (Protected)
  // ==========================================

  // Get Client Profile & Subscription
  app.get('/api/client/me', auth.requireAuth, (req, res) => {
    const user = db.findUserById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        discordTag: user.discordTag,
        discordServerName: user.discordServerName,
        discordServerId: user.discordServerId,
        subscription: user.subscription
      },
      botInviteUrl: `https://discord.com/oauth2/authorize?client_id=${process.env.CLIENT_ID || '1565283272072761424'}&permissions=8&integration_type=0&scope=bot+applications.commands`
    });
  });

  // Client Submit Payment (Bank Slip / Receipt Upload)
  app.post('/api/client/submit-payment', auth.requireAuth, (req, res) => {
    // Accept both field name variants from different clients
    const amountLkr = req.body.amountLkr || req.body.amount;
    const slipBase64 = req.body.slipBase64 || req.body.slipImage;
    const { notes, type } = req.body;

    if (!amountLkr || !slipBase64) {
      return res.status(400).json({ success: false, message: 'Payment amount and bank slip image are required.' });
    }

    const user = db.findUserById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const payment = db.createPayment({
      userId: user.id,
      userEmail: user.email,
      userName: user.fullName,
      serverName: user.discordServerName,
      amountLkr: Number(amountLkr),
      type: type || (user.subscription.setupPaid ? 'monthly_renewal' : 'initial_setup'),
      slipBase64,
      notes: notes || 'Bank deposit / Online transfer slip'
    });

    logger.info(`Payment submitted by ${user.fullName}: LKR ${amountLkr}`);
    res.json({
      success: true,
      message: 'Payment slip submitted successfully! Our team will verify and activate your access within a few minutes.',
      payment
    });
  });

  // Get Client Payment History
  app.get('/api/client/payments', auth.requireAuth, (req, res) => {
    const payments = db.getPaymentsByUser(req.user.id);
    res.json(payments);
  });

  // Link Client's Discord Server ID
  app.post('/api/client/link-server', auth.requireAuth, (req, res) => {
    const { serverId, serverName } = req.body;
    if (!serverId) return res.status(400).json({ error: 'Server ID is required' });

    db.updateUser(req.user.id, {
      discordServerId: serverId.trim(),
      discordServerName: serverName || req.user.discordServerName
    });

    res.json({ success: true, message: 'Discord Server linked successfully!' });
  });

  // Client Trigger 1-Click Server Setup (Requires Active Subscription)
  app.post('/api/client/auto-setup', auth.requireAuth, async (req, res) => {
    const user = db.findUserById(req.user.id);
    if (!user || user.subscription?.status !== 'active') {
      return res.status(403).json({ error: 'Active subscription required. Please complete your payment to unlock the Server Architect.' });
    }

    const serverId = req.body.serverId || user.discordServerId;
    if (!serverId) {
      return res.status(400).json({ error: 'Please enter your Discord Server ID to run the setup.' });
    }

    const guild = client.guilds.cache.get(serverId);
    if (!guild) {
      return res.status(404).json({ error: 'Bot is not in this server yet! Please invite the bot to your server first using the Invite button.' });
    }

    try {
      const summary = await serverArchitect.buildCompleteServer(guild);
      res.json({
        success: true,
        message: 'Your server has been professionally architected with all channels and roles!',
        summary
      });
    } catch (err) {
      res.status(500).json({ error: 'Setup failed: ' + err.message });
    }
  });

  // ==========================================
  // 3. MASTER ADMIN DASHBOARD APIS (Protected)
  // ==========================================

  // Admin Overview Statistics
  app.get('/api/admin/overview', auth.requireAdmin, (req, res) => {
    const users = db.getAllUsers();
    const payments = db.getAllPayments();

    const activeUsers = users.filter(u => u.subscription?.status === 'active').length;
    const pendingPayments = payments.filter(p => p.status === 'pending').length;

    const totalRevenue = payments
      .filter(p => p.status === 'approved')
      .reduce((sum, p) => sum + (p.amountLkr || 0), 0);

    const monthlyRecurringRevenue = activeUsers * 500;

    res.json({
      totalClients: users.length,
      activeSubscriptions: activeUsers,
      pendingVerifications: pendingPayments,
      totalRevenueLkr: totalRevenue,
      mrrLkr: monthlyRecurringRevenue,
      botServersCount: client.guilds.cache.size
    });
  });

  // Admin Client List
  app.get('/api/admin/clients', auth.requireAdmin, (req, res) => {
    const users = db.getAllUsers().map(u => ({
      id: u.id,
      fullName: u.fullName,
      name: u.fullName,
      email: u.email,
      discordTag: u.discordTag,
      discordServerName: u.discordServerName,
      discordServerId: u.discordServerId,
      subscription: u.subscription,
      suspended: u.subscription?.status === 'suspended',
      createdAt: u.createdAt
    }));
    res.json({ success: true, clients: users });
  });

  // Admin Payments List
  app.get('/api/admin/payments', auth.requireAdmin, (req, res) => {
    const payments = db.getAllPayments();
    res.json({ success: true, payments });
  });

  // Admin Approve Payment
  app.post('/api/admin/payments/:id/approve', auth.requireAdmin, (req, res) => {
    const result = db.approvePayment(req.params.id);
    if (!result) return res.status(404).json({ error: 'Payment not found' });

    logger.success(`Payment ${req.params.id} approved for ${result.user?.fullName}!`);
    res.json({ success: true, message: 'Payment approved and client subscription activated!', result });
  });

  // Admin Reject Payment
  app.post('/api/admin/payments/:id/reject', auth.requireAdmin, (req, res) => {
    const { reason } = req.body;
    const payment = db.rejectPayment(req.params.id, reason);
    if (!payment) return res.status(404).json({ error: 'Payment not found' });

    res.json({ success: true, message: 'Payment marked as rejected.', payment });
  });

  // Admin Manually Toggle Client Access
  app.post('/api/admin/clients/:id/toggle-access', auth.requireAdmin, (req, res) => {
    const user = db.findUserById(req.params.id);
    if (!user) return res.status(404).json({ error: 'Client not found' });

    const newStatus = user.subscription?.status === 'active' ? 'suspended' : 'active';
    user.subscription.status = newStatus;
    if (newStatus === 'active') {
      user.subscription.expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
    }
    db.updateUser(user.id, { subscription: user.subscription });

    res.json({ success: true, message: `Client status changed to ${newStatus}` });
  });

  // ==========================================
  // 4. DISCORD BOT SETTINGS & CHANNELS APIS
  // ==========================================

  // Bot Status
  app.get('/api/status', (req, res) => {
    const guilds = client.guilds.cache.map(g => ({
      id: g.id,
      name: g.name,
      icon: g.iconURL({ dynamic: true }) || 'https://cdn-icons-png.flaticon.com/512/5968/5968756.png',
      memberCount: g.memberCount
    }));

    res.json({
      online: client.isReady(),
      botUser: client.user ? {
        id: client.user.id,
        tag: client.user.tag,
        username: client.user.username,
        avatar: client.user.displayAvatarURL({ dynamic: true })
      } : null,
      uptime: Math.floor(client.uptime / 1000) || 0,
      ping: client.ws.ping,
      guildsCount: client.guilds.cache.size,
      totalUsers: client.users.cache.size,
      guilds
    });
  });

  // Guild Channels, Roles & Settings
  app.get('/api/guild/:guildId', (req, res) => {
    const guild = client.guilds.cache.get(req.params.guildId);
    if (!guild) {
      return res.status(404).json({ error: 'Guild not found or bot is not in this server' });
    }

    const channels = guild.channels.cache
      .filter(c => c.isTextBased())
      .map(c => ({
        id: c.id,
        name: c.name,
        type: c.type === ChannelType.GuildAnnouncement ? 'Announcement' : 'Text'
      }));

    const voiceChannels = guild.channels.cache
      .filter(c => c.isVoiceBased())
      .map(c => ({
        id: c.id,
        name: c.name
      }));

    const roles = guild.roles.cache
      .filter(r => r.id !== guild.id && !r.managed)
      .map(r => ({
        id: r.id,
        name: r.name,
        color: r.hexColor
      }));

    const settings = db.getGuildSettings(guild.id);

    res.json({
      guild: {
        id: guild.id,
        name: guild.name,
        icon: guild.iconURL({ dynamic: true })
      },
      channels,
      voiceChannels,
      roles,
      settings
    });
  });

  // Update Guild Settings
  app.post('/api/guild/:guildId/settings', (req, res) => {
    const guild = client.guilds.cache.get(req.params.guildId);
    if (!guild) return res.status(404).json({ error: 'Server not found' });

    const allowedKeys = [
      'welcomeChannel',
      'goodbyeChannel',
      'modLogChannel',
      'streamChannel',
      'streamPingRole',
      'autoRoleId',
      'verificationRole',
      'verificationChannel',
      'ticketCategory',
      'ticketChannel',
      'tempVoiceHubChannel',
      'automodEnabled'
    ];

    for (const key of allowedKeys) {
      if (req.body[key] !== undefined) {
        db.updateGuildSettings(guild.id, key, req.body[key]);
      }
    }

    res.json({ success: true, settings: db.getGuildSettings(guild.id) });
  });

  // 1-Click Complete Server Setup
  app.post('/api/guild/:guildId/auto-setup', async (req, res) => {
    const guild = client.guilds.cache.get(req.params.guildId);
    if (!guild) return res.status(404).json({ error: 'Server not found' });

    try {
      const summary = await serverArchitect.buildCompleteServer(guild);
      return res.json({
        success: true,
        message: 'Server has been successfully architected with channels and roles!',
        summary
      });
    } catch (err) {
      logger.error('Auto-setup failed from dashboard:', err);
      return res.status(500).json({ error: err.message });
    }
  });

  // Live Audit Logs
  app.get('/api/guild/:guildId/audit-logs', (req, res) => {
    const logs = db.getAuditLogs(req.params.guildId, 50);
    res.json(logs);
  });

  // Broadcast Live Stream Alert
  app.post('/api/guild/:guildId/stream-alert', async (req, res) => {
    const guild = client.guilds.cache.get(req.params.guildId);
    if (!guild) return res.status(404).json({ error: 'Server not found' });

    const { title, game, platform, url, imageUrl, pingType } = req.body;
    if (!title || !url || !platform) {
      return res.status(400).json({ error: 'Title, Platform, and Stream URL are required' });
    }

    const settings = db.getGuildSettings(guild.id);
    const targetChannelId = settings.streamChannel;

    if (!targetChannelId) {
      return res.status(400).json({ error: 'Please set the Stream Alerts Channel in Settings first!' });
    }

    const channel = guild.channels.cache.get(targetChannelId);
    if (!channel || !channel.isTextBased()) {
      return res.status(400).json({ error: 'Stream Alerts Channel is invalid or inaccessible' });
    }

    let mentionText = '';
    if (pingType === 'everyone') mentionText = '@everyone';
    else if (pingType === 'here') mentionText = '@here';
    else if (pingType === 'role' && settings.streamPingRole) mentionText = `<@&${settings.streamPingRole}>`;

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel(`Watch on ${platform}`)
        .setStyle(ButtonStyle.Link)
        .setURL(url)
        .setEmoji('🔴')
    );

    const streamEmbed = embeds.streamLive({
      streamerName: config.streamer?.name || 'Streamer',
      title,
      game: game || 'Variety Gaming',
      platform,
      url,
      thumbnailUrl: imageUrl
    });

    try {
      await channel.send({
        content: mentionText ? `${mentionText} 🚨 **STREAM IS LIVE!**` : undefined,
        embeds: [streamEmbed],
        components: [row]
      });

      return res.json({ success: true, message: `Alert posted to #${channel.name} successfully!` });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Custom Announcement
  app.post('/api/guild/:guildId/announcement', async (req, res) => {
    const guild = client.guilds.cache.get(req.params.guildId);
    if (!guild) return res.status(404).json({ error: 'Server not found' });

    const { channelId, title, message, color, pingType, imageUrl } = req.body;
    if (!channelId || !title || !message) {
      return res.status(400).json({ error: 'Channel, Title, and Message are required' });
    }

    const channel = guild.channels.cache.get(channelId);
    if (!channel || !channel.isTextBased()) {
      return res.status(400).json({ error: 'Invalid text channel' });
    }

    let mentionText = '';
    if (pingType === 'everyone') mentionText = '@everyone';
    else if (pingType === 'here') mentionText = '@here';

    const embed = new EmbedBuilder()
      .setColor(color || config.colors.gaming)
      .setTitle(`📢 ${title}`)
      .setDescription(message)
      .setTimestamp()
      .setFooter({ text: `${config.botName} • Official Announcement` });

    if (imageUrl) embed.setImage(imageUrl);

    try {
      await channel.send({
        content: mentionText || undefined,
        embeds: [embed]
      });
      return res.json({ success: true, message: `Announcement sent to #${channel.name}!` });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Leaderboard
  app.get('/api/guild/:guildId/leaderboard', async (req, res) => {
    const rawLeaderboard = db.getLeaderboard(req.params.guildId, 25);
    const enriched = await Promise.all(rawLeaderboard.map(async (entry) => {
      let username = 'Gamer ' + entry.userId.slice(-4);
      let avatar = null;
      try {
        const user = await client.users.fetch(entry.userId);
        if (user) {
          username = user.tag;
          avatar = user.displayAvatarURL({ dynamic: true });
        }
      } catch (e) {}

      return {
        ...entry,
        username,
        avatar
      };
    }));

    res.json(enriched);
  });

  // Config Endpoints
  const configPath = path.join(__dirname, '..', '..', 'config.json');

  app.get('/api/config', (req, res) => {
    res.json({
      botName: config.botName,
      streamer: config.streamer,
      automod: config.automod,
      colors: config.colors,
      saas: config.saas
    });
  });

  app.post('/api/config', (req, res) => {
    try {
      if (req.body.streamer) config.streamer = { ...config.streamer, ...req.body.streamer };
      if (req.body.automod) config.automod = { ...config.automod, ...req.body.automod };
      if (req.body.colors) config.colors = { ...config.colors, ...req.body.colors };
      if (req.body.saas) config.saas = { ...config.saas, ...req.body.saas };

      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
      res.json({ success: true, config });
    } catch (err) {
      res.status(500).json({ error: 'Failed to update config.json: ' + err.message });
    }
  });

  // Catch-all
  app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });

  return app;
}

function startDashboard(client) {
  const app = createServer(client);
  const port = process.env.PORT || process.env.SERVER_PORT || config.dashboard?.port || 3000;

  app.listen(port, '0.0.0.0', () => {
    logger.success(`========================================================`);
    logger.success(`🌐 AnDiX Commercial SaaS Platform is LIVE at: http://localhost:${port}`);
    logger.success(`👑 Master Admin Login: ${process.env.ADMIN_EMAIL || 'admin@andix.bot'}`);
    logger.success(`========================================================`);
  });
}

module.exports = { createServer, startDashboard };
