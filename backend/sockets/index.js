const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Message = require('../models/Message');

// Map of online user ids to their active socket ids
// Structure: { [userId]: [socketId1, socketId2, ...] }
const activeConnections = {};

const initSockets = (io) => {
  // Middleware to authenticate socket connections using JWT
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.query.token;

      if (!token) {
        return next(new Error('Authentication error: Token missing'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password');

      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }

      socket.user = user;
      next();
    } catch (err) {
      console.error('Socket authentication failed:', err.message);
      return next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = socket.user._id.toString();
    console.log(`User connected to sockets: ${socket.user.username} (${socket.id})`);

    // Track active connection
    if (!activeConnections[userId]) {
      activeConnections[userId] = [];
    }
    activeConnections[userId].push(socket.id);

    // Automatically join private user room for targeted notifications & alerts
    socket.join(`user_${userId}`);

    // Update user's online status in DB
    try {
      await User.findByIdAndUpdate(userId, { isOnline: true, lastSeen: Date.now() });
      // Notify all users about active user list updates
      io.emit('online_users', Object.keys(activeConnections));
    } catch (dbErr) {
      console.error('Error updating user online status:', dbErr);
    }

    // 1. Join Conversation Room
    socket.on('join_room', (room) => {
      socket.join(room);
      console.log(`Socket ${socket.id} joined room: ${room}`);
    });

    // 2. Leave Conversation Room
    socket.on('leave_room', (room) => {
      socket.leave(room);
      console.log(`Socket ${socket.id} left room: ${room}`);
    });

    // 3. Typing indicator triggers
    socket.on('typing', ({ conversationId, username }) => {
      socket.to(conversationId).emit('typing_received', { conversationId, username });
    });

    socket.on('stop_typing', ({ conversationId, username }) => {
      socket.to(conversationId).emit('stop_typing_received', { conversationId, username });
    });

    // 4. Message Read receipt updates — persist to DB and broadcast
    socket.on('message_read', async ({ messageId, conversationId, readerId }) => {
      try {
        // Persist read status in database
        if (messageId) {
          await Message.findByIdAndUpdate(messageId, {
            $addToSet: { readBy: readerId },
          });
        }
      } catch (err) {
        console.error('Error persisting message read:', err);
      }
      socket.to(conversationId).emit('message_read_received', { messageId, readerId });
    });

    // 5. Handling Disconnect
    socket.on('disconnect', async () => {
      console.log(`User disconnected from sockets: ${socket.user.username} (${socket.id})`);
      
      if (activeConnections[userId]) {
        // Remove current socket ID
        activeConnections[userId] = activeConnections[userId].filter(id => id !== socket.id);
        
        // If no active sockets left for this user
        if (activeConnections[userId].length === 0) {
          delete activeConnections[userId];

          // Set offline status in database
          try {
            await User.findByIdAndUpdate(userId, { isOnline: false, lastSeen: Date.now() });
            // Broadcast updated list of online users
            io.emit('online_users', Object.keys(activeConnections));
          } catch (dbErr) {
            console.error('Error updating user offline status:', dbErr);
          }
        }
      }
    });
  });
};

module.exports = initSockets;
module.exports.activeConnections = activeConnections;
