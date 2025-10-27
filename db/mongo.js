import { MongoClient, ServerApiVersion } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();


const uri = process.env.MONGO_URI;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    // strict: true,
    deprecationErrors: true,
  }
});

let isConnected = false;

const getClient = async () => {
  if (!isConnected) {
    try {
      await client.connect();
      console.log('✅ Conectado a MongoDB');
      isConnected = true;
    } catch (error) {
      console.error('❌ Error conectando a MongoDB:', error);
    }
  }
  return client;
};

export default getClient;