require('dotenv').config();

const express = require('express');
const { MongoClient } = require('mongodb');
const { ensureUserCollectionSchema } = require('./models/user');
const { ensureProductCollectionSchema } = require('./models/product');
const { ensureCartCollectionSchema } = require('./models/cart');
const createUsersRouter = require('./routes/users');
const createAuthRouter = require('./routes/auth');
const createProductsRouter = require('./routes/products');
const createCartsRouter = require('./routes/carts');
const createOrdersRouter = require('./routes/orders');
const cors = require('cors');

const app = express();
const port = Number(process.env.PORT) || 5000;
const mongoUri = process.env.MONGODB_ATLAS_URL?.trim() || 'mongodb://127.0.0.1:27017';
const dbName = process.env.DB_NAME || 'shopping-mall';
let mongoClient;
let httpServer;
let isShuttingDown = false;

const localOriginPattern = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const cloudtypeOriginPattern = /^https:\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)*\.cloudtype\.app$/i;
const configuredOrigins = (process.env.CORS_ORIGIN || process.env.CORS_ORIGINS || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (
      !origin
      || localOriginPattern.test(origin)
      || cloudtypeOriginPattern.test(origin)
      || configuredOrigins.includes(origin)
    ) {
      callback(null, true);
      return;
    }

    callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());

let db;

async function connectMongoDB() {
  mongoClient = new MongoClient(mongoUri);
  await mongoClient.connect();
  db = mongoClient.db(dbName);
  console.log('MongoDB connected');
}

function closeHttpServer() {
  return new Promise((resolve) => {
    if (!httpServer) {
      resolve();
      return;
    }

    httpServer.close(() => {
      resolve();
    });
  });
}

async function shutdown(signal, isNodemonRestart = false) {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  console.log(`Received ${signal}, shutting down...`);

  try {
    await closeHttpServer();

    if (mongoClient) {
      await mongoClient.close();
      console.log('MongoDB disconnected');
    }
  } catch (error) {
    console.error('Error during shutdown:', error.message);
  }

  if (isNodemonRestart) {
    process.kill(process.pid, 'SIGUSR2');
    return;
  }

  process.exit(0);
}

app.get('/', (req, res) => {
  res.json({ message: 'Shopping mall API is running' });
});

app.get('/health', async (req, res) => {
  try {
    await db.command({ ping: 1 });
    res.status(200).json({ status: 'ok', database: 'connected' });
  } catch (error) {
    res.status(500).json({ status: 'error', database: 'disconnected', error: error.message });
  }
});

async function startServer() {
  try {
    await connectMongoDB();
    await ensureUserCollectionSchema(db);
    await ensureProductCollectionSchema(db);
    await ensureCartCollectionSchema(db);
    app.use('/users', createUsersRouter(db));
    app.use('/auth', createAuthRouter(db));
    app.use('/products', createProductsRouter(db));
    app.use('/carts', createCartsRouter(db));
    app.use('/orders', createOrdersRouter(db));
    httpServer = app.listen(port, () => {
      console.log(`Server listening on port ${port}`);
    });

    httpServer.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`Port ${port} is already in use. Stop the existing process or change PORT.`);
        process.exit(1);
      }

      console.error('Server failed to listen:', error.message);
      process.exit(1);
    });
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
}

process.on('SIGINT', () => {
  shutdown('SIGINT');
});

process.on('SIGTERM', () => {
  shutdown('SIGTERM');
});

process.once('SIGUSR2', () => {
  shutdown('SIGUSR2', true);
});

startServer();
