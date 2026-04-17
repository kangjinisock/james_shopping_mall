const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret-change-me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

function sanitizeUser(user) {
  if (!user) {
    return null;
  }

  const { password, ...safeUser } = user;
  return safeUser;
}

function createAuthController(db) {
  async function login(req, res) {
    try {
      const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
      const password = typeof req.body?.password === 'string' ? req.body.password : '';

      if (!email || !password) {
        return res.status(400).json({
          message: 'Email and password are required',
        });
      }

      const usersCollection = db.collection('users');
      const user = await usersCollection.findOne({ email });

      if (!user || typeof user.password !== 'string') {
        return res.status(401).json({
          message: 'Invalid email or password',
        });
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);

      if (!isPasswordValid) {
        return res.status(401).json({
          message: 'Invalid email or password',
        });
      }

      const accessToken = jwt.sign(
        {
          sub: String(user._id),
          email: user.email,
          user_type: user.user_type,
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );

      return res.status(200).json({
        message: 'Login successful',
        accessToken,
        tokenType: 'Bearer',
        expiresIn: JWT_EXPIRES_IN,
        user: sanitizeUser(user),
      });
    } catch (error) {
      return res.status(500).json({
        message: 'Login failed',
        error: error.message,
      });
    }
  }

  async function getMe(req, res) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          message: 'Authorization token is required',
        });
      }

      const usersCollection = db.collection('users');
      const user = await usersCollection.findOne({ _id: req.userId });

      if (!user) {
        return res.status(404).json({
          message: 'User not found',
        });
      }

      return res.status(200).json({
        message: 'User fetched',
        user: sanitizeUser(user),
      });
    } catch (error) {
      return res.status(500).json({
        message: 'Failed to fetch user info',
        error: error.message,
      });
    }
  }

  return {
    login,
    getMe,
  };
}

module.exports = createAuthController;
