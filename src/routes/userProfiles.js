import express from 'express';
import asyncHandler from 'express-async-handler';
import { pool, queryBuilder } from '../config/database.js';
import { validateUserProfile } from '../validators/userProfile.js';

const router = express.Router();

// GET /api/user-profiles - List all user profiles
router.get('/', asyncHandler(async (req, res) => {
  const { limit = 50, offset = 0, search } = req.query;
  
  let query = `
    SELECT id, name, description, format_type, created_at, updated_at
    FROM user_profiles
  `;
  const values = [];
  
  if (search) {
    query += ` WHERE name ILIKE $1 OR description ILIKE $1`;
    values.push(`%${search}%`);
  }
  
  query += ` ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;
  
  const result = await pool.query(query, values);
  const countResult = await pool.query(
    `SELECT COUNT(*) FROM user_profiles ${search ? 'WHERE name ILIKE $1 OR description ILIKE $1' : ''}`,
    search ? [`%${search}%`] : []
  );
  
  res.json({
    profiles: result.rows,
    total: parseInt(countResult.rows[0].count),
    limit: parseInt(limit),
    offset: parseInt(offset)
  });
}));

// GET /api/user-profiles/:id - Get single user profile
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const result = await pool.query(
    'SELECT * FROM user_profiles WHERE id = $1',
    [id]
  );
  
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'User profile not found' });
  }
  
  res.json(result.rows[0]);
}));

// POST /api/user-profiles - Create new user profile
router.post('/', asyncHandler(async (req, res) => {
  const validation = validateUserProfile(req.body);
  if (validation.error) {
    return res.status(400).json({ error: validation.error.details[0].message });
  }
  
  const { name, description, format_type = 'plain' } = req.body;
  
  const result = await pool.query(
    `INSERT INTO user_profiles (name, description, format_type)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [name, description, format_type]
  );
  
  res.status(201).json(result.rows[0]);
}));

// PUT /api/user-profiles/:id - Update user profile
router.put('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const validation = validateUserProfile(req.body, true);
  if (validation.error) {
    return res.status(400).json({ error: validation.error.details[0].message });
  }
  
  const { name, description, format_type } = req.body;
  
  // Build dynamic update query
  const updates = [];
  const values = [];
  let paramCount = 1;
  
  if (name !== undefined) {
    updates.push(`name = $${paramCount++}`);
    values.push(name);
  }
  if (description !== undefined) {
    updates.push(`description = $${paramCount++}`);
    values.push(description);
  }
  if (format_type !== undefined) {
    updates.push(`format_type = $${paramCount++}`);
    values.push(format_type);
  }
  
  if (updates.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }
  
  values.push(id);
  const result = await pool.query(
    `UPDATE user_profiles 
     SET ${updates.join(', ')}
     WHERE id = $${paramCount}
     RETURNING *`,
    values
  );
  
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'User profile not found' });
  }
  
  res.json(result.rows[0]);
}));

// DELETE /api/user-profiles/:id - Delete user profile
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const result = await pool.query(
    'DELETE FROM user_profiles WHERE id = $1 RETURNING id, name',
    [id]
  );
  
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'User profile not found' });
  }
  
  res.json({ 
    message: 'User profile deleted successfully',
    deleted: result.rows[0]
  });
}));

// POST /api/user-profiles/:id/clone - Clone a user profile
router.post('/:id/clone', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'New profile name is required' });
  }
  
  const original = await pool.query(
    'SELECT * FROM user_profiles WHERE id = $1',
    [id]
  );
  
  if (original.rows.length === 0) {
    return res.status(404).json({ error: 'User profile not found' });
  }
  
  const profile = original.rows[0];
  const result = await pool.query(
    `INSERT INTO user_profiles (name, description, format_type)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [name, profile.description, profile.format_type]
  );
  
  res.status(201).json(result.rows[0]);
}));

// GET /api/user-profiles/:id/conversations - Get all conversations for a user profile
router.get('/:id/conversations', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { limit = 50, offset = 0 } = req.query;
  
  const result = await pool.query(
    `SELECT c.*, 
            ch.name as character_name,
            m.name as model_name,
            COUNT(cm.message_id) as message_count
     FROM conversations c
     LEFT JOIN characters ch ON c.character_id = ch.id
     LEFT JOIN models m ON c.model_id = m.id
     LEFT JOIN conversation_messages cm ON c.id = cm.conversation_id
     WHERE c.user_profile_id = $1
     GROUP BY c.id, ch.name, m.name
     ORDER BY c.updated_at DESC
     LIMIT $2 OFFSET $3`,
    [id, limit, offset]
  );
  
  res.json({
    conversations: result.rows,
    limit: parseInt(limit),
    offset: parseInt(offset)
  });
}));

export default router;