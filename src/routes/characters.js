import express from 'express';
import asyncHandler from 'express-async-handler';
import { pool, withTransaction } from '../config/database.js';
import { validateCharacter } from '../validators/character.js';

const router = express.Router();

// GET /api/characters - List all characters
router.get('/', asyncHandler(async (req, res) => {
  const { limit = 50, offset = 0, search } = req.query;
  
  let query = `
    SELECT id, name, description, format_type, mood_variants, internal_state, 
           created_at, updated_at
    FROM characters
  `;
  const values = [];
  
  if (search) {
    query += ` WHERE name ILIKE $1 OR description ILIKE $1`;
    values.push(`%${search}%`);
  }
  
  query += ` ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;
  
  const result = await pool.query(query, values);
  const countResult = await pool.query(
    `SELECT COUNT(*) FROM characters ${search ? 'WHERE name ILIKE $1 OR description ILIKE $1' : ''}`,
    search ? [`%${search}%`] : []
  );
  
  res.json({
    characters: result.rows,
    total: parseInt(countResult.rows[0].count),
    limit: parseInt(limit),
    offset: parseInt(offset)
  });
}));

// GET /api/characters/:id - Get single character with memories
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { include_memories = false } = req.query;
  
  const characterResult = await pool.query(
    'SELECT * FROM characters WHERE id = $1',
    [id]
  );
  
  if (characterResult.rows.length === 0) {
    return res.status(404).json({ error: 'Character not found' });
  }
  
  const character = characterResult.rows[0];
  
  if (include_memories === 'true') {
    const memoriesResult = await pool.query(
      `SELECT * FROM character_memories 
       WHERE character_id = $1 
       ORDER BY created_at DESC`,
      [id]
    );
    character.memories = memoriesResult.rows;
  }
  
  res.json(character);
}));

// POST /api/characters - Create new character
router.post('/', asyncHandler(async (req, res) => {
  const validation = validateCharacter(req.body);
  if (validation.error) {
    return res.status(400).json({ error: validation.error.details[0].message });
  }
  
  const { 
    name, 
    description, 
    format_type = 'plain',
    mood_variants,
    internal_state 
  } = req.body;
  
  const result = await pool.query(
    `INSERT INTO characters (name, description, format_type, mood_variants, internal_state)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [name, description, format_type, mood_variants, internal_state]
  );
  
  res.status(201).json(result.rows[0]);
}));

// PUT /api/characters/:id - Update character
router.put('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const validation = validateCharacter(req.body, true);
  if (validation.error) {
    return res.status(400).json({ error: validation.error.details[0].message });
  }
  
  const fields = ['name', 'description', 'format_type', 'mood_variants', 'internal_state'];
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
    `UPDATE characters 
     SET ${updates.join(', ')}
     WHERE id = $${paramCount}
     RETURNING *`,
    values
  );
  
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Character not found' });
  }
  
  res.json(result.rows[0]);
}));

// DELETE /api/characters/:id - Delete character
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const result = await pool.query(
    'DELETE FROM characters WHERE id = $1 RETURNING id, name',
    [id]
  );
  
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Character not found' });
  }
  
  res.json({ 
    message: 'Character deleted successfully',
    deleted: result.rows[0]
  });
}));

// POST /api/characters/:id/memories - Add memory to character
router.post('/:id/memories', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { label, content, category, persistent = false, memory_weight = 1.0 } = req.body;
  
  if (!label || !content) {
    return res.status(400).json({ error: 'Label and content are required' });
  }
  
  // Verify character exists
  const charCheck = await pool.query('SELECT id FROM characters WHERE id = $1', [id]);
  if (charCheck.rows.length === 0) {
    return res.status(404).json({ error: 'Character not found' });
  }
  
  const result = await pool.query(
    `INSERT INTO character_memories (character_id, label, content, category, persistent, memory_weight)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [id, label, content, category, persistent, memory_weight]
  );
  
  res.status(201).json(result.rows[0]);
}));

// GET /api/characters/:id/memories - Get character memories
router.get('/:id/memories', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { category, persistent } = req.query;
  
  let query = `
    SELECT * FROM character_memories 
    WHERE character_id = $1
  `;
  const values = [id];
  
  if (category) {
    query += ` AND category = $${values.length + 1}`;
    values.push(category);
  }
  
  if (persistent !== undefined) {
    query += ` AND persistent = $${values.length + 1}`;
    values.push(persistent === 'true');
  }
  
  query += ` ORDER BY created_at DESC`;
  
  const result = await pool.query(query, values);
  res.json(result.rows);
}));

// DELETE /api/characters/:id/memories/:memoryId - Delete character memory
router.delete('/:id/memories/:memoryId', asyncHandler(async (req, res) => {
  const { id, memoryId } = req.params;
  
  const result = await pool.query(
    'DELETE FROM character_memories WHERE id = $1 AND character_id = $2 RETURNING id',
    [memoryId, id]
  );
  
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Memory not found' });
  }
  
  res.json({ message: 'Memory deleted successfully' });
}));

// PUT /api/characters/:id/mood - Update character mood
router.put('/:id/mood', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { mood } = req.body;
  
  if (!mood) {
    return res.status(400).json({ error: 'Mood is required' });
  }
  
  // Update internal_state JSONB with new mood
  const result = await pool.query(
    `UPDATE characters 
     SET internal_state = jsonb_set(
       COALESCE(internal_state, '{}'::jsonb),
       '{mood}',
       $2::jsonb
     )
     WHERE id = $1
     RETURNING *`,
    [id, JSON.stringify(mood)]
  );
  
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Character not found' });
  }
  
  res.json(result.rows[0]);
}));

// POST /api/characters/:id/clone - Clone a character
router.post('/:id/clone', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'New character name is required' });
  }
  
  const result = await withTransaction(async (client) => {
    // Get original character
    const original = await client.query(
      'SELECT * FROM characters WHERE id = $1',
      [id]
    );
    
    if (original.rows.length === 0) {
      throw new Error('Character not found');
    }
    
    const char = original.rows[0];
    
    // Create new character
    const newChar = await client.query(
      `INSERT INTO characters (name, description, format_type, mood_variants, internal_state)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [name, char.description, char.format_type, char.mood_variants, char.internal_state]
    );
    
    // Clone memories if requested
    if (req.body.include_memories) {
      await client.query(
        `INSERT INTO character_memories (character_id, label, content, category, persistent, memory_weight)
         SELECT $1, label, content, category, persistent, memory_weight
         FROM character_memories
         WHERE character_id = $2`,
        [newChar.rows[0].id, id]
      );
    }
    
    return newChar.rows[0];
  });
  
  res.status(201).json(result);
}));

export default router;