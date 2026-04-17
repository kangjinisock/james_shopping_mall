const jwt = require('jsonwebtoken');
const { ObjectId } = require('mongodb');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret-change-me';

function extractBearerToken(authorizationHeader) {
  if (typeof authorizationHeader !== 'string') {
    return null;
  }

  const [scheme, token, ...rest] = authorizationHeader.split(' ');
  if (scheme !== 'Bearer' || !token || rest.length > 0) {
    return null;
  }

  return token;
}

function requireAuth(req, res, next) {
  const token = extractBearerToken(req.headers.authorization);
  if (!token) {
    return res.status(401).json({
      message: 'Authorization token is required',
    });
  }

  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return res.status(401).json({
      message: 'Invalid or expired token',
    });
  }

  const userId = payload?.sub;
  if (!ObjectId.isValid(userId)) {
    return res.status(401).json({
      message: 'Invalid token payload',
    });
  }

  req.auth = payload;
  req.userId = new ObjectId(userId);
  return next();
}

module.exports = {
  extractBearerToken,
  requireAuth,
};
