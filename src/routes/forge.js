import express from 'express';
import asyncHandler from 'express-async-handler';
import { pool, withTransaction } from '../config/database.js';

const router = express.Router();

// POST /api/forge/session - Create new forge session
router.post('/session', asyncHandler(async (req, res) => {
  const {
    name,
    user_profile_id,
    character_id,
    source_messages = [],
    source_memories = [],
    metadata = {}
  } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Session name is required' });
  }
  
  // Compile context from selected sources
  const context = await compileForgeContext({
    user_profile_id,
    character_id,
    source_messages,
    source_memories,
    metadata
  });
  
  const result = await pool.query(
    `INSERT INTO forge_sessions (name, compiled_context, source_messages, source_memories, user_profile_id, character_id, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [name, context.compiled, source_messages, source_memories, user_profile_id, character_id, metadata]
  );
  
  res.status(201).json({
    session: result.rows[0],
    context_preview: context.preview,
    token_count: context.token_count
  });
}));

// GET /api/forge/sessions - List forge sessions
router.get('/sessions', asyncHandler(async (req, res) => {
  const { limit = 50, offset = 0, character_id, user_profile_id } = req.query;
  
  let query = `
    SELECT fs.*,
           up.name as user_profile_name,
           ch.name as character_name
    FROM forge_sessions fs
    LEFT JOIN user_profiles up ON fs.user_profile_id = up.id
    LEFT JOIN characters ch ON fs.character_id = ch.id
    WHERE 1=1
  `;
  const values = [];
  
  if (character_id) {
    values.push(character_id);
    query += ` AND fs.character_id = $${values.length}`;
  }
  
  if (user_profile_id) {
    values.push(user_profile_id);
    query += ` AND fs.user_profile_id = $${values.length}`;
  }
  
  query += ` ORDER BY fs.created_at DESC LIMIT ${limit} OFFSET ${offset}`;
  
  const result = await pool.query(query, values);
  res.json(result.rows);
}));

// GET /api/forge/sessions/:id - Get forge session
router.get('/sessions/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const result = await pool.query(
    `SELECT fs.*,
            up.name as user_profile_name, up.description as user_profile_desc,
            ch.name as character_name, ch.description as character_desc
     FROM forge_sessions fs
     LEFT JOIN user_profiles up ON fs.user_profile_id = up.id
     LEFT JOIN characters ch ON fs.character_id = ch.id
     WHERE fs.id = $1`,
    [id]
  );
  
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Forge session not found' });
  }
  
  res.json(result.rows[0]);
}));

// POST /api/forge/sessions/:id/continue - Continue conversation from forge session
router.post('/sessions/:id/continue', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { user_input, create_conversation = true } = req.body;
  
  if (!user_input) {
    return res.status(400).json({ error: 'user_input is required' });
  }
  
  const sessionResult = await pool.query(
    'SELECT * FROM forge_sessions WHERE id = $1',
    [id]
  );
  
  if (sessionResult.rows.length === 0) {
    return res.status(404).json({ error: 'Forge session not found' });
  }
  
  const session = sessionResult.rows[0];
  
  const result = await withTransaction(async (client) => {
    let conversation;
    
    if (create_conversation) {
      // Create new synthetic conversation
      const convResult = await client.query(
        `INSERT INTO conversations (
          name, user_profile_id, character_id, is_synthetic
        ) VALUES ($1, $2, $3, true)
        RETURNING *`,
        [`Forge: ${session.name}`, session.user_profile_id, session.character_id]
      );
      conversation = convResult.rows[0];
      
      // Add source messages to conversation
      if (session.source_messages && session.source_messages.length > 0) {
        for (let i = 0; i < session.source_messages.length; i++) {
          await client.query(
            `INSERT INTO conversation_messages (conversation_id, message_id, position, included_in_context)
             VALUES ($1, $2, $3, true)`,
            [conversation.id, session.source_messages[i], i + 1]
          );
        }
      }
    }
    
    // Add user input as new message
    const messageResult = await client.query(
      `INSERT INTO messages (role, content, provenance)
       VALUES ('user', $1, $2)
       RETURNING *`,
      [user_input, { forge_session_id: id, created_via: 'forge_continue' }]
    );
    
    const message = messageResult.rows[0];
    
    if (conversation) {
      // Link user message to conversation
      const nextPos = session.source_messages?.length || 0;
      await client.query(
        `INSERT INTO conversation_messages (conversation_id, message_id, position, included_in_context)
         VALUES ($1, $2, $3, true)`,
        [conversation.id, message.id, nextPos + 1]
      );
    }
    
    return {
      session: session,
      conversation: conversation,
      user_message: message,
      compiled_context: session.compiled_context + `\n\nUser: ${user_input}`
    };
  });
  
  res.status(201).json(result);
}));

// POST /api/forge/ghost-response - Create ghost response
router.post('/ghost-response', asyncHandler(async (req, res) => {
  const {
    character_id,
    content,
    ghost_author = 'developer',
    tags = [],
    memory_weight = 1.0,
    conversation_id,
    position_after_message_id
  } = req.body;
  
  if (!character_id || !content) {
    return res.status(400).json({ error: 'character_id and content are required' });
  }
  
  const result = await withTransaction(async (client) => {
    // Create ghost message
    const messageResult = await client.query(
      `INSERT INTO messages (role, content, is_ghost, ghost_author, tags, provenance)
       VALUES ('assistant', $1, true, $2, $3, $4)
       RETURNING *`,
      [
        content, 
        ghost_author, 
        tags, 
        { 
          ghost_created_at: new Date().toISOString(),
          character_id,
          forge_created: true
        }
      ]
    );
    
    const message = messageResult.rows[0];
    
    // If adding to conversation, insert in proper position
    if (conversation_id) {
      let position = 1;
      
      if (position_after_message_id) {
        const posResult = await client.query(
          'SELECT position FROM conversation_messages WHERE conversation_id = $1 AND message_id = $2',
          [conversation_id, position_after_message_id]
        );
        
        if (posResult.rows.length > 0) {
          position = posResult.rows[0].position + 1;
          
          // Shift subsequent messages
          await client.query(
            'UPDATE conversation_messages SET position = position + 1 WHERE conversation_id = $1 AND position >= $2',
            [conversation_id, position]
          );
        }
      } else {
        // Add at end
        const maxPosResult = await client.query(
          'SELECT COALESCE(MAX(position), 0) + 1 as next_pos FROM conversation_messages WHERE conversation_id = $1',
          [conversation_id]
        );
        position = maxPosResult.rows[0].next_pos;
      }
      
      await client.query(
        `INSERT INTO conversation_messages (conversation_id, message_id, position, included_in_context, context_weight)
         VALUES ($1, $2, $3, true, $4)`,
        [conversation_id, message.id, position, memory_weight]
      );
    }
    
    return message;
  });
  
  res.status(201).json(result);
}));

// POST /api/forge/ghost-log - Create character ghost log entry
router.post('/ghost-log', asyncHandler(async (req, res) => {
  const {
    character_id,
    content,
    log_date,
    tags = [],
    memory_weight = 1.0
  } = req.body;
  
  if (!character_id || !content) {
    return res.status(400).json({ error: 'character_id and content are required' });
  }
  
  // Get next entry number for character
  const entryResult = await pool.query(
    'SELECT COALESCE(MAX(entry_number), 0) + 1 as next_entry FROM ghost_logs WHERE character_id = $1',
    [character_id]
  );
  
  const result = await pool.query(
    `INSERT INTO ghost_logs (character_id, entry_number, log_date, content, tags, memory_weight, provenance)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      character_id,
      entryResult.rows[0].next_entry,
      log_date || new Date(),
      content,
      tags,
      memory_weight,
      { created_via: 'forge_api', timestamp: new Date().toISOString() }
    ]
  );
  
  res.status(201).json(result.rows[0]);
}));

// GET /api/forge/ghost-logs/:characterId - Get ghost logs for character
router.get('/ghost-logs/:characterId', asyncHandler(async (req, res) => {
  const { characterId } = req.params;
  const { limit = 100, offset = 0 } = req.query;
  
  const result = await pool.query(
    `SELECT * FROM ghost_logs 
     WHERE character_id = $1
     ORDER BY log_date DESC, entry_number DESC
     LIMIT $2 OFFSET $3`,
    [characterId, limit, offset]
  );
  
  res.json(result.rows);
}));

// POST /api/forge/timeline - Create timeline from mixed sources
router.post('/timeline', asyncHandler(async (req, res) => {
  const {
    name,
    timeline_entries,
    character_id,
    user_profile_id,
    create_conversation = false
  } = req.body;
  
  if (!name || !Array.isArray(timeline_entries)) {
    return res.status(400).json({ error: 'name and timeline_entries array are required' });
  }
  
  const result = await withTransaction(async (client) => {
    const createdMessages = [];
    let conversation;
    
    if (create_conversation) {
      const convResult = await client.query(
        `INSERT INTO conversations (name, character_id, user_profile_id, is_synthetic)
         VALUES ($1, $2, $3, true)
         RETURNING *`,
        [name, character_id, user_profile_id]
      );
      conversation = convResult.rows[0];
    }
    
    // Process timeline entries in order
    for (let i = 0; i < timeline_entries.length; i++) {
      const entry = timeline_entries[i];
      
      if (entry.type === 'message') {
        // Create new message
        const msgResult = await client.query(
          `INSERT INTO messages (role, content, is_ghost, ghost_author, tags, provenance)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING *`,
          [
            entry.role,
            entry.content,
            entry.is_ghost || (entry.role === 'assistant' && entry.ghost_author),
            entry.ghost_author,
            entry.tags || [],
            {
              timeline_entry: i,
              created_via: 'forge_timeline',
              original_timestamp: entry.timestamp
            }
          ]
        );
        
        const message = msgResult.rows[0];
        createdMessages.push(message);
        
        // Link to conversation if requested
        if (conversation) {
          await client.query(
            `INSERT INTO conversation_messages (conversation_id, message_id, position, included_in_context, context_weight)
             VALUES ($1, $2, $3, true, $4)`,
            [conversation.id, message.id, i + 1, entry.context_weight || 1.0]
          );
        }
        
      } else if (entry.type === 'memory' && character_id) {
        // Create character memory
        await client.query(
          `INSERT INTO character_memories (character_id, label, content, category, persistent, memory_weight)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            character_id,
            entry.label || `Timeline Memory ${i}`,
            entry.content,
            entry.category || 'timeline',
            entry.persistent !== false,
            entry.memory_weight || 1.0
          ]
        );
        
      } else if (entry.type === 'ghost_log' && character_id) {
        // Create ghost log entry
        const entryNumResult = await client.query(
          'SELECT COALESCE(MAX(entry_number), 0) + 1 as next_entry FROM ghost_logs WHERE character_id = $1',
          [character_id]
        );
        
        await client.query(
          `INSERT INTO ghost_logs (character_id, entry_number, log_date, content, tags, memory_weight)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            character_id,
            entryNumResult.rows[0].next_entry,
            entry.log_date || entry.timestamp || new Date(),
            entry.content,
            entry.tags || [],
            entry.memory_weight || 1.0
          ]
        );
      }
    }
    
    // Create forge session to track this timeline
    const sessionResult = await client.query(
      `INSERT INTO forge_sessions (name, compiled_context, source_messages, user_profile_id, character_id, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        name,
        `Timeline: ${name}\n\n${timeline_entries.map(e => 
          `${e.type}: ${e.content || e.label}`
        ).join('\n')}`,
        createdMessages.map(m => m.id),
        user_profile_id,
        character_id,
        { 
          timeline_created: true, 
          entry_count: timeline_entries.length,
          conversation_id: conversation?.id 
        }
      ]
    );
    
    return {
      forge_session: sessionResult.rows[0],
      conversation,
      created_messages: createdMessages,
      processed_entries: timeline_entries.length
    };
  });
  
  res.status(201).json(result);
}));

// Helper function to compile forge context
async function compileForgeContext({
  user_profile_id,
  character_id,
  source_messages = [],
  source_memories = [],
  metadata = {}
}) {
  const contextParts = [];
  
  // User profile
  if (user_profile_id) {
    const userResult = await pool.query(
      'SELECT name, description FROM user_profiles WHERE id = $1',
      [user_profile_id]
    );
    if (userResult.rows.length > 0) {
      const user = userResult.rows[0];
      contextParts.push(`User Profile - ${user.name}: ${user.description}`);
    }
  }
  
  // Character context
  if (character_id) {
    const charResult = await pool.query(
      'SELECT name, description FROM characters WHERE id = $1',
      [character_id]
    );
    if (charResult.rows.length > 0) {
      const char = charResult.rows[0];
      contextParts.push(`Character: ${char.name}\n${char.description}`);
    }
  }
  
  // Source messages
  if (source_messages.length > 0) {
    const msgResult = await pool.query(
      'SELECT role, content, created_at FROM messages WHERE id = ANY($1) ORDER BY created_at',
      [source_messages]
    );
    
    for (const msg of msgResult.rows) {
      contextParts.push(`${msg.role}: ${msg.content}`);
    }
  }
  
  // Source memories
  if (source_memories.length > 0) {
    const memResult = await pool.query(
      'SELECT label, content FROM character_memories WHERE id = ANY($1)',
      [source_memories]
    );
    
    for (const mem of memResult.rows) {
      contextParts.push(`Memory - ${mem.label}: ${mem.content}`);
    }
  }
  
  const compiled = contextParts.join('\n\n');
  
  return {
    compiled,
    preview: contextParts.map((part, i) => ({
      section: i,
      type: part.startsWith('User Profile') ? 'user_profile' :
             part.startsWith('Character:') ? 'character' :
             part.startsWith('Memory') ? 'memory' : 'message',
      content: part.substring(0, 200) + (part.length > 200 ? '...' : '')
    })),
    token_count: Math.ceil(compiled.split(/\s+/).length * 1.3)
  };
}

export default router;