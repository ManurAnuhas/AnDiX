const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./database');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.warn('⚠️ WARNING: JWT_SECRET environment variable is not defined! Using fallback session key.');
}
const ACTIVE_JWT_SECRET = JWT_SECRET || 'andix_fallback_secret_must_set_env';

const auth = {
  hashPassword: async (password) => {
    return await bcrypt.hash(password, 10);
  },

  comparePassword: async (password, hash) => {
    return await bcrypt.compare(password, hash);
  },

  generateToken: (user) => {
    return jwt.sign(
      {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role || 'client'
      },
      ACTIVE_JWT_SECRET,
      { expiresIn: '7d' }
    );
  },

  verifyToken: (token) => {
    try {
      return jwt.verify(token, ACTIVE_JWT_SECRET);
    } catch (err) {
      return null;
    }
  },

  requireAuth: (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = (authHeader && authHeader.startsWith('Bearer '))
      ? authHeader.split(' ')[1]
      : (req.headers['x-auth-token'] || req.query.token);

    if (!token) {
      return res.status(401).json({ error: 'Authentication required. Please login.' });
    }

    const decoded = auth.verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid or expired session. Please login again.' });
    }

    const user = db.findUserById(decoded.id);
    if (!user) {
      // Check if it's the master admin login
      if (decoded.role === 'admin') {
        req.user = decoded;
        return next();
      }
      return res.status(401).json({ error: 'User account not found.' });
    }

    req.user = user;
    next();
  },

  requireAdmin: (req, res, next) => {
    auth.requireAuth(req, res, () => {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied: Master Admin permissions required.' });
      }
      next();
    });
  }
};

module.exports = auth;

