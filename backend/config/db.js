const mongoose = require('mongoose');

const connectDB = async () => {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.error('❌ FATAL: MONGODB_URI is not defined in environment variables.');
    process.exit(1);
  }

  console.log('⏳ Attempting MongoDB connection...');
  console.log(`   → Host: ${uri.split('@')[1]?.split('/')[0] || 'unknown'}`);

  // ─── Retry loop: try up to 5 times with 5-second delay between attempts ───
  const MAX_RETRIES = 5;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const conn = await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 15000,
        connectTimeoutMS: 15000,
        socketTimeoutMS: 45000,
      });

      console.log('✅ MongoDB Connected Successfully!');
      console.log(`   → Host: ${conn.connection.host}`);
      console.log(`   → Database: ${conn.connection.name}`);

      mongoose.connection.on('disconnected', () => {
        console.warn('⚠️  MongoDB disconnected. Mongoose will auto-reconnect...');
      });
      mongoose.connection.on('reconnected', () => {
        console.log('✅ MongoDB reconnected successfully.');
      });
      mongoose.connection.on('error', (err) => {
        console.error('❌ MongoDB runtime error:', err.message);
      });

      return conn;
    } catch (error) {
      console.error(`\n❌ MongoDB connection attempt ${attempt}/${MAX_RETRIES} failed:`);
      console.error(`   → ${error.message}`);

      if (attempt < MAX_RETRIES) {
        console.log(`   ⏳ Retrying in 5 seconds...\n`);
        await new Promise((resolve) => setTimeout(resolve, 5000));
      } else {
        console.error('\n🛠️  All connection attempts failed. Troubleshooting:');
        console.error('   1. Go to https://cloud.mongodb.com');
        console.error('   2. Click: Security → Network Access → + Add IP Address');
        console.error('   3. Click "Allow Access from Anywhere" (adds 0.0.0.0/0)');
        console.error('   4. Click Confirm, wait 30 seconds, then restart the server');
        console.error(`\n   Connection string (masked): ${uri.replace(/:([^:@]+)@/, ':****@')}`);
        process.exit(1);
      }
    }
  }
};

module.exports = connectDB;
