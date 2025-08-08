import express from 'express';
import asyncHandler from 'express-async-handler';
import { pool } from '../config/database.js';

const router = express.Router();

// GET /api/models - List all models
router.get('/', asyncHandler(async (req, res) => {
  const { provider_id, provider_slug, is_favorite } = req.query;
  
  let query = `
    SELECT m.*, p.name as provider_name, p.slug as provider_slug, p.type as provider_type
    FROM models m
    JOIN providers p ON m.provider_id = p.id
    WHERE 1=1
  `;
  const values = [];
  
  if (provider_id) {
    values.push(provider_id);
    query += ` AND m.provider_id = $${values.length}`;
  }
  
  if (provider_slug) {
    values.push(provider_slug);
    query += ` AND p.slug = $${values.length}`;
  }
  
  if (is_favorite !== undefined) {
    values.push(is_favorite === 'true');
    query += ` AND m.is_favorite = $${values.length}`;
  }
  
  query += ' ORDER BY m.is_favorite DESC, m.created_at DESC';
  
  const result = await pool.query(query, values);
  res.json(result.rows);
}));

// GET /api/models/options - Get models as options for dropdowns
router.get('/options', asyncHandler(async (req, res) => {
  const { provider_id } = req.query;
  
  let query = `
    SELECT m.id as value, 
           CONCAT(p.name, ' / ', m.name) as label
    FROM models m
    JOIN providers p ON m.provider_id = p.id
  `;
  const values = [];
  
  if (provider_id) {
    values.push(provider_id);
    query += ` WHERE m.provider_id = $${values.length}`;
  }
  
  query += ' ORDER BY p.name ASC, m.name ASC';
  
  const result = await pool.query(query, values);
  res.json(result.rows);
}));

// GET /api/models/:id - Get single model
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const result = await pool.query(`
    SELECT m.*, p.name as provider_name, p.slug as provider_slug, p.type as provider_type
    FROM models m
    JOIN providers p ON m.provider_id = p.id
    WHERE m.id = $1
  `, [id]);
  
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Model not found' });
  }
  
  res.json(result.rows[0]);
}));

// POST /api/models - Create model
router.post('/', asyncHandler(async (req, res) => {
  const { provider_id, name, nickname, context_window, is_favorite = false } = req.body;
  
  if (!provider_id || !name || !context_window) {
    return res.status(400).json({ error: 'provider_id, name, and context_window are required' });
  }
  
  const result = await pool.query(
    `INSERT INTO models (provider_id, name, nickname, context_window, is_favorite)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [provider_id, name, nickname, context_window, is_favorite]
  );
  
  res.status(201).json(result.rows[0]);
}));

// PUT /api/models/:id - Update model
router.put('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { nickname, context_window_override, is_favorite } = req.body;
  
  // Build dynamic update query
  const updates = [];
  const values = [];
  
  if (nickname !== undefined) {
    values.push(nickname);
    updates.push(`nickname = $${values.length}`);
  }
  
  if (context_window_override !== undefined) {
    values.push(context_window_override);
    updates.push(`context_window_override = $${values.length}`);
  }
  
  if (is_favorite !== undefined) {
    values.push(is_favorite);
    updates.push(`is_favorite = $${values.length}`);
  }
  
  if (updates.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }
  
  values.push(id);
  const query = `UPDATE models SET ${updates.join(', ')} WHERE id = $${values.length} RETURNING *`;
  
  const result = await pool.query(query, values);
  
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Model not found' });
  }
  
  res.json(result.rows[0]);
}));

// PUT /api/models/:id/favorite - Toggle favorite
router.put('/:id/favorite', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { is_favorite } = req.body;
  
  const result = await pool.query(
    'UPDATE models SET is_favorite = $1 WHERE id = $2 RETURNING *',
    [is_favorite, id]
  );
  
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Model not found' });
  }
  
  res.json(result.rows[0]);
}));

// DELETE /api/models/:id - Delete model
router.delete('/:id', asyncHandler(async (req, res) => {
  const result = await pool.query(
    'DELETE FROM models WHERE id = $1 RETURNING id, name',
    [req.params.id]
  );
  
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Model not found' });
  }
  
  res.json({ message: 'Model deleted successfully', deleted: result.rows[0] });
}));

export default router;