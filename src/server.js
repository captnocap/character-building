import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { pool } from './config/database.js';

// Routes
import userProfileRoutes from './routes/userProfiles.js';
import characterRoutes from './routes/characters.js';
import conversationRoutes from './routes/conversations.js';
import messageRoutes from './routes/messages.js';
import providerRoutes from './routes/providers.js';
import modelRoutes from './routes/models.js';
import inferencePresetRoutes from './routes/inferencePresets.js';
import contextRoutes from './routes/context.js';
import forgeRoutes from './routes/forge.js';
import memoryRoutes from './routes/memories.js';
import buildRoutes from './routes/build.js';
import rulesRoutes from './routes/rules.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api/user-profiles', userProfileRoutes);
app.use('/api/characters', characterRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/providers', providerRoutes);
app.use('/api/models', modelRoutes);
app.use('/api/inference-presets', inferencePresetRoutes);
app.use('/api/context', contextRoutes);
app.use('/api/forge', forgeRoutes);
app.use('/api/memories', memoryRoutes);
app.use('/api/build', buildRoutes);
app.use('/api/rules', rulesRoutes);

// Health check
app.get('/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ 
      status: 'healthy', 
      timestamp: result.rows[0].now,
      database: 'connected'
    });
  } catch (error) {
    res.status(503).json({ 
      status: 'unhealthy', 
      error: error.message 
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 API available at http://localhost:${PORT}/api`);
});