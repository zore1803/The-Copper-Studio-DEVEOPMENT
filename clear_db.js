import 'dotenv/config';
import mongoose from 'mongoose';

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  const collections = await db.collections();
  
  for (let c of collections) {
    if (c.collectionName === 'users') {
      await c.deleteMany({ role: { $ne: 'admin' } });
      console.log('Deleted non-admin users');
    } else if (c.collectionName !== 'settings') {
      await c.deleteMany({});
      console.log('Cleared ' + c.collectionName);
    }
  }
  
  console.log('Done clearing database!');
  process.exit(0);
}

run().catch(console.error);
