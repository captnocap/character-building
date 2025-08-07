import express from 'express';
import asyncHandler from 'express-async-handler';
import { pool } from '../config/database.js';

const router = express.Router();

// GET /api/build/counts - Get counts for navigation badges
router.get('/counts', asyncHandler(async (req, res) => {
  try {
    const queries = [
      'SELECT COUNT(*) as count FROM providers',
      'SELECT COUNT(*) as count FROM models', 
      'SELECT COUNT(*) as count FROM characters',
      'SELECT COUNT(*) as count FROM user_profiles',
      'SELECT COUNT(*) as count FROM inference_presets',
      'SELECT COUNT(*) as count FROM context_rules'
    ];

    const results = await Promise.all(
      queries.map(query => pool.query(query))
    );

    const counts = {
      providers: parseInt(results[0].rows[0].count),
      models: parseInt(results[1].rows[0].count),
      characters: parseInt(results[2].rows[0].count),
      profiles: parseInt(results[3].rows[0].count),
      presets: parseInt(results[4].rows[0].count),
      templates: 0, // Templates might be derived, not stored
      rules: parseInt(results[5].rows[0].count)
    };

    res.json(counts);
  } catch (error) {
    console.error('Error fetching counts:', error);
    res.status(500).json({ error: 'Failed to fetch counts' });
  }
}));

export default router;