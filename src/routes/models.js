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