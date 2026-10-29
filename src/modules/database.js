const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const dataDir = path.join(__dirname, '..', '..', 'data');
const dbFilePath = path.join(dataDir, 'database.json');

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let database = {
  guilds: {},
  levels: {},
  warnings: {},
  tickets: {},
  auditLogs: {},
  tempVoiceChannels: {},
  users: {},
  payments: {}
};

// Load database from file
function loadDatabase() {
  try {
    if (fs.existsSync(dbFilePath)) {
      const raw = fs.readFileSync(dbFilePath, 'utf8');
      const loaded = JSON.parse(raw);
      database = {
        ...database,
        ...loaded,
        users: loaded.users || {},
        payments: loaded.payments || {}
      };
    } else {
      saveDatabase();
    }
  } catch (error) {
    logger.error('Failed to load database.json, initializing default:', error);
  }
}

// Save database to disk
let saveTimeout = null;
function saveDatabase(immediate = false) {
  const doSave = () => {
    try {
      fs.writeFileSync(dbFilePath, JSON.stringify(database, null, 2), 'utf8');
    } catch (error) {
      logger.error('Failed to save database.json:', error);
    }
  };

  if (immediate) {
    if (saveTimeout) clearTimeout(saveTimeout);
    doSave();
  } else {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(doSave, 800);
  }
}

// Initial load
loadDatabase();

// MongoDB Integration (Optional for Vercel / Cloud)
let isMongoConnected = false;
if (process.env.MONGODB_URI && process.env.MONGODB_URI.trim() !== '') {
  const mongoose = require('mongoose');
  mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
      isMongoConnected = true;
      logger.success('Connected to MongoDB Atlas Cloud Database!');
    })
    .catch(err => {
      logger.warn('Could not connect to MongoDB URI, continuing with JSON database:', err.message);
    });
}

const db = {
  // Guild Settings
  getGuildSettings: (guildId) => {
    if (!database.guilds[guildId]) {
      database.guilds[guildId] = {
        welcomeChannel: null,
        goodbyeChannel: null,
        modLogChannel: null,
        streamChannel: null,
        streamPingRole: null,
        autoRoleId: null,
        verificationRole: null,
        verificationChannel: null,
        ticketCategory: null,
        ticketChannel: null,
        tempVoiceHubChannel: null,
        automodEnabled: true
      };
      saveDatabase();
    }
    return database.guilds[guildId];
  },

  updateGuildSettings: (guildId, keyOrObj, value) => {
    const settings = db.getGuildSettings(guildId);
    if (typeof keyOrObj === 'object' && keyOrObj !== null) {
      Object.assign(settings, keyOrObj);
    } else {
      settings[keyOrObj] = value;
    }
    saveDatabase();
    return settings;
  },

  // Levels & XP
  getUserLevel: (guildId, userId) => {
    if (!database.levels[guildId]) database.levels[guildId] = {};
    if (!database.levels[guildId][userId]) {
      database.levels[guildId][userId] = { xp: 0, level: 0, totalXp: 0, lastXpEarned: 0 };
    }
    return database.levels[guildId][userId];
  },

  setUserLevel: (guildId, userId, data) => {
    if (!database.levels[guildId]) database.levels[guildId] = {};
    database.levels[guildId][userId] = {
      ...db.getUserLevel(guildId, userId),
      ...data
    };
    saveDatabase();
    return database.levels[guildId][userId];
  },

  getLeaderboard: (guildId, limit = 10) => {
    if (!database.levels[guildId]) return [];
    const users = Object.entries(database.levels[guildId]).map(([userId, data]) => ({
      userId,
      ...data
    }));
    users.sort((a, b) => b.totalXp - a.totalXp);
    return users.slice(0, limit);
  },

  // Warnings
  addWarning: (guildId, userId, warning) => {
    if (!database.warnings[guildId]) database.warnings[guildId] = {};
    if (!database.warnings[guildId][userId]) database.warnings[guildId][userId] = [];
    database.warnings[guildId][userId].push({ ...warning, timestamp: Date.now() });
    saveDatabase();
    return database.warnings[guildId][userId];
  },

  getWarnings: (guildId, userId) => {
    return database.warnings[guildId]?.[userId] || [];
  },

  clearWarnings: (guildId, userId) => {
    if (database.warnings[guildId] && database.warnings[guildId][userId]) {
      database.warnings[guildId][userId] = [];
      saveDatabase();
      return true;
    }
    return false;
  },

  // Tickets
  saveTicket: (guildId, channelId, data) => {
    if (!database.tickets[guildId]) database.tickets[guildId] = {};
    database.tickets[guildId][channelId] = { ...data, timestamp: Date.now() };
    saveDatabase();
  },

  getTicket: (guildId, channelId) => {
    return database.tickets[guildId]?.[channelId] || null;
  },

  closeTicket: (guildId, channelId) => {
    if (database.tickets[guildId]?.[channelId]) {
      delete database.tickets[guildId][channelId];
      saveDatabase();
    }
  },

  // Audit Logs
  logEvent: (guildId, event) => {
    if (!database.auditLogs[guildId]) database.auditLogs[guildId] = [];
    database.auditLogs[guildId].unshift({ ...event, timestamp: Date.now() });
    if (database.auditLogs[guildId].length > 100) {
      database.auditLogs[guildId] = database.auditLogs[guildId].slice(0, 100);
    }
    saveDatabase();
  },

  getAuditLogs: (guildId, limit = 30) => {
    return (database.auditLogs[guildId] || []).slice(0, limit);
  },

  // Temp Voice Tracking
  addTempVoice: (channelId, ownerId) => {
    if (!database.tempVoiceChannels) database.tempVoiceChannels = {};
    database.tempVoiceChannels[channelId] = { ownerId, created: Date.now() };
    saveDatabase();
  },

  removeTempVoice: (channelId) => {
    if (database.tempVoiceChannels && database.tempVoiceChannels[channelId]) {
      delete database.tempVoiceChannels[channelId];
      saveDatabase();
      return true;
    }
    return false;
  },

  isTempVoice: (channelId) => {
    return Boolean(database.tempVoiceChannels && database.tempVoiceChannels[channelId]);
  },

  // ==========================================
  // SAAS CLIENT ACCOUNTS & SUBSCRIPTIONS
  // ==========================================
  createUser: (userData) => {
    const id = 'usr_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    const user = {
      id,
      ...userData,
      role: userData.role || 'client',
      subscription: userData.subscription || {
        status: 'pending_payment',
        setupPaid: false,
        monthlyFeeLkr: 500,
        setupFeeLkr: 2000,
        activatedAt: null,
        expiresAt: null
      },
      createdAt: Date.now()
    };
    database.users[id] = user;
    saveDatabase(true);
    return user;
  },

  findUserByEmail: (email) => {
    const cleanEmail = email.toLowerCase().trim();
    return Object.values(database.users).find(u => u.email.toLowerCase() === cleanEmail) || null;
  },

  findUserById: (id) => {
    return database.users[id] || null;
  },

  updateUser: (id, updates) => {
    if (database.users[id]) {
      database.users[id] = {
        ...database.users[id],
        ...updates
      };
      saveDatabase(true);
      return database.users[id];
    }
    return null;
  },

  getAllUsers: () => {
    return Object.values(database.users);
  },

  // ==========================================
  // SAAS PAYMENTS & SLIPS
  // ==========================================
  createPayment: (paymentData) => {
    const id = 'pay_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    const payment = {
      id,
      ...paymentData,
      status: 'pending',
      createdAt: Date.now(),
      approvedAt: null
    };
    database.payments[id] = payment;
    saveDatabase(true);
    return payment;
  },

  getAllPayments: () => {
    return Object.values(database.payments).sort((a, b) => b.createdAt - a.createdAt);
  },

  getPaymentsByUser: (userId) => {
    return Object.values(database.payments).filter(p => p.userId === userId).sort((a, b) => b.createdAt - a.createdAt);
  },

  approvePayment: (paymentId) => {
    const payment = database.payments[paymentId];
    if (!payment) return null;

    payment.status = 'approved';
    payment.approvedAt = Date.now();

    // Activate or extend client subscription
    const user = database.users[payment.userId];
    if (user) {
      const oneMonthMs = 30 * 24 * 60 * 60 * 1000;
      const currentExpiry = (user.subscription.expiresAt && user.subscription.expiresAt > Date.now())
        ? user.subscription.expiresAt
        : Date.now();

      user.subscription.status = 'active';
      user.subscription.setupPaid = true;
      user.subscription.activatedAt = user.subscription.activatedAt || Date.now();
      user.subscription.expiresAt = currentExpiry + oneMonthMs;
    }

    saveDatabase(true);
    return { payment, user };
  },

  rejectPayment: (paymentId, reason) => {
    const payment = database.payments[paymentId];
    if (!payment) return null;

    payment.status = 'rejected';
    payment.rejectReason = reason || 'Invalid or unverified receipt';
    saveDatabase(true);
    return payment;
  },

  forceSave: () => saveDatabase(true)
};

// Auto flush on process exit
process.on('SIGINT', () => {
  db.forceSave();
  process.exit();
});

process.on('SIGTERM', () => {
  db.forceSave();
  process.exit();
});

module.exports = db;
