import express from 'express';
import asyncHandler from 'express-async-handler';
import { pool } from '../config/database.js';

const router = express.Router();

// GET /api/providers - List all providers
router.get('/', asyncHandler(async (req, res) => {
  const result = await pool.query(
    'SELECT id, name, slug, type, base_url, created_at FROM providers ORDER BY created_at DESC'
  );
  res.json(result.rows);
}));

// POST /api/providers - Create provider
router.post('/', asyncHandler(async (req, res) => {
  const { name, type, base_url, api_key_ref, slug } = req.body;
  
  if (!name || !type) {
    return res.status(400).json({ error: 'name and type are required' });
  }
  
  // Auto-generate slug from name if not provided
  const finalSlug = slug || name.toLowerCase().replace(/[^a-z0-9]/g, '');
  
  const result = await pool.query(
    'INSERT INTO providers (name, slug, type, base_url, api_key_ref) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [name, finalSlug, type, base_url, api_key_ref]
  );
  
  res.status(201).json(result.rows[0]);
}));

// GET /api/providers/:identifier - Get provider by ID or slug
router.get('/:identifier', asyncHandler(async (req, res) => {
  const { identifier } = req.params;
  
  // Try to find by slug first, then by UUID
  const result = await pool.query(
    'SELECT * FROM providers WHERE slug = $1 OR id = $1',
    [identifier]
  );
  
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Provider not found' });
  }
  
  res.json(result.rows[0]);
}));

// PUT /api/providers/:identifier - Update provider by ID or slug
router.put('/:identifier', asyncHandler(async (req, res) => {
  const { identifier } = req.params;
  const { name, type, base_url, api_key_ref, slug } = req.body;
  
  const result = await pool.query(
    'UPDATE providers SET name = $1, slug = $2, type = $3, base_url = $4, api_key_ref = $5 WHERE slug = $6 OR id = $6 RETURNING *',
    [name, slug, type, base_url, api_key_ref, identifier]
  );
  
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Provider not found' });
  }
  
  res.json(result.rows[0]);
}));

// DELETE /api/providers/:identifier - Delete provider by ID or slug
router.delete('/:identifier', asyncHandler(async (req, res) => {
  const result = await pool.query(
    'DELETE FROM providers WHERE slug = $1 OR id = $1 RETURNING id, name, slug',
    [req.params.identifier]
  );
  
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Provider not found' });
  }
  
  res.json({ message: 'Provider deleted successfully', deleted: result.rows[0] });
}));

export default router;