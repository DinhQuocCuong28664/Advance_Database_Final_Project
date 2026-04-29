/**
 * LuxeReserve  Database Configuration
 * Polyglot Persistence: SQL Server + MongoDB Atlas
 */

require('dotenv').config();
const sql = process.env.SQL_TRUSTED_CONNECTION === 'true' ? require('mssql/msnodesqlv8') : require('mssql');
const { MongoClient } = require('mongodb');

// 
// SQL Server Configuration
// ============================================================
const sqlServer = process.env.SQL_SERVER || 'localhost';
const sqlInstance = process.env.SQL_INSTANCE || '';
const isDefaultInstance = !sqlInstance || sqlInstance.toUpperCase() === 'MSSQLSERVER';
const serverStr = isDefaultInstance ? sqlServer : `${sqlServer}\\${sqlInstance}`;

const sqlConfig = {
  server: sqlServer,
  database: process.env.SQL_DATABASE || 'LuxeReserve',
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true,
    instanceName: isDefaultInstance ? undefined : sqlInstance,
  },
  ...(process.env.SQL_TRUSTED_CONNECTION === 'true'
    ? { connectionString: `Driver={ODBC Driver 17 for SQL Server};Server=${serverStr};Database=${process.env.SQL_DATABASE || 'LuxeReserve'};Trusted_Connection=yes;`, driver: 'msnodesqlv8' }
    : { user: process.env.SQL_USER, password: process.env.SQL_PASSWORD }
  ),
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
  connectionTimeout: 15000,
  requestTimeout: 15000,
};

// If using SQL auth and an instance is provided, set instanceName
if (process.env.SQL_TRUSTED_CONNECTION !== 'true' && sqlInstance) {
  sqlConfig.options.instanceName = sqlInstance;
}

let sqlPool = null;

async function connectSQL() {
  try {
    if (!sqlPool) {
      sqlPool = await sql.connect(sqlConfig);
      console.log(' SQL Server connected:', sqlConfig.database);
    }
    return sqlPool;
  } catch (err) {
    console.error(' SQL Server connection failed:', err.message);
    throw err;
  }
}

function getSqlPool() {
  if (!sqlPool) throw new Error('SQL Server not connected. Call connectSQL() first.');
  return sqlPool;
}

// 
// MongoDB Configuration
// 
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/luxereserve';
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'luxereserve';

let mongoClient = null;
let mongoDb = null;

async function connectMongo() {
  try {
    if (!mongoClient) {
      mongoClient = new MongoClient(MONGODB_URI);
      await mongoClient.connect();
      mongoDb = mongoClient.db(MONGODB_DB_NAME);
      console.log(' MongoDB connected:', MONGODB_DB_NAME);
    }
    return mongoDb;
  } catch (err) {
    console.error(' MongoDB connection failed:', err.message);
    throw err;
  }
}

function getMongoDb() {
  if (!mongoDb) throw new Error('MongoDB not connected. Call connectMongo() first.');
  return mongoDb;
}

// 
// Graceful Shutdown
// 
async function closeAll() {
  if (sqlPool) { await sqlPool.close(); console.log('  SQL Server closed'); }
  if (mongoClient) { await mongoClient.close(); console.log('  MongoDB closed'); }
}

module.exports = {
  sql,
  connectSQL,
  getSqlPool,
  connectMongo,
  getMongoDb,
  closeAll,
};
