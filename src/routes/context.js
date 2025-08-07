import express from 'express';
import asyncHandler from 'express-async-handler';
import { pool } from '../config/database.js';

const router = express.Router();

// POST /api/context/compile - Compile context for a conversation
router.post('/compile', asyncHandler(async (req, res) => {
  const {
    conversation_id,
    user_input,
    max_tokens = 8000,
    intent_hint,
    include_user_profile = true,
    include_character_context = true,
    include_memories = true
  } = req.body;
  
  if (!conversation_id) {
    return res.status(400).json({ error: 'conversation_id is required' });
  }
  
  const context = await compileContext({
    conversation_id,
    user_input,
    max_tokens,
    intent_hint,
    include_user_profile,
    include_character_context,
    include_memories
  });
  
  res.json(context);
}));

// POST /api/context/preview - Preview context compilation without saving
router.post('/preview', asyncHandler(async (req, res) => {
  const {
    conversation_id,
    user_input,
    max_tokens = 8000,
    context_adjustments = {}
  } = req.body;
  
  const context = await compileContext({
    conversation_id,
    user_input,
    max_tokens,
    preview: true,
    adjustments: context_adjustments
  });
  
  // Add debugging info for preview
  context.debug = {
    token_estimate: estimateTokens(context.compiled),
    message_count: context.messages?.length || 0,
    memory_count: context.memories?.length || 0
  };
  
  res.json(context);
}));

// PUT /api/context/rules - Update context compilation rules
router.put('/rules', asyncHandler(async (req, res) => {
  const { rules } = req.body;
  
  if (!Array.isArray(rules)) {
    return res.status(400).json({ error: 'Rules must be an array' });
  }
  
  // Update or insert rules
  const results = [];
  for (const rule of rules) {
    const result = await pool.query(
      `INSERT INTO context_rules (name, rule_type, weight, parameters, scope, character_id, conversation_id, active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (name) DO UPDATE SET
         rule_type = EXCLUDED.rule_type,
         weight = EXCLUDED.weight,
         parameters = EXCLUDED.parameters,
         scope = EXCLUDED.scope,
         character_id = EXCLUDED.character_id,
         conversation_id = EXCLUDED.conversation_id,
         active = EXCLUDED.active
       RETURNING *`,
      [
        rule.name,
        rule.rule_type,
        rule.weight || 1.0,
        rule.parameters || {},
        rule.scope || 'global',
        rule.character_id,
        rule.conversation_id,
        rule.active !== false
      ]
    );
    results.push(result.rows[0]);
  }
  
  res.json({ updated_rules: results });
}));

// GET /api/context/rules - Get active context rules
router.get('/rules', asyncHandler(async (req, res) => {
  const { scope, character_id, conversation_id } = req.query;
  
  let query = 'SELECT * FROM context_rules WHERE active = true';
  const values = [];
  
  if (scope) {
    values.push(scope);
    query += ` AND scope = $${values.length}`;
  }
  
  if (character_id) {
    values.push(character_id);
    query += ` AND (character_id IS NULL OR character_id = $${values.length})`;
  }
  
  if (conversation_id) {
    values.push(conversation_id);
    query += ` AND (conversation_id IS NULL OR conversation_id = $${values.length})`;
  }
  
  query += ' ORDER BY weight DESC, created_at ASC';
  
  const result = await pool.query(query, values);
  res.json(result.rows);
}));

// POST /api/context/intent - Detect intent from user input
router.post('/intent', asyncHandler(async (req, res) => {
  const { user_input, conversation_id } = req.body;
  
  if (!user_input) {
    return res.status(400).json({ error: 'user_input is required' });
  }
  
  // Get intent patterns
  const patterns = await pool.query(
    'SELECT * FROM intent_patterns ORDER BY priority_boost DESC'
  );
  
  const detectedIntents = [];
  
  for (const pattern of patterns.rows) {
    const regex = new RegExp(pattern.pattern, 'i');
    if (regex.test(user_input)) {
      detectedIntents.push({
        intent_type: pattern.intent_type,
        context_tags: pattern.context_tags,
        priority_boost: pattern.priority_boost,
        pattern: pattern.pattern
      });
    }
  }
  
  res.json({
    user_input,
    detected_intents: detectedIntents,
    primary_intent: detectedIntents[0]?.intent_type || 'general'
  });
}));

// POST /api/context/semantic-search - Find semantically similar messages
router.post('/semantic-search', asyncHandler(async (req, res) => {
  const {
    query_text,
    conversation_id,
    limit = 10,
    min_similarity = 0.7
  } = req.body;
  
  if (!query_text) {
    return res.status(400).json({ error: 'query_text is required' });
  }
  
  // For now, use text similarity. In production, use vector similarity
  let sql = `
    SELECT m.*, cm.context_weight, cm.semantic_relevance,
           similarity(m.content, $1) as similarity_score
    FROM messages m
    LEFT JOIN conversation_messages cm ON m.id = cm.message_id
    WHERE similarity(m.content, $1) > $2
  `;
  const values = [query_text, min_similarity];
  
  if (conversation_id) {
    values.push(conversation_id);
    sql += ` AND (cm.conversation_id = $${values.length} OR cm.conversation_id IS NULL)`;
  }
  
  sql += ` ORDER BY similarity_score DESC LIMIT ${limit}`;
  
  const result = await pool.query(sql, values);
  
  res.json({
    query: query_text,
    matches: result.rows,
    count: result.rows.length
  });
}));

// Helper function to compile context
async function compileContext({
  conversation_id,
  user_input,
  max_tokens,
  intent_hint,
  include_user_profile = true,
  include_character_context = true,
  include_memories = true,
  preview = false,
  adjustments = {}
}) {
  
  // Get conversation details
  const convResult = await pool.query(
    `SELECT c.*,
            up.name as user_profile_name, up.description as user_profile_desc,
            ch.name as character_name, ch.description as character_desc,
            ch.mood_variants, ch.internal_state,
            pw.before_text, pw.after_text,
            rt.instruction as response_tone,
            rs.content as response_setting
     FROM conversations c
     LEFT JOIN user_profiles up ON c.user_profile_id = up.id
     LEFT JOIN characters ch ON c.character_id = ch.id
     LEFT JOIN prompt_wrappers pw ON c.prompt_wrapper_id = pw.id
     LEFT JOIN response_tones rt ON c.response_tone_id = rt.id
     LEFT JOIN response_settings rs ON c.response_setting_id = rs.id
     WHERE c.id = $1`,
    [conversation_id]
  );
  
  if (convResult.rows.length === 0) {
    throw new Error('Conversation not found');
  }
  
  const conversation = convResult.rows[0];
  const contextParts = [];
  let tokenCount = 0;
  
  // System context
  if (conversation.before_text) {
    contextParts.push({ type: 'system', content: conversation.before_text });
  }
  
  // User profile
  if (include_user_profile && conversation.user_profile_desc) {
    contextParts.push({
      type: 'user_profile',
      content: `User Profile - ${conversation.user_profile_name}: ${conversation.user_profile_desc}`
    });
  }
  
  // Character context
  if (include_character_context && conversation.character_desc) {
    let charContext = `Character: ${conversation.character_name}\n${conversation.character_desc}`;
    
    // Add mood if specified
    if (conversation.character_mood && conversation.mood_variants) {
      const moodText = conversation.mood_variants[conversation.character_mood];
      if (moodText) {
        charContext += `\n\nCurrent Mood (${conversation.character_mood}): ${moodText}`;
      }
    }
    
    // Add internal state
    if (conversation.internal_state) {
      charContext += `\n\nInternal State: ${JSON.stringify(conversation.internal_state)}`;
    }
    
    contextParts.push({ type: 'character', content: charContext });
  }
  
  // Character memories
  let memories = [];
  if (include_memories && conversation.character_id) {
    const memoryResult = await pool.query(
      `SELECT * FROM character_memories 
       WHERE character_id = $1 AND persistent = true
       ORDER BY memory_weight DESC, created_at DESC
       LIMIT 20`,
      [conversation.character_id]
    );
    
    memories = memoryResult.rows;
    for (const memory of memories.slice(0, 5)) { // Limit to top 5 for token budget
      contextParts.push({
        type: 'memory',
        content: `Memory - ${memory.label}: ${memory.content}`
      });
    }
  }
  
  // Conversation messages with dynamic scoring
  const messagesResult = await pool.query(
    `SELECT m.*, cm.position, cm.included_in_context, cm.context_weight, cm.semantic_relevance
     FROM conversation_messages cm
     JOIN messages m ON cm.message_id = m.id
     WHERE cm.conversation_id = $1 AND cm.included_in_context = true
     ORDER BY cm.position DESC`,
    [conversation_id]
  );
  
  const messages = messagesResult.rows;
  const scoredMessages = messages.map(msg => ({
    ...msg,
    computed_score: computeMessageScore(msg, user_input, intent_hint)
  }));
  
  // Sort by score and include top messages within token budget
  scoredMessages.sort((a, b) => b.computed_score - a.computed_score);
  
  const selectedMessages = [];
  for (const msg of scoredMessages) {
    const msgTokens = estimateTokens(msg.content);
    if (tokenCount + msgTokens < max_tokens * 0.7) { // Reserve 30% for other context
      selectedMessages.push(msg);
      tokenCount += msgTokens;
    }
  }
  
  // Add messages to context (re-sort by position)
  selectedMessages.sort((a, b) => a.position - b.position);
  for (const msg of selectedMessages) {
    contextParts.push({
      type: 'message',
      role: msg.role,
      content: msg.content,
      score: msg.computed_score
    });
  }
  
  // Response settings
  if (conversation.response_tone) {
    contextParts.push({ type: 'tone', content: conversation.response_tone });
  }
  
  if (conversation.response_setting) {
    contextParts.push({ type: 'setting', content: conversation.response_setting });
  }
  
  // Current user input
  if (user_input) {
    contextParts.push({ type: 'user_input', content: user_input });
  }
  
  // System closing
  if (conversation.after_text) {
    contextParts.push({ type: 'system', content: conversation.after_text });
  }
  
  // Compile final context
  const compiled = contextParts.map(part => 
    part.role ? `${part.role}: ${part.content}` : part.content
  ).join('\n\n');
  
  return {
    conversation_id,
    compiled,
    parts: contextParts,
    messages: selectedMessages,
    memories,
    token_estimate: estimateTokens(compiled),
    context_rules_applied: await getActiveRules(conversation_id, conversation.character_id)
  };
}

// Helper function to compute message relevance score
function computeMessageScore(message, userInput, intentHint) {
  let score = 0;
  
  // Base recency score
  const hoursOld = (Date.now() - new Date(message.created_at)) / (1000 * 60 * 60);
  score += Math.max(0, 100 - hoursOld); // Recent messages score higher
  
  // User rating boost
  if (message.rating) {
    score += message.rating * 10;
  }
  
  // Context weight from conversation settings
  score += (message.context_weight || 1.0) * 20;
  
  // Semantic relevance if computed
  if (message.semantic_relevance) {
    score += message.semantic_relevance * 30;
  }
  
  // Simple text similarity to user input (could use embeddings)
  if (userInput && message.content) {
    const similarity = computeSimpleSimilarity(message.content, userInput);
    score += similarity * 25;
  }
  
  // Tag-based boosts based on intent
  if (intentHint && message.tags) {
    const intentBoosts = {
      'activity_recall': ['activity', 'experience'],
      'emotional_continuity': ['emotional', 'intimate', 'personal'],
      'technical_info': ['technical', 'information', 'factual']
    };
    
    const relevantTags = intentBoosts[intentHint] || [];
    const tagMatches = message.tags.filter(tag => relevantTags.includes(tag)).length;
    score += tagMatches * 15;
  }
  
  return score;
}

// Simple text similarity (replace with proper embedding similarity)
function computeSimpleSimilarity(text1, text2) {
  const words1 = text1.toLowerCase().split(/\W+/);
  const words2 = text2.toLowerCase().split(/\W+/);
  const intersection = words1.filter(word => words2.includes(word));
  const union = [...new Set([...words1, ...words2])];
  return intersection.length / union.length;
}

// Token estimation (rough)
function estimateTokens(text) {
  if (!text) return 0;
  return Math.ceil(text.split(/\s+/).length * 1.3); // Rough estimate
}

// Get active context rules
async function getActiveRules(conversationId, characterId) {
  const result = await pool.query(
    `SELECT * FROM context_rules 
     WHERE active = true 
       AND (scope = 'global' 
         OR (scope = 'character' AND character_id = $1)
         OR (scope = 'conversation' AND conversation_id = $2))
     ORDER BY weight DESC`,
    [characterId, conversationId]
  );
  return result.rows;
}

export default router;