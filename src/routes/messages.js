import express from 'express';
import asyncHandler from 'express-async-handler';
import { pool } from '../config/database.js';
import { validateMessage } from '../validators/message.js';

const router = express.Router();

// GET /api/messages - List messages with filtering
router.get('/', asyncHandler(async (req, res) => {
  const { 
    limit = 50, 
    offset = 0, 
    role,
    is_ghost,
    rating,
    tags,
    search
  } = req.query;
  
  let query = `
    SELECT m.*, 
           mo.name as model_name,
           ip.name as inference_preset_name
    FROM messages m
    LEFT JOIN models mo ON m.model_id = mo.id
    LEFT JOIN inference_presets ip ON m.inference_preset_id = ip.id
    WHERE 1=1
  `;
  const values = [];
  
  if (role) {
    values.push(role);
    query += ` AND m.role = $${values.length}`;
  }
  
  if (is_ghost !== undefined) {
    values.push(is_ghost === 'true');
    query += ` AND m.is_ghost = $${values.length}`;
  }
  
  if (rating) {
    values.push(parseInt(rating));
    query += ` AND m.rating = $${values.length}`;
  }
  
  if (tags) {
    const tagArray = Array.isArray(tags) ? tags : tags.split(',');
    values.push(tagArray);
    query += ` AND m.tags && $${values.length}::text[]`;
  }
  
  if (search) {
    values.push(search);
    query += ` AND m.tsv @@ plainto_tsquery('english', $${values.length})`;
  }
  
  query += ` ORDER BY m.created_at DESC LIMIT ${limit} OFFSET ${offset}`;
  
  const result = await pool.query(query, values);
  
  res.json({
    messages: result.rows,
    limit: parseInt(limit),
    offset: parseInt(offset)
  });
}));

// GET /api/messages/:id - Get single message
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const result = await pool.query(
    `SELECT m.*,
            mo.name as model_name,
            ip.name as inference_preset_name
     FROM messages m
     LEFT JOIN models mo ON m.model_id = mo.id
     LEFT JOIN inference_presets ip ON m.inference_preset_id = ip.id
     WHERE m.id = $1`,
    [id]
  );
  
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Message not found' });
  }
  
  res.json(result.rows[0]);
}));

// POST /api/messages - Create new message
router.post('/', asyncHandler(async (req, res) => {
  const validation = validateMessage(req.body);
  if (validation.error) {
    return res.status(400).json({ error: validation.error.details[0].message });
  }
  
  const {
    role,
    content,
    is_ghost = false,
    ghost_author,
    rating,
    tags,
    usage_stats,
    provenance,
    model_id,
    inference_preset_id,
    embedding
  } = req.body;
  
  const result = await pool.query(
    `INSERT INTO messages (
      role, content, is_ghost, ghost_author, rating, tags,
      usage_stats, provenance, model_id, inference_preset_id, embedding
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING *`,
    [
      role, content, is_ghost, ghost_author, rating, tags,
      usage_stats, provenance, model_id, inference_preset_id, embedding
    ]
  );
  
  res.status(201).json(result.rows[0]);
}));

// PUT /api/messages/:id - Update message
router.put('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const validation = validateMessage(req.body, true);
  if (validation.error) {
    return res.status(400).json({ error: validation.error.details[0].message });
  }
  
  const fields = [
    'content', 'rating', 'tags', 'usage_stats', 'provenance'
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
    `UPDATE messages 
     SET ${updates.join(', ')}
     WHERE id = $${paramCount}
     RETURNING *`,
    values
  );
  
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Message not found' });
  }
  
  res.json(result.rows[0]);
}));

// PUT /api/messages/:id/rating - Rate a message
router.put('/:id/rating', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { rating } = req.body;
  
  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'Rating must be between 1 and 5' });
  }
  
  const result = await pool.query(
    'UPDATE messages SET rating = $1 WHERE id = $2 RETURNING *',
    [rating, id]
  );
  
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Message not found' });
  }
  
  res.json(result.rows[0]);
}));

// PUT /api/messages/:id/tags - Update message tags
router.put('/:id/tags', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { tags, action = 'replace' } = req.body;
  
  if (!Array.isArray(tags)) {
    return res.status(400).json({ error: 'Tags must be an array' });
  }
  
  let query;
  let values;
  
  if (action === 'add') {
    // Add tags to existing ones
    query = `
      UPDATE messages 
      SET tags = array(SELECT DISTINCT unnest(COALESCE(tags, ARRAY[]::text[]) || $1::text[]))
      WHERE id = $2
      RETURNING *
    `;
    values = [tags, id];
  } else if (action === 'remove') {
    // Remove specific tags
    query = `
      UPDATE messages 
      SET tags = array(SELECT unnest(tags) EXCEPT SELECT unnest($1::text[]))
      WHERE id = $2
      RETURNING *
    `;
    values = [tags, id];
  } else {
    // Replace all tags
    query = 'UPDATE messages SET tags = $1 WHERE id = $2 RETURNING *';
    values = [tags, id];
  }
  
  const result = await pool.query(query, values);
  
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Message not found' });
  }
  
  res.json(result.rows[0]);
}));

// PUT /api/messages/:id/usage - Update usage statistics
router.put('/:id/usage', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { action, value = 1 } = req.body; // action: 'recalled' or 'ignored'
  
  if (!['recalled', 'ignored'].includes(action)) {
    return res.status(400).json({ error: 'Action must be "recalled" or "ignored"' });
  }
  
  const result = await pool.query(
    `UPDATE messages 
     SET usage_stats = jsonb_set(
       COALESCE(usage_stats, '{}'::jsonb),
       '{${action}}',
       (COALESCE(usage_stats->'${action}', '0')::int + $2)::text::jsonb
     )
     WHERE id = $1
     RETURNING *`,
    [id, value]
  );
  
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Message not found' });
  }
  
  res.json(result.rows[0]);
}));

// DELETE /api/messages/:id - Delete message
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const result = await pool.query(
    'DELETE FROM messages WHERE id = $1 RETURNING id, role, created_at',
    [id]
  );
  
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Message not found' });
  }
  
  res.json({ 
    message: 'Message deleted successfully',
    deleted: result.rows[0]
  });
}));

// POST /api/messages/:id/ghost - Convert message to ghost
router.post('/:id/ghost', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { ghost_author = 'developer' } = req.body;
  
  const result = await pool.query(
    `UPDATE messages 
     SET is_ghost = true, ghost_author = $2,
         provenance = jsonb_set(
           COALESCE(provenance, '{}'::jsonb),
           '{ghosted_at}',
           $3::jsonb
         )
     WHERE id = $1 AND role = 'assistant'
     RETURNING *`,
    [id, ghost_author, JSON.stringify(new Date().toISOString())]
  );
  
  if (result.rows.length === 0) {
    return res.status(404).json({ 
      error: 'Message not found or not an assistant message' 
    });
  }
  
  res.json(result.rows[0]);
}));

// GET /api/messages/search - Full-text search with advanced options
router.get('/search', asyncHandler(async (req, res) => {
  const { 
    query: searchQuery,
    limit = 50,
    offset = 0,
    role,
    min_rating,
    tags,
    similar_to
  } = req.query;
  
  if (!searchQuery && !similar_to) {
    return res.status(400).json({ error: 'Query or similar_to parameter required' });
  }
  
  let query = `
    SELECT m.*,
           ts_rank(m.tsv, search_query) as relevance_score
    FROM messages m,
         ${searchQuery ? `plainto_tsquery('english', $1) search_query` : ''}
    WHERE 1=1
  `;
  
  const values = [];
  
  if (searchQuery) {
    values.push(searchQuery);
    query += ` AND m.tsv @@ search_query`;
  }
  
  // Add similar_to logic here if embedding search is needed
  if (similar_to) {
    // This would require embedding similarity search
    // For now, just do text similarity
    values.push(similar_to);
    query += ` AND similarity(m.content, $${values.length}) > 0.3`;
  }
  
  if (role) {
    values.push(role);
    query += ` AND m.role = $${values.length}`;
  }
  
  if (min_rating) {
    values.push(parseInt(min_rating));
    query += ` AND m.rating >= $${values.length}`;
  }
  
  if (tags) {
    const tagArray = Array.isArray(tags) ? tags : tags.split(',');
    values.push(tagArray);
    query += ` AND m.tags && $${values.length}::text[]`;
  }
  
  query += searchQuery 
    ? ` ORDER BY relevance_score DESC` 
    : ` ORDER BY m.created_at DESC`;
  query += ` LIMIT ${limit} OFFSET ${offset}`;
  
  const result = await pool.query(query, values);
  
  res.json({
    messages: result.rows,
    query: searchQuery,
    limit: parseInt(limit),
    offset: parseInt(offset)
  });
}));

export default router;