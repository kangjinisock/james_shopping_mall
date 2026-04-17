const cartSchemaValidator = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['userId', 'items', 'status', 'createdAt', 'updatedAt'],
    additionalProperties: true,
    properties: {
      userId: {
        bsonType: 'objectId',
        description: 'userId is required and must be an ObjectId',
      },
      items: {
        bsonType: 'array',
        description: 'items is required and must be an array',
        items: {
          bsonType: 'object',
          required: ['productId', 'quantity', 'unitPrice'],
          additionalProperties: true,
          properties: {
            productId: {
              bsonType: 'objectId',
              description: 'productId is required and must be an ObjectId',
            },
            quantity: {
              bsonType: ['int', 'long'],
              minimum: 1,
              description: 'quantity is required and must be an integer >= 1',
            },
            unitPrice: {
              bsonType: ['int', 'long', 'double', 'decimal'],
              minimum: 0,
              description: 'unitPrice is required and must be a number >= 0',
            },
            name: {
              bsonType: 'string',
              description: 'name is optional and must be a string when provided',
            },
            image: {
              bsonType: 'string',
              description: 'image is optional and must be a string when provided',
            },
          },
        },
      },
      status: {
        bsonType: 'string',
        enum: ['active', 'checked_out', 'abandoned'],
        description: 'status is required and must be active, checked_out, or abandoned',
      },
      totalQuantity: {
        bsonType: ['int', 'long'],
        minimum: 0,
        description: 'totalQuantity is optional and must be an integer >= 0 when provided',
      },
      totalAmount: {
        bsonType: ['int', 'long', 'double', 'decimal'],
        minimum: 0,
        description: 'totalAmount is optional and must be a number >= 0 when provided',
      },
      currency: {
        bsonType: 'string',
        description: 'currency is optional and must be a string when provided',
      },
      createdAt: {
        bsonType: 'date',
        description: 'createdAt is required and must be a date',
      },
      updatedAt: {
        bsonType: 'date',
        description: 'updatedAt is required and must be a date',
      },
    },
  },
};

function withCreatedAndUpdatedTimestamp(cartInput) {
  const now = new Date();
  return {
    ...cartInput,
    createdAt: now,
    updatedAt: now,
  };
}

async function ensureCartCollectionSchema(db) {
  const collections = await db.listCollections({ name: 'carts' }).toArray();

  if (collections.length === 0) {
    await db.createCollection('carts', {
      validator: cartSchemaValidator,
      validationLevel: 'strict',
      validationAction: 'error',
    });
    console.log('Created carts collection with schema validator');
  } else {
    await db.command({
      collMod: 'carts',
      validator: cartSchemaValidator,
      validationLevel: 'strict',
      validationAction: 'error',
    });
    console.log('Updated carts collection schema validator');
  }

  await db.collection('carts').createIndex(
    { userId: 1, status: 1 },
    {
      unique: true,
      partialFilterExpression: { status: 'active' },
      name: 'uniq_active_cart_per_user',
    }
  );
}

module.exports = {
  cartSchemaValidator,
  withCreatedAndUpdatedTimestamp,
  ensureCartCollectionSchema,
};
