const express = require('express');
const createCartsController = require('../controllers/cartsController');

function createCartsRouter(db) {
  const router = express.Router();
  const {
    createCart,
    getCarts,
    getCartById,
    getCartItemCount,
    updateCart,
    deleteCart,
  } = createCartsController(db);

  // 장바구니 생성
  router.post('/', createCart);

  // 장바구니 전체 조회
  router.get('/', getCarts);

  // 장바구니 아이템 개수 조회 (/:id보다 먼저 정의해야 매칭됨)
  router.get('/count', getCartItemCount);

  // 장바구니 단일 조회
  router.get('/:id', getCartById);

  // 장바구니 수정
  router.patch('/:id', updateCart);

  // 장바구니 삭제
  router.delete('/:id', deleteCart);

  return router;
}

module.exports = createCartsRouter;
