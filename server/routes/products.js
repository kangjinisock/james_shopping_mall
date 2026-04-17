const express = require('express');
const { ObjectId } = require('mongodb');
const { withCreatedAndUpdatedTimestamp } = require('../models/product');

const ALLOWED_CATEGORIES = ['내장재', '외장재', '마감재', '기타 악세사리'];

function parseProductIdOrSendBadRequest(id, res) {
  if (!ObjectId.isValid(id)) {
    res.status(400).json({ message: 'Invalid product id' });
    return null;
  }

  return new ObjectId(id);
}

function parsePrice(rawPrice) {
  if (typeof rawPrice === 'number' && Number.isFinite(rawPrice)) {
    return rawPrice;
  }

  if (typeof rawPrice === 'string' && rawPrice.trim()) {
    const parsed = Number(rawPrice);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function normalizeProductPayload(rawBody, { partial = false } = {}) {
  const payload = {};

  if (!partial || rawBody.sku !== undefined) {
    if (typeof rawBody.sku !== 'string' || !rawBody.sku.trim()) {
      return { error: 'sku is required' };
    }
    payload.sku = rawBody.sku.trim();
  }

  if (!partial || rawBody.name !== undefined) {
    if (typeof rawBody.name !== 'string' || !rawBody.name.trim()) {
      return { error: 'name is required' };
    }
    payload.name = rawBody.name.trim();
  }

  if (!partial || rawBody.price !== undefined) {
    const parsedPrice = parsePrice(rawBody.price);
    if (parsedPrice === null) {
      return { error: 'price must be a valid number' };
    }
    payload.price = parsedPrice;
  }

  if (!partial || rawBody.category !== undefined) {
    if (typeof rawBody.category !== 'string' || !ALLOWED_CATEGORIES.includes(rawBody.category)) {
      return { error: `category must be one of: ${ALLOWED_CATEGORIES.join(', ')}` };
    }
    payload.category = rawBody.category;
  }

  if (!partial || rawBody.image !== undefined) {
    if (typeof rawBody.image !== 'string' || !rawBody.image.trim()) {
      return { error: 'image is required' };
    }
    payload.image = rawBody.image.trim();
  }

  if (rawBody.description !== undefined) {
    if (typeof rawBody.description !== 'string') {
      return { error: 'description must be a string when provided' };
    }
    payload.description = rawBody.description;
  }

  return { payload };
}

function isDuplicateKeyError(error) {
  return error?.code === 11000;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function createProductsRouter(db) {
  const router = express.Router();

  // 상품 생성
  router.post('/', async (req, res) => {
    try {
      const { payload, error } = normalizeProductPayload(req.body || {}, { partial: false });
      if (error) {
        return res.status(400).json({ message: error });
      }

      const productsCollection = db.collection('products');
      const productDocument = withCreatedAndUpdatedTimestamp(payload);
      const result = await productsCollection.insertOne(productDocument);
      const createdProduct = await productsCollection.findOne({ _id: result.insertedId });

      return res.status(201).json({
        message: 'Product created',
        id: result.insertedId,
        product: createdProduct,
      });
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        return res.status(409).json({ message: 'sku already exists' });
      }

      return res.status(400).json({ message: 'Failed to create product', error: error.message });
    }
  });

  // 상품 전체 조회
  router.get('/', async (req, res) => {
    try {
      const parsedPage = Number(req.query.page);
      const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
      const pageSize = 5;
      const skip = (page - 1) * pageSize;
      const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
      const filter = search
        ? { name: { $regex: escapeRegExp(search), $options: 'i' } }
        : {};

      const productsCollection = db.collection('products');
      const [products, totalItems] = await Promise.all([
        productsCollection.find(filter).sort({ createdAt: -1 }).skip(skip).limit(pageSize).toArray(),
        productsCollection.countDocuments(filter),
      ]);
      const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

      return res.status(200).json({
        items: products,
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
      return res.status(500).json({ message: 'Failed to fetch products', error: error.message });
    }
  });

  // 상품 단일 조회
  router.get('/:id', async (req, res) => {
    try {
      const productId = parseProductIdOrSendBadRequest(req.params.id, res);
      if (!productId) {
        return;
      }

      const productsCollection = db.collection('products');
      const product = await productsCollection.findOne({ _id: productId });

      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }

      return res.status(200).json(product);
    } catch (error) {
      return res.status(500).json({ message: 'Failed to fetch product', error: error.message });
    }
  });

  // 상품 수정
  router.patch('/:id', async (req, res) => {
    try {
      const productId = parseProductIdOrSendBadRequest(req.params.id, res);
      if (!productId) {
        return;
      }

      const { payload, error } = normalizeProductPayload(req.body || {}, { partial: true });
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

      const productsCollection = db.collection('products');
      const result = await productsCollection.updateOne(
        { _id: productId },
        { $set: payload }
      );

      if (result.matchedCount === 0) {
        return res.status(404).json({ message: 'Product not found' });
      }

      return res.status(200).json({ message: 'Product updated' });
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        return res.status(409).json({ message: 'sku already exists' });
      }

      return res.status(400).json({ message: 'Failed to update product', error: error.message });
    }
  });

  // 상품 삭제
  router.delete('/:id', async (req, res) => {
    try {
      const productId = parseProductIdOrSendBadRequest(req.params.id, res);
      if (!productId) {
        return;
      }

      const productsCollection = db.collection('products');
      const result = await productsCollection.deleteOne({ _id: productId });

      if (result.deletedCount === 0) {
        return res.status(404).json({ message: 'Product not found' });
      }

      return res.status(200).json({ message: 'Product deleted' });
    } catch (error) {
      return res.status(500).json({ message: 'Failed to delete product', error: error.message });
    }
  });

  return router;
}

module.exports = createProductsRouter;
