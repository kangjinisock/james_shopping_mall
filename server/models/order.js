const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  recipient: {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    address: { type: String, required: true },
    request: { type: String }, // 배송 요청사항
  },
  email: { type: String, required: true },
  pointsUsed: { type: Number, default: 0 },
  paymentMethod: { type: String, required: true }, // ex: 'kakaopay', 'naverpay', 'card', ...
  paymentStatus: { type: String, default: 'pending' }, // 'pending', 'paid', 'failed', 'cancelled'
  totalAmount: { type: Number, required: true },
  finalAmount: { type: Number, required: true },
  items: [
    {
      product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
      name: { type: String, required: true },
      image: { type: String },
      quantity: { type: Number, required: true },
      unitPrice: { type: Number, required: true },
      options: { type: Object }, // 사이즈, 색상 등
    }
  ],
  status: {
    type: String,
    enum: ['ordered', 'paid', 'shipped', 'delivered', 'cancelled'],
    default: 'ordered',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('Order', OrderSchema);
