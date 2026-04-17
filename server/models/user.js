const userSchemaValidator = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['email', 'name', 'password', 'user_type', 'createdAt', 'updatedAt'],
    additionalProperties: true,
    properties: {
      email: {
        bsonType: 'string',
        description: 'email is required and must be a string',
      },
      name: {
        bsonType: 'string',
        description: 'name is required and must be a string',
      },
      password: {
        bsonType: 'string',
        description: 'password is required and must be a string',
      },
      user_type: {
        bsonType: 'string',
        enum: ['customer', 'admin', 'seller'],
        description: 'user_type is required and must be customer, admin, or seller',
      },
      address: {
        bsonType: 'string',
        description: 'address is optional and must be a string when provided',
      },
      gender: {
        bsonType: 'string',
        description: 'gender is optional and must be a string when provided',
      },
      phone: {
        bsonType: 'string',
        description: 'phone is optional and must be a string when provided',
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

function withCreatedAndUpdatedTimestamp(userInput) {
  const now = new Date();
  return {
    ...userInput,
    createdAt: now,
    updatedAt: now,
  };
}

async function ensureUserCollectionSchema(db) {
  const collections = await db.listCollections({ name: 'users' }).toArray();

  if (collections.length === 0) {
    await db.createCollection('users', {
      validator: userSchemaValidator,
      validationLevel: 'strict',
      validationAction: 'error',
    });
    console.log('Created users collection with schema validator');
    return;
  }

  await db.command({
    collMod: 'users',
    validator: userSchemaValidator,
    validationLevel: 'strict',
    validationAction: 'error',
  });
  console.log('Updated users collection schema validator');
}

module.exports = {
  userSchemaValidator,
  withCreatedAndUpdatedTimestamp,
  ensureUserCollectionSchema,
};
