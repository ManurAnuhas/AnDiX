const express = require('express');
const app = express();
const config = require('../config.json');
const auth = require('../src/modules/auth');
const db = require('../src/modules/database');

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Public Info
app.get('/api/public/info', (req, res) => {
  res.json({
    productName: config.saas?.productName || 'AnDiX Pro Discord Suite',
    pricing: config.saas?.pricing || { setupFeeLkr: 2000, monthlyFeeLkr: 500 },
    bankDetails: config.saas?.bankDetails || {},
    contact: config.saas?.contact || {},
    botInviteUrl: `https://discord.com/oauth2/authorize?client_id=${process.env.CLIENT_ID || '1565283272072761424'}&permissions=8&integration_type=0&scope=bot+applications.commands`
  });
});

// Register
app.post('/api/auth/register', async (req, res) => {
  const { fullName, email, password, discordTag, discordServerName } = req.body;
  if (!fullName || !email || !password) {
    return res.status(400).json({ error: 'All fields required.' });
  }

  const existing = db.findUserByEmail(email);
  if (existing) {
    return res.status(400).json({ error: 'Account already exists. Please log in.' });
  }

  try {
    const passwordHash = await auth.hashPassword(password);
    const user = db.createUser({
      fullName,
      email: email.toLowerCase().trim(),
      passwordHash,
      discordTag: discordTag || '',
      discordServerName: discordServerName || '',
      role: 'client',
      subscription: {
        status: 'pending_payment',
        setupPaid: false,
        monthlyFeeLkr: 500,
        setupFeeLkr: 2000,
        activatedAt: null,
        expiresAt: null
      }
    });

    const token = auth.generateToken(user);
    res.json({ success: true, token, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const cleanEmail = (email || '').toLowerCase().trim();

  // Admin Login
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@andix.bot').toLowerCase().trim();
  const adminPass = process.env.ADMIN_PASSWORD || 'admin123';

  if (cleanEmail === adminEmail && password === adminPass) {
    const adminUser = { id: 'admin_master', email: adminEmail, fullName: 'AnDiX Master Admin', role: 'admin' };
    const token = auth.generateToken(adminUser);
    return res.json({ success: true, token, user: adminUser });
  }

  // Client Login
  const user = db.findUserByEmail(cleanEmail);
  if (!user) return res.status(401).json({ error: 'No account found.' });

  const isMatch = await auth.comparePassword(password, user.passwordHash);
  if (!isMatch) return res.status(401).json({ error: 'Invalid password.' });

  const token = auth.generateToken(user);
  res.json({ success: true, token, user });
});

// Client Me
app.get('/api/client/me', auth.requireAuth, (req, res) => {
  const user = db.findUserById(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user, botInviteUrl: `https://discord.com/oauth2/authorize?client_id=${process.env.CLIENT_ID || '1565283272072761424'}&permissions=8&integration_type=0&scope=bot+applications.commands` });
});

// Submit Payment
app.post('/api/client/submit-payment', auth.requireAuth, (req, res) => {
  const amountLkr = req.body.amountLkr || req.body.amount;
  const slipBase64 = req.body.slipBase64 || req.body.slipImage;
  const { notes, type } = req.body;

  if (!amountLkr || !slipBase64) {
    return res.status(400).json({ success: false, message: 'Amount and slip image required.' });
  }

  const user = db.findUserById(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const payment = db.createPayment({
    userId: user.id,
    userEmail: user.email,
    userName: user.fullName,
    serverName: user.discordServerName,
    amountLkr: Number(amountLkr),
    type: type || 'initial_setup',
    slipBase64,
    notes: notes || 'Bank deposit slip'
  });

  res.json({ success: true, message: 'Payment submitted successfully!', payment });
});

// Payments
app.get('/api/client/payments', auth.requireAuth, (req, res) => {
  res.json(db.getPaymentsByUser(req.user.id));
});

// Admin Overview
app.get('/api/admin/overview', auth.requireAdmin, (req, res) => {
  const users = db.getAllUsers();
  const payments = db.getAllPayments();
  const activeUsers = users.filter(u => u.subscription?.status === 'active').length;
  const pendingPayments = payments.filter(p => p.status === 'pending').length;
  const totalRevenue = payments.filter(p => p.status === 'approved').reduce((sum, p) => sum + (p.amountLkr || 0), 0);

  res.json({
    totalClients: users.length,
    activeSubscriptions: activeUsers,
    pendingVerifications: pendingPayments,
    totalRevenueLkr: totalRevenue,
    mrrLkr: activeUsers * 500,
    botServersCount: 1
  });
});

// Admin Clients
app.get('/api/admin/clients', auth.requireAdmin, (req, res) => {
  res.json({ success: true, clients: db.getAllUsers() });
});

// Admin Payments
app.get('/api/admin/payments', auth.requireAdmin, (req, res) => {
  res.json({ success: true, payments: db.getAllPayments() });
});

// Admin Approve
app.post('/api/admin/payments/:id/approve', auth.requireAdmin, (req, res) => {
  const result = db.approvePayment(req.params.id);
  if (!result) return res.status(404).json({ error: 'Payment not found' });
  res.json({ success: true, message: 'Payment approved!', result });
});

// Admin Reject
app.post('/api/admin/payments/:id/reject', auth.requireAdmin, (req, res) => {
  const payment = db.rejectPayment(req.params.id, req.body.reason);
  if (!payment) return res.status(404).json({ error: 'Payment not found' });
  res.json({ success: true, message: 'Payment rejected', payment });
});

module.exports = app;
