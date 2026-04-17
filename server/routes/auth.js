const express = require('express');
const createAuthController = require('../controllers/authController');
const { requireAuth } = require('../middlewares/auth');

function createAuthRouter(db) {
  const router = express.Router();
  const { login, getMe } = createAuthController(db);

  // 로그인
  router.post('/login', login);

  // 토큰 기반 내 정보 조회
  router.get('/me', requireAuth, getMe);

  return router;
}

module.exports = createAuthRouter;
