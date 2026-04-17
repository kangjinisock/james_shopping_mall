const express = require('express');
const createUsersController = require('../controllers/usersController');

function createUsersRouter(db) {
  const router = express.Router();
  const {
    createUser,
    getUsers,
    getUserById,
    updateUser,
    deleteUser,
  } = createUsersController(db);

  // 유저 생성
  router.post('/', createUser);

  // 유저 전체 조회
  router.get('/', getUsers);

  // 유저 단일 조회
  router.get('/:id', getUserById);

  // 유저 수정
  router.patch('/:id', updateUser);

  // 유저 삭제
  router.delete('/:id', deleteUser);

  return router;
}

module.exports = createUsersRouter;
