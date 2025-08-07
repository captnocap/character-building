import express from 'express';
import asyncHandler from 'express-async-handler';
import { pool } from '../config/database.js';

const router = express.Router();

// GET /api/rules - List all context rules
router.get('/', asyncHandler(async (req, res) => {
  const result = await pool.query(`
    SELECT cr.*, c.name AS character_name, conv.name AS conversation_name 
    FROM context_rules cr
    LEFT JOIN characters c ON c.id = cr.character_id
    LEFT JOIN conversations conv ON conv.id = cr.conversation_id
    ORDER BY cr.created_at DESC
  `);
  res.json(result.rows);
}));

// GET /api/rules/:id - Get a specific rule
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const result = await pool.query(`
    SELECT cr.*, c.name AS character_name, conv.name AS conversation_name 
    FROM context_rules cr
    LEFT JOIN characters c ON c.id = cr.character_id
    LEFT JOIN conversations conv ON conv.id = cr.conversation_id
    WHERE cr.id = $1
  `, [id]);
  
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Rule not found' });
  }
  
  res.json(result.rows[0]);
}));

// POST /api/rules - Create new rule
router.post('/', asyncHandler(async (req, res) => {
  const { 
    name, 
    rule_type, 
    weight = 1.0, 
    parameters = {},
    scope = 'global',
    character_id,
    conversation_id,
    active = true
  } = req.body;

  if (!name || !rule_type) {
    return res.status(400).json({ error: 'name and rule_type are required' });
  }

  const validRuleTypes = ['recency', 'relevance', 'rating', 'recall_frequency', 'tag_based'];
  if (!validRuleTypes.includes(rule_type)) {
    return res.status(400).json({ error: 'Invalid rule_type' });
  }

  const validScopes = ['global', 'character', 'conversation'];
  if (!validScopes.includes(scope)) {
    return res.status(400).json({ error: 'Invalid scope' });
  }

  const result = await pool.query(
    `INSERT INTO context_rules (name, rule_type, weight, parameters, scope, character_id, conversation_id, active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [name, rule_type, weight, JSON.stringify(parameters), scope, character_id, conversation_id, active]
  );

  res.status(201).json(result.rows[0]);
}));

// PUT /api/rules/:id - Update rule
router.put('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { 
    name, 
    rule_type, 
    weight, 
    parameters,
    scope,
    character_id,
    conversation_id,
    active
  } = req.body;

  const result = await pool.query(
    `UPDATE context_rules 
     SET name = COALESCE($1, name),
         rule_type = COALESCE($2, rule_type),
         weight = COALESCE($3, weight),
         parameters = COALESCE($4, parameters),
         scope = COALESCE($5, scope),
         character_id = COALESCE($6, character_id),
         conversation_id = COALESCE($7, conversation_id),
         active = COALESCE($8, active)
     WHERE id = $9
     RETURNING *`,
    [
      name, 
      rule_type, 
      weight, 
      parameters ? JSON.stringify(parameters) : null,
      scope,
      character_id,
      conversation_id,
      active,
      id
    ]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Rule not found' });
  }

  res.json(result.rows[0]);
}));

// DELETE /api/rules/:id - Delete rule
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const result = await pool.query(
    'DELETE FROM context_rules WHERE id = $1 RETURNING *',
    [id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Rule not found' });
  }

  res.json({ message: 'Rule deleted successfully' });
}));

// POST /api/rules/:id/test - Test rule against message history
router.post('/:id/test', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { test_data } = req.body;

  // Get the rule
  const ruleResult = await pool.query('SELECT * FROM context_rules WHERE id = $1', [id]);
  if (ruleResult.rows.length === 0) {
    return res.status(404).json({ error: 'Rule not found' });
  }

  const rule = ruleResult.rows[0];
  
  // Simple test implementation - would be more complex in real implementation
  let testResult = {
    rule_name: rule.name,
    rule_type: rule.rule_type,
    weight: rule.weight,
    test_input: test_data,
    mock_score: Math.random() * rule.weight, // Mock scoring
    estimated_tokens: Math.floor(Math.random() * 100) + 50
  };

  res.json(testResult);
}));

export default router;