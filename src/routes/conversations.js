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

// GET /api/conversations/templates - Get conversation templates
router.get('/templates', asyncHandler(async (req, res) => {
  const result = await pool.query(`
    SELECT ct.*, 
           up.name as user_profile_name,
           c.name as character_name,
           m.name as model_name,
           ip.name as preset_name
    FROM conversation_templates ct
    LEFT JOIN user_profiles up ON ct.user_profile_id = up.id
    LEFT JOIN characters c ON ct.character_id = c.id
    LEFT JOIN models m ON ct.model_id = m.id
    LEFT JOIN inference_presets ip ON ct.inference_preset_id = ip.id
    ORDER BY ct.created_at DESC
  `);
  
  res.json(result.rows);
}));

// POST /api/conversations/templates - Create new conversation template
router.post('/templates', asyncHandler(async (req, res) => {
  const {
    name,
    model_id,
    user_profile_id,
    character_id,
    prompt_wrapper_id,
    response_tone_id,
    response_setting_id,
    inference_preset_id
  } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Template name is required' });
  }
  
  const result = await pool.query(
    `INSERT INTO conversation_templates (
      name, model_id, user_profile_id, character_id, prompt_wrapper_id,
      response_tone_id, response_setting_id, inference_preset_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *`,
    [name, model_id, user_profile_id, character_id, prompt_wrapper_id, 
     response_tone_id, response_setting_id, inference_preset_id]
  );
  
  res.status(201).json(result.rows[0]);
}));

// PUT /api/conversations/templates/:id - Update conversation template
router.put('/templates/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    name,
    model_id,
    user_profile_id,
    character_id,
    prompt_wrapper_id,
    response_tone_id,
    response_setting_id,
    inference_preset_id
  } = req.body;
  
  const fields = [
    'name', 'model_id', 'user_profile_id', 'character_id', 'prompt_wrapper_id',
    'response_tone_id', 'response_setting_id', 'inference_preset_id'
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
    `UPDATE conversation_templates 
     SET ${updates.join(', ')}
     WHERE id = $${paramCount}
     RETURNING *`,
    values
  );
  
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Template not found' });
  }
  
  res.json(result.rows[0]);
}));

// DELETE /api/conversations/templates/:id - Delete conversation template
router.delete('/templates/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const result = await pool.query(
    'DELETE FROM conversation_templates WHERE id = $1 RETURNING id, name',
    [id]
  );
  
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Template not found' });
  }
  
  res.json({ 
    message: 'Template deleted successfully',
    deleted: result.rows[0]
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

// POST /api/conversations/chat - Handle real-time chat with AI
router.post('/chat', asyncHandler(async (req, res) => {
  const { message, config, messageHistory = [] } = req.body;
  
  if (!message || !config.modelId) {
    return res.status(400).json({ error: 'Message and modelId are required' });
  }

  try {
    // Get model and provider information
    const modelResult = await pool.query(
      `SELECT m.*, p.name as provider_name, p.slug as provider_slug, p.type as provider_type, p.base_url, p.api_key_ref 
       FROM models m 
       JOIN providers p ON m.provider_id = p.id 
       WHERE m.id = $1`,
      [config.modelId]
    );

    if (modelResult.rows.length === 0) {
      return res.status(404).json({ error: 'Model not found' });
    }

    const model = modelResult.rows[0];

    // Build context if requested
    let contextInfo = null;
    let systemPrompt = '';
    
    if (config.useContext) {
      // Get character context
      if (config.characterId) {
        const characterResult = await pool.query(
          'SELECT name, description, format_type, mood_variants, internal_state FROM characters WHERE id = $1',
          [config.characterId]
        );
        if (characterResult.rows.length > 0) {
          const character = characterResult.rows[0];
          systemPrompt += `You are ${character.name}. ${character.description}\n\n`;
        }
      }

      // Get user profile context
      if (config.profileId) {
        const profileResult = await pool.query(
          'SELECT name, description FROM user_profiles WHERE id = $1',
          [config.profileId]
        );
        if (profileResult.rows.length > 0) {
          const profile = profileResult.rows[0];
          systemPrompt += `User Profile: ${profile.name}\n${profile.description}\n\n`;
        }
      }

      contextInfo = {
        compiledPrompt: systemPrompt,
        tokens: { used: systemPrompt.length / 4, max: model.context_window },
        rules: []
      };
    }

    // Get inference preset
    let inferenceSettings = {
      temperature: 0.7,
      max_tokens: 1000,
      top_p: 0.9
    };

    if (config.presetId) {
      const presetResult = await pool.query(
        'SELECT temperature, max_tokens, top_p, top_k, frequency_penalty, presence_penalty FROM inference_presets WHERE id = $1',
        [config.presetId]
      );
      if (presetResult.rows.length > 0) {
        const preset = presetResult.rows[0];
        inferenceSettings = {
          temperature: preset.temperature || 0.7,
          max_tokens: preset.max_tokens || 1000,
          top_p: preset.top_p || 0.9,
          top_k: preset.top_k,
          frequency_penalty: preset.frequency_penalty,
          presence_penalty: preset.presence_penalty
        };
      }
    }

    // Prepare messages for AI API
    const messages = [];
    
    if (systemPrompt) {
      messages.push({
        role: 'system',
        content: systemPrompt
      });
    }

    // Add message history
    messageHistory.forEach(msg => {
      messages.push({
        role: msg.role,
        content: msg.content
      });
    });

    // Add current user message
    messages.push({
      role: 'user',
      content: message
    });

    // Make actual AI API call to the model's provider
    const aiResponse = await callAiProvider(model, messages, inferenceSettings);

    // Store messages in database for history (optional)
    // You could create a temporary conversation or just keep in memory

    res.json({
      response: aiResponse,
      contextInfo: contextInfo,
      model: {
        name: model.name,
        provider: model.provider_name
      }
    });

  } catch (error) {
    console.error('Chat error:', error.message);
    console.error('Stack:', error.stack);
    res.status(500).json({ error: 'Failed to process chat message', details: error.message });
  }
}));

// AI Provider API call function
async function callAiProvider(model, messages, inferenceSettings) {
  const { provider_slug, provider_name, base_url, name: modelName } = model;
  
  try {
    let response;
    
    switch (provider_slug) {
      case 'openai':
        response = await callOpenAI(base_url, modelName, messages, inferenceSettings);
        break;
      case 'anthropic':
        response = await callAnthropic(base_url, modelName, messages, inferenceSettings);
        break;
      case 'lmstudio':
        response = await callLMStudio(base_url, modelName, messages, inferenceSettings);
        break;
      case 'nanogpt':
        response = await callNanoGPT(base_url, modelName, messages, inferenceSettings);
        break;
      default:
        throw new Error(`Unsupported provider: ${provider_slug}`);
    }
    
    return response;
  } catch (error) {
    console.error(`Error calling ${provider_name}:`, error);
    throw new Error(`Failed to get response from ${provider_name}: ${error.message}`);
  }
}

// OpenAI API call
async function callOpenAI(baseUrl, model, messages, settings) {
  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: model,
      messages: messages,
      temperature: settings.temperature,
      max_tokens: settings.max_tokens,
      top_p: settings.top_p,
      frequency_penalty: settings.frequency_penalty,
      presence_penalty: settings.presence_penalty
    })
  });
  
  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.choices[0].message.content;
}

// Anthropic API call
async function callAnthropic(baseUrl, model, messages, settings) {
  // Convert messages format for Anthropic
  const systemMessage = messages.find(m => m.role === 'system');
  const conversationMessages = messages.filter(m => m.role !== 'system');
  
  const response = await fetch(`${baseUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: model,
      max_tokens: settings.max_tokens,
      temperature: settings.temperature,
      system: systemMessage?.content,
      messages: conversationMessages
    })
  });
  
  if (!response.ok) {
    throw new Error(`Anthropic API error: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.content[0].text;
}

// LM Studio API call (OpenAI-compatible)
async function callLMStudio(baseUrl, model, messages, settings) {
  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: model,
      messages: messages,
      temperature: settings.temperature,
      max_tokens: settings.max_tokens,
      top_p: settings.top_p
    })
  });
  
  if (!response.ok) {
    throw new Error(`LM Studio API error: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.choices[0].message.content;
}

// Nano GPT API call
async function callNanoGPT(baseUrl, model, messages, settings) {
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.NANOGPT_API_KEY}`
    },
    body: JSON.stringify({
      model: model,
      messages: messages,
      temperature: settings.temperature,
      max_tokens: settings.max_tokens,
      top_p: settings.top_p
    })
  });
  
  if (!response.ok) {
    throw new Error(`Nano GPT API error: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.response || data.message || data.content;
}


export default router;