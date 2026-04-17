const { ObjectId } = require('mongodb');
const bcrypt = require('bcryptjs');
const { withCreatedAndUpdatedTimestamp } = require('../models/user');

const PASSWORD_SALT_ROUNDS = 10;

function createUsersController(db) {
  function parseUserIdOrSendBadRequest(id, res) {
    if (!ObjectId.isValid(id)) {
      res.status(400).json({ message: 'Invalid user id' });
      return null;
    }

    return new ObjectId(id);
  }

  // 유저 생성
  async function createUser(req, res) {
    try {
      if (typeof req.body.password !== 'string' || req.body.password.length === 0) {
        return res.status(400).json({ message: 'Password is required' });
      }

      const usersCollection = db.collection('users');
      const hashedPassword = await bcrypt.hash(req.body.password, PASSWORD_SALT_ROUNDS);
      const userDocument = withCreatedAndUpdatedTimestamp({
        ...req.body,
        password: hashedPassword,
      });
      const result = await usersCollection.insertOne(userDocument);
      const createdUser = await usersCollection.findOne({ _id: result.insertedId });

      res.status(201).json({
        message: 'User created',
        id: result.insertedId,
        user: createdUser,
      });
    } catch (error) {
      res.status(400).json({
        message: 'Failed to create user',
        error: error.message,
      });
    }
  }

  // 유저 전체 조회
  async function getUsers(req, res) {
    try {
      const usersCollection = db.collection('users');
      const users = await usersCollection
        .find({}, { projection: { password: 0 } })
        .sort({ createdAt: -1 })
        .toArray();
      res.status(200).json(users);
    } catch (error) {
      res.status(500).json({
        message: 'Failed to fetch users',
        error: error.message,
      });
    }
  }

  // 유저 단일 조회
  async function getUserById(req, res) {
    try {
      const userId = parseUserIdOrSendBadRequest(req.params.id, res);
      if (!userId) {
        return;
      }

      const usersCollection = db.collection('users');
      const user = await usersCollection.findOne({ _id: userId });

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      res.status(200).json(user);
    } catch (error) {
      res.status(500).json({
        message: 'Failed to fetch user',
        error: error.message,
      });
    }
  }

  // 유저 수정
  async function updateUser(req, res) {
    try {
      const userId = parseUserIdOrSendBadRequest(req.params.id, res);
      if (!userId) {
        return;
      }

      const usersCollection = db.collection('users');
      const updatePayload = {
        ...req.body,
        updatedAt: new Date(),
      };

      if (typeof updatePayload.password === 'string' && updatePayload.password.length > 0) {
        updatePayload.password = await bcrypt.hash(updatePayload.password, PASSWORD_SALT_ROUNDS);
      }

      delete updatePayload.createdAt;

      const result = await usersCollection.updateOne(
        { _id: userId },
        { $set: updatePayload }
      );

      if (result.matchedCount === 0) {
        return res.status(404).json({ message: 'User not found' });
      }

      res.status(200).json({ message: 'User updated' });
    } catch (error) {
      res.status(400).json({
        message: 'Failed to update user',
        error: error.message,
      });
    }
  }

  // 유저 삭제
  async function deleteUser(req, res) {
    try {
      const userId = parseUserIdOrSendBadRequest(req.params.id, res);
      if (!userId) {
        return;
      }

      const usersCollection = db.collection('users');
      const result = await usersCollection.deleteOne({ _id: userId });

      if (result.deletedCount === 0) {
        return res.status(404).json({ message: 'User not found' });
      }

      res.status(200).json({ message: 'User deleted' });
    } catch (error) {
      res.status(500).json({
        message: 'Failed to delete user',
        error: error.message,
      });
    }
  }

  return {
    createUser,
    getUsers,
    getUserById,
    updateUser,
    deleteUser,
  };
}

module.exports = createUsersController;
