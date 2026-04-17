const productSchemaValidator = {
	$jsonSchema: {
		bsonType: 'object',
		required: ['sku', 'name', 'price', 'category', 'image', 'createdAt', 'updatedAt'],
		additionalProperties: true,
		properties: {
			sku: {
				bsonType: 'string',
				description: 'sku is required and must be a string',
			},
			name: {
				bsonType: 'string',
				description: 'name is required and must be a string',
			},
			price: {
				bsonType: ['int', 'long', 'double', 'decimal'],
				description: 'price is required and must be a number',
			},
			category: {
				bsonType: 'string',
				enum: ['내장재', '외장재', '마감재', '기타 악세사리'],
				description: 'category is required and must be one of the allowed values',
			},
			image: {
				bsonType: 'string',
				description: 'image is required and must be a string',
			},
			description: {
				bsonType: 'string',
				description: 'description is optional and must be a string when provided',
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

function withCreatedAndUpdatedTimestamp(productInput) {
	const now = new Date();
	return {
		...productInput,
		createdAt: now,
		updatedAt: now,
	};
}

async function ensureProductCollectionSchema(db) {
	const collections = await db.listCollections({ name: 'products' }).toArray();

	if (collections.length === 0) {
		await db.createCollection('products', {
			validator: productSchemaValidator,
			validationLevel: 'strict',
			validationAction: 'error',
		});
		console.log('Created products collection with schema validator');
	} else {
		await db.command({
			collMod: 'products',
			validator: productSchemaValidator,
			validationLevel: 'strict',
			validationAction: 'error',
		});
		console.log('Updated products collection schema validator');
	}

	await db.collection('products').createIndex({ sku: 1 }, { unique: true, name: 'uniq_products_sku' });
}

module.exports = {
	productSchemaValidator,
	withCreatedAndUpdatedTimestamp,
	ensureProductCollectionSchema,
};
