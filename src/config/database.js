import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

export const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'character_db',
  password: process.env.DB_PASSWORD || 'postgres',
  port: process.env.DB_PORT || 5432,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test connection
pool.on('connect', () => {
  console.log('✅ Database connected');
});

pool.on('error', (err) => {
  console.error('❌ Unexpected database error:', err);
  process.exit(-1);
});

// Helper for transactions
export const withTransaction = async (callback) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// Query builder helpers
export const queryBuilder = {
  insert: (table, data) => {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map((_, i) => `$${i + 1}`);
    
    return {
      text: `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
      values
    };
  },
  
  update: (table, id, data) => {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const setClause = keys.map((key, i) => `${key} = $${i + 2}`).join(', ');
    
    return {
      text: `UPDATE ${table} SET ${setClause} WHERE id = $1 RETURNING *`,
      values: [id, ...values]
    };
  },
  
  select: (table, conditions = {}, options = {}) => {
    const keys = Object.keys(conditions);
    const values = Object.values(conditions);
    const whereClause = keys.length 
      ? `WHERE ${keys.map((key, i) => `${key} = $${i + 1}`).join(' AND ')}`
      : '';
    
    let query = `SELECT * FROM ${table} ${whereClause}`;
    
    if (options.orderBy) {
      query += ` ORDER BY ${options.orderBy}`;
    }
    if (options.limit) {
      query += ` LIMIT ${options.limit}`;
    }
    if (options.offset) {
      query += ` OFFSET ${options.offset}`;
    }
    
    return {
      text: query,
      values
    };
  }
};