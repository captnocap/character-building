import express from 'express';
import asyncHandler from 'express-async-handler';
import { pool } from '../config/database.js';

const router = express.Router();

// GET /api/inference-presets - List all presets
router.get('/', asyncHandler(async (req, res) => {
  const result = await pool.query(
    'SELECT * FROM inference_presets ORDER BY created_at DESC'
  );
  res.json(result.rows);
}));

// GET /api/inference-presets/:id - Get single preset
router.get('/:id', asyncHandler(async (req, res) => {
  const result = await pool.query(
    'SELECT * FROM inference_presets WHERE id = $1',
    [req.params.id]
  );
  
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Inference preset not found' });
  }
  
  res.json(result.rows[0]);
}));

// POST /api/inference-presets - Create preset
router.post('/', asyncHandler(async (req, res) => {
  const {
    name,
    temperature,
    top_p,
    top_k,
    min_p,
    max_tokens,
    frequency_penalty,
    presence_penalty,
    repetition_penalty,
    seed
  } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'name is required' });
  }
  
  const result = await pool.query(
    `INSERT INTO inference_presets (
      name, temperature, top_p, top_k, min_p, max_tokens,
      frequency_penalty, presence_penalty, repetition_penalty, seed
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING *`,
    [
      name, temperature, top_p, top_k, min_p, max_tokens,
      frequency_penalty, presence_penalty, repetition_penalty, seed
    ]
  );
  
  res.status(201).json(result.rows[0]);
}));

// PUT /api/inference-presets/:id - Update preset
router.put('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const fields = [
    'name', 'temperature', 'top_p', 'top_k', 'min_p', 'max_tokens',
    'frequency_penalty', 'presence_penalty', 'repetition_penalty', 'seed'
  ];
  
  const updates = [];
  const values = [];
  let paramCount = 1;
  
  for (const field of fields) {
    if (req.body[field] !== undefined) {
      updates.push(`${field} = $${paramCount++}`);
      values.push(req.body[field]);
    }
  }
  
  if (updates.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }
  
  values.push(id);
  const result = await pool.query(
    `UPDATE inference_presets SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
    values
  );
  
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Inference preset not found' });
  }
  
  res.json(result.rows[0]);
}));

// DELETE /api/inference-presets/:id - Delete preset
router.delete('/:id', asyncHandler(async (req, res) => {
  const result = await pool.query(
    'DELETE FROM inference_presets WHERE id = $1 RETURNING id, name',
    [req.params.id]
  );
  
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Inference preset not found' });
  }
  
  res.json({ message: 'Inference preset deleted successfully', deleted: result.rows[0] });
}));

export default router;