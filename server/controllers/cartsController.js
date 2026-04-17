const { ObjectId } = require('mongodb');
const { withCreatedAndUpdatedTimestamp } = require('../models/cart');

const ALLOWED_CART_STATUS = ['active', 'checked_out', 'abandoned'];

function parseCartIdOrSendBadRequest(id, res) {
  if (!ObjectId.isValid(id)) {
    res.status(400).json({ message: 'Invalid cart id' });
    return null;
  }

  return new ObjectId(id);
}

function parseObjectId(rawValue) {
  if (rawValue instanceof ObjectId) {
    return rawValue;
  }

  if (typeof rawValue === 'string' && ObjectId.isValid(rawValue)) {
    return new ObjectId(rawValue);
  }

  return null;
}

function parseNumber(rawValue) {
  if (typeof rawValue === 'number' && Number.isFinite(rawValue)) {
    return rawValue;
  }

  if (typeof rawValue === 'string' && rawValue.trim()) {
    const parsed = Number(rawValue);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function normalizeCartItems(rawItems) {
  if (!Array.isArray(rawItems)) {
    return { error: 'items must be an array' };
  }

  if (rawItems.length === 0) {
    return { error: 'items must contain at least one item' };
  }

  const items = [];

  for (const rawItem of rawItems) {
    if (!rawItem || typeof rawItem !== 'object') {
      return { error: 'each item must be an object' };
    }

    const productId = parseObjectId(rawItem.productId);
    if (!productId) {
      return { error: 'item.productId must be a valid object id' };
    }

    const quantity = parseNumber(rawItem.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      return { error: 'item.quantity must be an integer greater than 0' };
    }

    const unitPrice = parseNumber(rawItem.unitPrice);
    if (unitPrice === null || unitPrice < 0) {
      return { error: 'item.unitPrice must be a number greater than or equal to 0' };
    }

    const normalizedItem = {
      productId,
      quantity,
      unitPrice,
    };

    if (typeof rawItem.name === 'string' && rawItem.name.trim()) {
      normalizedItem.name = rawItem.name.trim();
    }

    if (typeof rawItem.image === 'string' && rawItem.image.trim()) {
      normalizedItem.image = rawItem.image.trim();
    }

    items.push(normalizedItem);
  }

  return { items };
}

function calculateCartTotals(items) {
  return items.reduce(
    (acc, item) => ({
      totalQuantity: acc.totalQuantity + item.quantity,
      totalAmount: acc.totalAmount + item.quantity * item.unitPrice,
    }),
    { totalQuantity: 0, totalAmount: 0 }
  );
}

function normalizeCartPayload(rawBody, { partial = false } = {}) {
  const payload = {};

  if (!partial || rawBody.userId !== undefined) {
    const userId = parseObjectId(rawBody.userId);
    if (!userId) {
      return { error: 'userId must be a valid object id' };
    }
    payload.userId = userId;
  }

  if (!partial || rawBody.items !== undefined) {
    const { items, error } = normalizeCartItems(rawBody.items);
    if (error) {
      return { error };
    }
    payload.items = items;

    const totals = calculateCartTotals(items);
    payload.totalQuantity = totals.totalQuantity;
    payload.totalAmount = totals.totalAmount;
  }

  if (!partial || rawBody.status !== undefined) {
    const status = typeof rawBody.status === 'string' ? rawBody.status.trim() : '';
    if (!ALLOWED_CART_STATUS.includes(status)) {
      return { error: `status must be one of: ${ALLOWED_CART_STATUS.join(', ')}` };
    }
    payload.status = status;
  }

  if (rawBody.currency !== undefined) {
    if (typeof rawBody.currency !== 'string' || !rawBody.currency.trim()) {
      return { error: 'currency must be a non-empty string when provided' };
    }
    payload.currency = rawBody.currency.trim().toUpperCase();
  }

  return { payload };
}

function isDuplicateKeyError(error) {
  return error?.code === 11000;
}

function getCartItemCounts(cart) {
  const items = Array.isArray(cart?.items) ? cart.items : [];
  const distinctItemCount = items.length;
  const totalQuantity = items.reduce((acc, item) => {
    const quantity = Number(item?.quantity);
    return Number.isFinite(quantity) ? acc + quantity : acc;
  }, 0);

  return { distinctItemCount, totalQuantity };
}

function createCartsController(db) {
  // 장바구니 생성
  async function createCart(req, res) {
    try {
      const requestBody = { ...req.body };
      if (requestBody.status === undefined) {
        requestBody.status = 'active';
      }

      const { payload, error } = normalizeCartPayload(requestBody, { partial: false });
      if (error) {
        return res.status(400).json({ message: error });
      }

      const cartsCollection = db.collection('carts');
      const cartDocument = withCreatedAndUpdatedTimestamp(payload);
      const result = await cartsCollection.insertOne(cartDocument);
      const createdCart = await cartsCollection.findOne({ _id: result.insertedId });

      return res.status(201).json({
        message: 'Cart created',
        id: result.insertedId,
        cart: createdCart,
      });
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        return res.status(409).json({ message: 'Active cart already exists for this user' });
      }

      return res.status(400).json({ message: 'Failed to create cart', error: error.message });
    }
  }

  // 장바구니 전체 조회
  async function getCarts(req, res) {
    try {
      const parsedPage = Number(req.query.page);
      const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
      const pageSize = 10;
      const skip = (page - 1) * pageSize;

      const filter = {};
      if (typeof req.query.status === 'string' && req.query.status.trim()) {
        filter.status = req.query.status.trim();
      }

      if (typeof req.query.userId === 'string' && req.query.userId.trim()) {
        const userId = parseObjectId(req.query.userId.trim());
        if (!userId) {
          return res.status(400).json({ message: 'Invalid userId query parameter' });
        }
        filter.userId = userId;
      }

      const cartsCollection = db.collection('carts');
      const [carts, totalItems] = await Promise.all([
        cartsCollection.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(pageSize).toArray(),
        cartsCollection.countDocuments(filter),
      ]);

      const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
      return res.status(200).json({
        items: carts,
        pagination: {
          page,
          pageSize,
          totalItems,
          totalPages,
          hasPreviousPage: page > 1,
          hasNextPage: page < totalPages,
        },
      });
    } catch (error) {
      return res.status(500).json({ message: 'Failed to fetch carts', error: error.message });
    }
  }

  // 장바구니 단일 조회
  async function getCartById(req, res) {
    try {
      const cartId = parseCartIdOrSendBadRequest(req.params.id, res);
      if (!cartId) {
        return;
      }

      const cartsCollection = db.collection('carts');
      const cart = await cartsCollection.findOne({ _id: cartId });

      if (!cart) {
        return res.status(404).json({ message: 'Cart not found' });
      }

      return res.status(200).json(cart);
    } catch (error) {
      return res.status(500).json({ message: 'Failed to fetch cart', error: error.message });
    }
  }

  // 장바구니 아이템 개수 조회
  async function getCartItemCount(req, res) {
    try {
      const userIdRaw = typeof req.query.userId === 'string' ? req.query.userId.trim() : '';
      if (!userIdRaw) {
        return res.status(400).json({ message: 'userId query parameter is required' });
      }

      const userId = parseObjectId(userIdRaw);
      if (!userId) {
        return res.status(400).json({ message: 'Invalid userId query parameter' });
      }

      const statusRaw = typeof req.query.status === 'string' ? req.query.status.trim() : '';
      const status = statusRaw || 'active';
      if (!ALLOWED_CART_STATUS.includes(status)) {
        return res.status(400).json({ message: `status must be one of: ${ALLOWED_CART_STATUS.join(', ')}` });
      }

      const cartsCollection = db.collection('carts');
      const cart = await cartsCollection.findOne({ userId, status });

      if (!cart) {
        return res.status(200).json({
          userId: String(userId),
          status,
          distinctItemCount: 0,
          totalQuantity: 0,
        });
      }

      const { distinctItemCount, totalQuantity } = getCartItemCounts(cart);
      return res.status(200).json({
        cartId: String(cart._id),
        userId: String(cart.userId),
        status,
        distinctItemCount,
        totalQuantity,
      });
    } catch (error) {
      return res.status(500).json({ message: 'Failed to fetch cart item count', error: error.message });
    }
  }

  // 장바구니 수정
  async function updateCart(req, res) {
    try {
      const cartId = parseCartIdOrSendBadRequest(req.params.id, res);
      if (!cartId) {
        return;
      }

      const { payload, error } = normalizeCartPayload(req.body || {}, { partial: true });
      if (error) {
        return res.status(400).json({ message: error });
      }

      delete payload.createdAt;
      delete payload.updatedAt;
      delete payload._id;

      if (Object.keys(payload).length === 0) {
        return res.status(400).json({ message: 'No updatable fields provided' });
      }

      payload.updatedAt = new Date();

      const cartsCollection = db.collection('carts');
      const result = await cartsCollection.updateOne(
        { _id: cartId },
        { $set: payload }
      );

      if (result.matchedCount === 0) {
        return res.status(404).json({ message: 'Cart not found' });
      }

      return res.status(200).json({ message: 'Cart updated' });
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        return res.status(409).json({ message: 'Active cart already exists for this user' });
      }

      return res.status(400).json({ message: 'Failed to update cart', error: error.message });
    }
  }

  // 장바구니 삭제
  async function deleteCart(req, res) {
    try {
      const cartId = parseCartIdOrSendBadRequest(req.params.id, res);
      if (!cartId) {
        return;
      }

      const cartsCollection = db.collection('carts');
      const result = await cartsCollection.deleteOne({ _id: cartId });

      if (result.deletedCount === 0) {
        return res.status(404).json({ message: 'Cart not found' });
      }

      return res.status(200).json({ message: 'Cart deleted' });
    } catch (error) {
      return res.status(500).json({ message: 'Failed to delete cart', error: error.message });
    }
  }

  return {
    createCart,
    getCarts,
    getCartById,
    getCartItemCount,
    updateCart,
    deleteCart,
  };
}

module.exports = createCartsController;
