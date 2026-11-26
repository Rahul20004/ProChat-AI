// ─── CRITICAL: Load .env FIRST before anything else ─────────────────────────
require('dotenv').config();

const express = require('express');
const http = require('http');
const socketio = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');

const connectDB = require('./config/db');
const initSockets = require('./sockets');
const User = require('./models/User');

// Route imports
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const messageRoutes = require('./routes/message.routes');
const conversationRoutes = require('./routes/conversation.routes');
const aiRoutes = require('./routes/ai.routes');
const analyticsRoutes = require('./routes/analytics.routes');
const notificationRoutes = require('./routes/notification.routes');

// ─── Global crash catchers (catch ANY unhandled error before it kills the process) ───
process.on('uncaughtException', (err) => {
  console.error('💀 UNCAUGHT EXCEPTION — Server crashing:');
  console.error(`   → ${err.message}`);
  console.error(err.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💀 UNHANDLED PROMISE REJECTION — Server crashing:');
  console.error(`   → ${reason}`);
  if (reason && reason.stack) console.error(reason.stack);
  process.exit(1);
});

const app = express();
const server = http.createServer(app);

// Enable Socket.io with CORS configured
const io = socketio(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
  },
});

// Store io instance inside app context for controller access
app.set('io', io);

// Security & Middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Global Rate Limiting for general API queries
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Limit each IP to 300 requests per window
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again after 15 minutes',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', apiLimiter);

// API Endpoints
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/ai', aiRoutes);
// Route aliases for backward compatibility and path prefix variations
app.use('/api/api/ai', aiRoutes);
app.use('/ai', aiRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/notifications', notificationRoutes);

// Base Route
app.get('/', (req, res) => {
  res.json({ message: 'ProChat AI platform APIs running successfully' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err.stack);
  res.status(500).json({
    success: false,
    message: 'Server Error: An unexpected error occurred on the server',
    error: process.env.NODE_ENV === 'development' ? err.message : {},
  });
});

// Initialize Socket event handlers
initSockets(io);

// ─── Function to seed "ProChat AI" virtual system user ───────────────────────
async function seedAiAssistant() {
  try {
    const aiUser = await User.findOne({ isAi: true });
    if (!aiUser) {
      // NOTE: Do NOT pre-hash here. The User model's pre('save') hook
      // automatically hashes the password. Pre-hashing would double-hash it.
      await User.create({
        username: 'ProChat AI',
        email: 'ai@prochatai.com',
        password: 'ProChatAISystemBotPassword2026',
        avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=ProChatAI',
        isAi: true,
        isOnline: true,
      });
      console.log('🤖 Successfully seeded "ProChat AI" virtual assistant into the database.');
    } else {
      // Keep AI bot marked as online
      aiUser.isOnline = true;
      await aiUser.save();
      console.log('🤖 ProChat AI virtual assistant is online.');
    }
  } catch (error) {
    // Don't crash the server if seeding fails (e.g. duplicate key on restart)
    if (error.code === 11000) {
      console.log('🤖 ProChat AI virtual assistant already exists.');
    } else {
      console.error('❌ Error seeding AI Assistant user:', error.message);
    }
  }
}

// ─── CRITICAL: Connect to MongoDB FIRST, then start the server ───────────────
const startServer = async () => {
  try {
    console.log('🚀 Starting ProChat AI Backend Server...');
    console.log(`   → Environment: ${process.env.NODE_ENV || 'development'}`);

    // Step 1: Establish DB connection BEFORE listening for requests
    await connectDB();

    // Step 2: Seed the virtual AI assistant after DB is confirmed connected
    await seedAiAssistant();

    // Step 3: Start listening for requests ONLY after DB is ready
    const PORT = process.env.PORT || 4002;
    server.listen(PORT, () => {
      console.log('\n🎉 ProChat AI Server is READY:');
      console.log(`   → Mode:    ${process.env.NODE_ENV || 'development'}`);
      console.log(`   → Port:    ${PORT}`);
      console.log(`   → API:     http://localhost:${PORT}/api`);
      console.log(`   → Client:  ${process.env.CLIENT_URL || 'http://localhost:5173'}`);
      console.log('   → MongoDB: ✅ Connected\n');
    });
  } catch (error) {
    console.error('❌ Fatal startup error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
};

startServer();
