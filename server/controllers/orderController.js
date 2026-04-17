const Order = require('../models/order');

// 주문 생성
exports.createOrder = async (req, res) => {
  try {
    const order = new Order({
      ...req.body,
      user: req.user._id,
    });
    const saved = await order.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// 주문 전체 조회 (관리자/본인)
exports.getOrders = async (req, res) => {
  try {
    const query = req.user.user_type === 'admin' ? {} : { user: req.user._id };
    const orders = await Order.find(query).sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 주문 상세 조회
exports.getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (req.user.user_type !== 'admin' && String(order.user) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    res.json(order);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 주문 상태/결제정보 업데이트
exports.updateOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (req.user.user_type !== 'admin' && String(order.user) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    Object.assign(order, req.body);
    order.updatedAt = new Date();
    const updated = await order.save();
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// 주문 취소(삭제)
exports.deleteOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (req.user.user_type !== 'admin' && String(order.user) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    await order.deleteOne();
    res.json({ message: 'Order deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
