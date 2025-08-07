import express from 'express';
import asyncHandler from 'express-async-handler';
import { pool } from '../config/database.js';

const router = express.Router();

// GET /api/memories - Search across all character memories
router.get('/', asyncHandler(async (req, res) => {
  const { search, character_id, category, persistent, limit = 50, offset = 0 } = req.query;
  
  let query = `
    SELECT cm.*, c.name as character_name
    FROM character_memories cm
    JOIN characters c ON cm.character_id = c.id
    WHERE 1=1
  `;
  const values = [];
  
  if (search) {
    values.push(search);
    query += ` AND cm.tsv @@ plainto_tsquery('english', $${values.length})`;
  }
  
  if (character_id) {
    values.push(character_id);
    query += ` AND cm.character_id = $${values.length}`;
  }
  
  if (category) {
    values.push(category);
    query += ` AND cm.category = $${values.length}`;
  }
  
  if (persistent !== undefined) {
    values.push(persistent === 'true');
    query += ` AND cm.persistent = $${values.length}`;
  }
  
  query += ` ORDER BY cm.memory_weight DESC, cm.created_at DESC LIMIT ${limit} OFFSET ${offset}`;
  
  const result = await pool.query(query, values);
  res.json(result.rows);
}));

// POST /api/memories/bulk - Bulk create memories
router.post('/bulk', asyncHandler(async (req, res) => {
  const { character_id, memories } = req.body;
  
  if (!character_id || !Array.isArray(memories)) {
    return res.status(400).json({ error: 'character_id and memories array are required' });
  }
  
  const results = [];
  
  for (const memory of memories) {
    const result = await pool.query(
      `INSERT INTO character_memories (character_id, label, content, category, persistent, memory_weight)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        character_id,
        memory.label,
        memory.content,
        memory.category,
        memory.persistent !== false,
        memory.memory_weight || 1.0
      ]
    );
    results.push(result.rows[0]);
  }
  
  res.status(201).json({ created: results, count: results.length });
}));

// DELETE /api/memories/cleanup - Clean up low-weight memories
router.delete('/cleanup', asyncHandler(async (req, res) => {
  const { character_id, min_weight = 0.3, keep_persistent = true } = req.body;
  
  let query = 'DELETE FROM character_memories WHERE memory_weight < $1';
  const values = [min_weight];
  
  if (character_id) {
    values.push(character_id);
    query += ` AND character_id = $${values.length}`;
  }
  
  if (keep_persistent) {
    query += ' AND persistent = false';
  }
  
  query += ' RETURNING id, label, character_id';
  
  const result = await pool.query(query, values);
  
  res.json({
    message: `Cleaned up ${result.rows.length} memories`,
    deleted: result.rows
  });
}));

export default router;