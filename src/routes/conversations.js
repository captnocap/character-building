import express from 'express';
import asyncHandler from 'express-async-handler';
import { pool, withTransaction } from '../config/database.js';
import { validateConversation } from '../validators/conversation.js';

const router = express.Router();

// GET /api/conversations - List all conversations
router.get('/', asyncHandler(async (req, res) => {
  const { 
    limit = 50, 
    offset = 0, 
    user_profile_id,
    character_id,
    is_synthetic
  } = req.query;
  
  let query = `
    SELECT c.*,
           up.name as user_profile_name,
           ch.name as character_name,
           m.name as model_name,
           COUNT(cm.message_id) as message_count
    FROM conversations c
    LEFT JOIN user_profiles up ON c.user_profile_id = up.id
    LEFT JOIN characters ch ON c.character_id = ch.id
    LEFT JOIN models m ON c.model_id = m.id
    LEFT JOIN conversation_messages cm ON c.id = cm.conversation_id
    WHERE 1=1
  `;
  const values = [];
  
  if (user_profile_id) {
    values.push(user_profile_id);
    query += ` AND c.user_profile_id = $${values.length}`;
  }
  
  if (character_id) {
    values.push(character_id);
    query += ` AND c.character_id = $${values.length}`;
  }
  
  if (is_synthetic !== undefined) {
    values.push(is_synthetic === 'true');
    query += ` AND c.is_synthetic = $${values.length}`;
  }
  
  query += `
    GROUP BY c.id, up.name, ch.name, m.name
    ORDER BY c.updated_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
  
  const result = await pool.query(query, values);
  
  res.json({
    conversations: result.rows,
    limit: parseInt(limit),
    offset: parseInt(offset)
  });
}));

// GET /api/conversations/:id - Get single conversation with messages
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { include_messages = false, message_limit = 100 } = req.query;
  
  const conversationResult = await pool.query(
    `SELECT c.*,
            up.name as user_profile_name,
            ch.name as character_name,
            m.name as model_name,
            pw.name as prompt_wrapper_name,
            rt.name as response_tone_name,
            rs.name as response_setting_name,
            ip.name as inference_preset_name
     FROM conversations c
     LEFT JOIN user_profiles up ON c.user_profile_id = up.id
     LEFT JOIN characters ch ON c.character_id = ch.id
     LEFT JOIN models m ON c.model_id = m.id
     LEFT JOIN prompt_wrappers pw ON c.prompt_wrapper_id = pw.id
     LEFT JOIN response_tones rt ON c.response_tone_id = rt.id
     LEFT JOIN response_settings rs ON c.response_setting_id = rs.id
     LEFT JOIN inference_presets ip ON c.inference_preset_id = ip.id
     WHERE c.id = $1`,
    [id]
  );
  
  if (conversationResult.rows.length === 0) {
    return res.status(404).json({ error: 'Conversation not found' });
  }
  
  const conversation = conversationResult.rows[0];
  
  if (include_messages === 'true') {
    const messagesResult = await pool.query(
      `SELECT m.*, cm.position, cm.included_in_context, cm.context_weight, cm.semantic_relevance
       FROM conversation_messages cm
       JOIN messages m ON cm.message_id = m.id
       WHERE cm.conversation_id = $1
       ORDER BY cm.position
       LIMIT $2`,
      [id, message_limit]
    );
    conversation.messages = messagesResult.rows;
  }
  
  res.json(conversation);
}));

// POST /api/conversations - Create new conversation
router.post('/', asyncHandler(async (req, res) => {
  const validation = validateConversation(req.body);
  if (validation.error) {
    return res.status(400).json({ error: validation.error.details[0].message });
  }
  
  const {
    name,
    model_id,
    user_profile_id,
    character_id,
    character_mood,
    prompt_wrapper_id,
    response_tone_id,
    response_setting_id,
    inference_preset_id,
    fork_from_conversation_id,
    fork_from_message_id,
    is_synthetic = false
  } = req.body;
  
  const result = await withTransaction(async (client) => {
    // Create conversation
    const convResult = await client.query(
      `INSERT INTO conversations (
        name, model_id, user_profile_id, character_id, character_mood,
        prompt_wrapper_id, response_tone_id, response_setting_id,
        inference_preset_id, fork_from_conversation_id, fork_from_message_id,
        is_synthetic
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        name, model_id, user_profile_id, character_id, character_mood,
        prompt_wrapper_id, response_tone_id, response_setting_id,
        inference_preset_id, fork_from_conversation_id, fork_from_message_id,
        is_synthetic
      ]
    );
    
    const conversation = convResult.rows[0];
    
    // If forking, copy messages up to fork point
    if (fork_from_conversation_id && fork_from_message_id) {
      await client.query(
        `INSERT INTO conversation_messages (conversation_id, message_id, position, included_in_context, context_weight, semantic_relevance)
         SELECT $1, cm.message_id, cm.position, cm.included_in_context, cm.context_weight, cm.semantic_relevance
         FROM conversation_messages cm
         WHERE cm.conversation_id = $2
           AND cm.position <= (
             SELECT position FROM conversation_messages 
             WHERE conversation_id = $2 AND message_id = $3
           )`,
        [conversation.id, fork_from_conversation_id, fork_from_message_id]
      );
    }
    
    return conversation;
  });
  
  res.status(201).json(result);
}));

// PUT /api/conversations/:id - Update conversation
router.put('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const validation = validateConversation(req.body, true);
  if (validation.error) {
    return res.status(400).json({ error: validation.error.details[0].message });
  }
  
  const fields = [
    'name', 'model_id', 'user_profile_id', 'character_id', 'character_mood',
    'prompt_wrapper_id', 'response_tone_id', 'response_setting_id',
    'inference_preset_id'
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
    `UPDATE conversations 
     SET ${updates.join(', ')}
     WHERE id = $${paramCount}
     RETURNING *`,
    values
  );
  
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Conversation not found' });
  }
  
  res.json(result.rows[0]);
}));

// DELETE /api/conversations/:id - Delete conversation
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const result = await pool.query(
    'DELETE FROM conversations WHERE id = $1 RETURNING id, name',
    [id]
  );
  
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Conversation not found' });
  }
  
  res.json({ 
    message: 'Conversation deleted successfully',
    deleted: result.rows[0]
  });
}));

// POST /api/conversations/:id/messages - Add message to conversation
router.post('/:id/messages', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { 
    role,
    content,
    is_ghost = false,
    ghost_author,
    rating,
    tags,
    model_id,
    inference_preset_id,
    included_in_context = true,
    context_weight = 1.0
  } = req.body;
  
  if (!role || !content) {
    return res.status(400).json({ error: 'Role and content are required' });
  }
  
  const result = await withTransaction(async (client) => {
    // Create message
    const messageResult = await client.query(
      `INSERT INTO messages (
        role, content, is_ghost, ghost_author, rating, tags,
        model_id, inference_preset_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [role, content, is_ghost, ghost_author, rating, tags, model_id, inference_preset_id]
    );
    
    const message = messageResult.rows[0];
    
    // Get next position
    const positionResult = await client.query(
      'SELECT COALESCE(MAX(position), 0) + 1 as next_position FROM conversation_messages WHERE conversation_id = $1',
      [id]
    );
    
    // Link to conversation
    await client.query(
      `INSERT INTO conversation_messages (
        conversation_id, message_id, position, included_in_context, context_weight
      ) VALUES ($1, $2, $3, $4, $5)`,
      [id, message.id, positionResult.rows[0].next_position, included_in_context, context_weight]
    );
    
    // Update conversation updated_at
    await client.query(
      'UPDATE conversations SET updated_at = NOW() WHERE id = $1',
      [id]
    );
    
    return message;
  });
  
  res.status(201).json(result);
}));

// PUT /api/conversations/:id/messages/:messageId/context - Update message context inclusion
router.put('/:id/messages/:messageId/context', asyncHandler(async (req, res) => {
  const { id, messageId } = req.params;
  const { included_in_context, context_weight, semantic_relevance } = req.body;
  
  const updates = [];
  const values = [];
  let paramCount = 1;
  
  if (included_in_context !== undefined) {
    updates.push(`included_in_context = $${paramCount++}`);
    values.push(included_in_context);
  }
  
  if (context_weight !== undefined) {
    updates.push(`context_weight = $${paramCount++}`);
    values.push(context_weight);
  }
  
  if (semantic_relevance !== undefined) {
    updates.push(`semantic_relevance = $${paramCount++}`);
    values.push(semantic_relevance);
  }
  
  if (updates.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }
  
  values.push(id, messageId);
  const result = await pool.query(
    `UPDATE conversation_messages 
     SET ${updates.join(', ')}
     WHERE conversation_id = $${paramCount} AND message_id = $${paramCount + 1}
     RETURNING *`,
    values
  );
  
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Message not found in conversation' });
  }
  
  res.json(result.rows[0]);
}));

// POST /api/conversations/:id/fork - Fork conversation from current point
router.post('/:id/fork', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, at_message_id } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Fork name is required' });
  }
  
  const result = await withTransaction(async (client) => {
    // Get original conversation
    const origResult = await client.query(
      'SELECT * FROM conversations WHERE id = $1',
      [id]
    );
    
    if (origResult.rows.length === 0) {
      throw new Error('Conversation not found');
    }
    
    const original = origResult.rows[0];
    
    // Create forked conversation
    const forkResult = await client.query(
      `INSERT INTO conversations (
        name, model_id, user_profile_id, character_id, character_mood,
        prompt_wrapper_id, response_tone_id, response_setting_id,
        inference_preset_id, fork_from_conversation_id, fork_from_message_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        name, original.model_id, original.user_profile_id, original.character_id,
        original.character_mood, original.prompt_wrapper_id, original.response_tone_id,
        original.response_setting_id, original.inference_preset_id, id, at_message_id
      ]
    );
    
    const fork = forkResult.rows[0];
    
    // Copy messages up to fork point
    if (at_message_id) {
      await client.query(
        `INSERT INTO conversation_messages (conversation_id, message_id, position, included_in_context, context_weight, semantic_relevance)
         SELECT $1, cm.message_id, cm.position, cm.included_in_context, cm.context_weight, cm.semantic_relevance
         FROM conversation_messages cm
         WHERE cm.conversation_id = $2
           AND cm.position <= (
             SELECT position FROM conversation_messages 
             WHERE conversation_id = $2 AND message_id = $3
           )`,
        [fork.id, id, at_message_id]
      );
    } else {
      // Copy all messages if no specific fork point
      await client.query(
        `INSERT INTO conversation_messages (conversation_id, message_id, position, included_in_context, context_weight, semantic_relevance)
         SELECT $1, cm.message_id, cm.position, cm.included_in_context, cm.context_weight, cm.semantic_relevance
         FROM conversation_messages cm
         WHERE cm.conversation_id = $2`,
        [fork.id, id]
      );
    }
    
    return fork;
  });
  
  res.status(201).json(result);
}));

export default router;