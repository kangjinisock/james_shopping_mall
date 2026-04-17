const express = require('express');
const { ObjectId } = require('mongodb');
const { requireAuth } = require('../middlewares/auth');

const ALLOWED_PAYMENT_METHODS = ['kakaopay', 'naverpay', 'payco', 'tosspay', 'card', 'account'];
const ALLOWED_PAYMENT_STATUSES = ['pending', 'paid', 'failed', 'cancelled'];
const ALLOWED_ORDER_STATUSES = ['ordered', 'paid', 'shipped', 'delivered', 'cancelled'];

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function parseNonNegativeNumber(value) {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function parseOrderIdOrSendBadRequest(id, res) {
  if (!ObjectId.isValid(id)) {
    res.status(400).json({ message: 'Invalid order id' });
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

function validateShippingInfo(body) {
  const recipient = body?.recipient || {};
  const name = normalizeString(recipient.name);
  const phone = normalizeString(recipient.phone);
  const address = normalizeString(recipient.address);
  const request = normalizeString(recipient.request);

  if (!name || !phone || !address) {
    return { error: '배송지 정보가 누락되었습니다.' };
  }

  return {
    recipient: {
      name,
      phone,
      address,
      request,
    },
  };
}

function validatePaymentData(body) {
  const paymentMethod = normalizeString(body?.paymentMethod);
  const paymentStatus = normalizeString(body?.paymentStatus || 'paid');
  const imp_uid = normalizeString(body?.imp_uid);
  const merchant_uid = normalizeString(body?.merchant_uid);
  const totalAmount = parseNonNegativeNumber(body?.totalAmount);
  const pointsUsed = parseNonNegativeNumber(body?.pointsUsed ?? 0);
  const finalAmount = parseNonNegativeNumber(body?.finalAmount);
  const paidAmount = parseNonNegativeNumber(body?.paidAmount ?? body?.finalAmount);

  if (!ALLOWED_PAYMENT_METHODS.includes(paymentMethod)) {
    return { error: '지원하지 않는 결제수단입니다.' };
  }

  if (!ALLOWED_PAYMENT_STATUSES.includes(paymentStatus)) {
    return { error: '유효하지 않은 결제 상태입니다.' };
  }

  if (!imp_uid || !merchant_uid) {
    return { error: '결제 검증 정보가 누락되었습니다.' };
  }

  if (totalAmount === null || pointsUsed === null || finalAmount === null || paidAmount === null) {
    return { error: '결제 금액 정보가 올바르지 않습니다.' };
  }

  if (finalAmount > totalAmount || totalAmount - pointsUsed !== finalAmount) {
    return { error: '결제 데이터 검증에 실패했습니다.' };
  }

  if (paymentStatus === 'paid' && paidAmount !== finalAmount) {
    return { error: '실결제 금액 검증에 실패했습니다.' };
  }

  return {
    payment: {
      paymentMethod,
      paymentStatus,
      imp_uid,
      merchant_uid,
      totalAmount,
      pointsUsed,
      finalAmount,
      paidAmount,
    },
  };
}

async function generateUniqueOrderNumber(ordersCollection) {
  const now = new Date();
  const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;

  for (let index = 0; index < 10; index += 1) {
    const randomPart = Math.floor(100000 + Math.random() * 900000);
    const orderNumber = `ORD-${datePart}-${randomPart}`;
    const existing = await ordersCollection.findOne({ orderNumber }, { projection: { _id: 1 } });
    if (!existing) {
      return orderNumber;
    }
  }

  throw new Error('주문번호 생성에 실패했습니다.');
}

function buildOrderItems(cartItems, productMap) {
  return cartItems
    .map((item) => {
      const productId = parseObjectId(item?.productId) || parseObjectId(item?.product);
      const product = productId ? productMap.get(String(productId)) : null;
      const quantity = Number(item?.quantity) || 0;
      const unitPrice = Number(item?.unitPrice ?? product?.price ?? 0);

      return {
        product: productId,
        name: normalizeString(item?.name) || product?.name || '상품',
        image: normalizeString(item?.image) || product?.image || '',
        quantity,
        unitPrice,
        options: {
          size: normalizeString(item?.size || item?.options?.size),
          color: normalizeString(item?.color || item?.options?.color),
        },
        productInfo: product
          ? {
              sku: product.sku || '',
              category: product.category || '',
              price: Number(product.price) || unitPrice,
              description: product.description || '',
            }
          : null,
      };
    })
    .filter((item) => item.quantity > 0);
}

function createOrdersRouter(db) {
  const router = express.Router();

  router.post('/', requireAuth, async (req, res) => {
    try {
      const { recipient, error: shippingError } = validateShippingInfo(req.body);
      if (shippingError) {
        return res.status(400).json({ message: shippingError });
      }

      const { payment, error: paymentError } = validatePaymentData(req.body);
      if (paymentError) {
        return res.status(400).json({ message: paymentError });
      }

      const email = normalizeString(req.body?.email || req.auth?.email);
      if (!email) {
        return res.status(400).json({ message: '주문자 이메일이 필요합니다.' });
      }

      const cartsCollection = db.collection('carts');
      const ordersCollection = db.collection('orders');
      const productsCollection = db.collection('products');

      const requestCartId = normalizeString(req.body?.cartId);
      const requestedItems = Array.isArray(req.body?.items) ? req.body.items : [];
      const activeCart = await cartsCollection.findOne({ userId: req.userId, status: 'active' });

      let sourceCartId = '';
      let sourceItems = [];

      if (requestCartId) {
        if (!activeCart || !Array.isArray(activeCart.items) || activeCart.items.length === 0) {
          return res.status(400).json({ message: '주문 가능한 장바구니가 없습니다.' });
        }

        if (String(activeCart._id) !== requestCartId) {
          return res.status(409).json({ message: '장바구니 정보가 변경되었습니다. 다시 시도해 주세요.' });
        }

        sourceCartId = String(activeCart._id);
        sourceItems = activeCart.items;
      } else if (requestedItems.length > 0) {
        sourceItems = requestedItems;
      } else if (activeCart && Array.isArray(activeCart.items) && activeCart.items.length > 0) {
        sourceCartId = String(activeCart._id);
        sourceItems = activeCart.items;
      } else {
        return res.status(400).json({ message: '주문할 상품 정보가 없습니다.' });
      }

      const duplicateOrder = await ordersCollection.findOne({
        $or: [{ imp_uid: payment.imp_uid }, { merchant_uid: payment.merchant_uid }],
      });
      if (duplicateOrder) {
        return res.status(409).json({ message: '이미 처리된 주문입니다.' });
      }

      if (sourceCartId) {
        const duplicateByCart = await ordersCollection.findOne({
          user: req.userId,
          sourceCartId,
          paymentStatus: 'paid',
        });
        if (duplicateByCart) {
          return res.status(409).json({ message: '이미 주문이 완료된 장바구니입니다.' });
        }
      }

      const computedTotalAmount = Array.isArray(sourceItems)
        ? sourceItems.reduce((sum, item) => sum + (Number(item.unitPrice) || 0) * (Number(item.quantity) || 0), 0)
        : 0;

      if (computedTotalAmount !== payment.totalAmount) {
        return res.status(400).json({ message: '주문 금액과 결제 금액이 일치하지 않습니다.' });
      }

      const productIds = sourceItems
        .map((item) => parseObjectId(item?.productId) || parseObjectId(item?.product))
        .filter(Boolean);

      const products = productIds.length > 0
        ? await productsCollection.find({ _id: { $in: productIds } }).toArray()
        : [];
      const productMap = new Map(products.map((product) => [String(product._id), product]));

      const orderItems = buildOrderItems(sourceItems, productMap);
      if (orderItems.length === 0) {
        return res.status(400).json({ message: '주문 아이템 생성에 실패했습니다.' });
      }

      const orderNumber = await generateUniqueOrderNumber(ordersCollection);
      const now = new Date();
      const orderDocument = {
        orderNumber,
        user: req.userId,
        recipient,
        email,
        pointsUsed: payment.pointsUsed,
        paymentMethod: payment.paymentMethod,
        paymentStatus: payment.paymentStatus,
        totalAmount: payment.totalAmount,
        finalAmount: payment.finalAmount,
        paidAmount: payment.paidAmount,
        imp_uid: payment.imp_uid,
        merchant_uid: payment.merchant_uid,
        items: orderItems,
        status: 'paid',
        sourceCartId: sourceCartId || null,
        totalQuantity: orderItems.reduce((sum, item) => sum + item.quantity, 0),
        createdAt: now,
        updatedAt: now,
      };

      const result = await ordersCollection.insertOne(orderDocument);

      if (sourceCartId && activeCart?._id) {
        await cartsCollection.updateOne(
          { _id: activeCart._id },
          {
            $set: {
              items: [],
              totalQuantity: 0,
              totalAmount: 0,
              status: 'checked_out',
              updatedAt: now,
            },
          }
        );
      }

      return res.status(201).json({
        _id: result.insertedId,
        ...orderDocument,
      });
    } catch (err) {
      return res.status(400).json({ message: err.message });
    }
  });

  router.get('/', requireAuth, async (req, res) => {
    try {
      const query = req.auth?.user_type === 'admin' ? {} : { user: req.userId };
      const orders = await db.collection('orders').find(query).sort({ createdAt: -1 }).toArray();
      return res.json(orders);
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }
  });

  router.get('/:id', requireAuth, async (req, res) => {
    try {
      const orderId = parseOrderIdOrSendBadRequest(req.params.id, res);
      if (!orderId) {
        return;
      }

      const order = await db.collection('orders').findOne({ _id: orderId });
      if (!order) {
        return res.status(404).json({ message: 'Order not found' });
      }
      if (req.auth?.user_type !== 'admin' && String(order.user) !== String(req.userId)) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      return res.json(order);
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }
  });

  router.patch('/:id', requireAuth, async (req, res) => {
    try {
      const orderId = parseOrderIdOrSendBadRequest(req.params.id, res);
      if (!orderId) {
        return;
      }

      const order = await db.collection('orders').findOne({ _id: orderId });
      if (!order) {
        return res.status(404).json({ message: 'Order not found' });
      }
      if (req.auth?.user_type !== 'admin' && String(order.user) !== String(req.userId)) {
        return res.status(403).json({ message: 'Forbidden' });
      }

      const nextStatus = normalizeString(req.body?.status).toLowerCase();
      const nextPaymentStatus = normalizeString(req.body?.paymentStatus).toLowerCase();

      if (nextStatus && !ALLOWED_ORDER_STATUSES.includes(nextStatus)) {
        return res.status(400).json({ message: '유효하지 않은 주문 상태입니다.' });
      }

      if (nextPaymentStatus && !ALLOWED_PAYMENT_STATUSES.includes(nextPaymentStatus)) {
        return res.status(400).json({ message: '유효하지 않은 결제 상태입니다.' });
      }

      const updateData = { ...req.body, updatedAt: new Date() };

      if (nextStatus) {
        updateData.status = nextStatus;

        if (nextStatus === 'ordered') {
          updateData.paymentStatus = 'pending';
        } else if (nextStatus === 'cancelled') {
          updateData.paymentStatus = 'cancelled';
        } else {
          updateData.paymentStatus = 'paid';
        }
      } else if (nextPaymentStatus) {
        updateData.paymentStatus = nextPaymentStatus;

        if (nextPaymentStatus === 'pending') {
          updateData.status = 'ordered';
        } else if (['failed', 'cancelled'].includes(nextPaymentStatus)) {
          updateData.status = 'cancelled';
        } else if (!order.status || ['ordered', 'paid'].includes(String(order.status).toLowerCase())) {
          updateData.status = 'paid';
        }
      }
      await db.collection('orders').updateOne({ _id: orderId }, { $set: updateData });
      const updated = await db.collection('orders').findOne({ _id: orderId });
      return res.json(updated);
    } catch (err) {
      return res.status(400).json({ message: err.message });
    }
  });

  router.delete('/:id', requireAuth, async (req, res) => {
    try {
      const orderId = parseOrderIdOrSendBadRequest(req.params.id, res);
      if (!orderId) {
        return;
      }

      const order = await db.collection('orders').findOne({ _id: orderId });
      if (!order) {
        return res.status(404).json({ message: 'Order not found' });
      }
      if (req.auth?.user_type !== 'admin' && String(order.user) !== String(req.userId)) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      await db.collection('orders').deleteOne({ _id: orderId });
      return res.json({ message: 'Order deleted' });
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }
  });

  return router;
}

module.exports = createOrdersRouter;
