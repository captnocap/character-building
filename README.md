# Character & Conversation Management API

A comprehensive API for building advanced AI character systems with persistent user profiles, dynamic context compilation, and powerful dev tools for creating synthetic conversations and ghost responses.

## 🚀 Features

- **User Profiles**: Persistent user identity to eliminate re-learning
- **Character Management**: Complex personas with mood variants and internal states
- **Dynamic Context Windows**: Rolling, intelligent context compilation
- **Ghost Responses**: Create synthetic character history
- **Forge Mode**: Dev tools for timeline manipulation
- **Memory System**: Character memories with weighting and categorization
- **Full-Text Search**: Search across messages, memories, and profiles
- **Context Rules**: Configurable scoring for context compilation

## 🗄️ Database Schema

The API uses PostgreSQL with full-text search, JSONB fields, and optional pgvector for semantic search. Key tables:

- `user_profiles` - Persistent user identity
- `characters` - AI personas with mood variants
- `conversations` - Session management with forking
- `messages` - All content with ratings and ghost support
- `character_memories` - MCP-style memory storage
- `context_windows` - Dynamic context compilation
- `forge_sessions` - Dev mode timeline creation

## 🔧 Setup

```bash
# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Update database credentials in .env
# DB_HOST=localhost
# DB_PORT=5432
# DB_NAME=character_db
# DB_USER=postgres
# DB_PASSWORD=your_password

# Run the schema.sql file in your PostgreSQL database

# Start the server
npm start
# or for development
npm run dev
```

## 📋 Core API Endpoints

### User Profiles 👤

Create persistent user identities that characters remember across sessions:

```bash
# Create user profile
POST /api/user-profiles
{
  "name": "Alex",
  "description": "Software engineer interested in AI and philosophy. Prefers direct communication and deep technical discussions.",
  "format_type": "plain"
}

# Get user profile
GET /api/user-profiles/:id

# Update profile
PUT /api/user-profiles/:id
{
  "description": "Updated description with new preferences..."
}

# Clone profile (useful for variants)
POST /api/user-profiles/:id/clone
{
  "name": "Alex - Work Mode"
}

# Get all conversations for a user
GET /api/user-profiles/:id/conversations
```

### Characters 🎭

Create rich AI personas with mood variants and internal states:

```bash
# Create character
POST /api/characters
{
  "name": "Lyla",
  "description": "A contemplative AI researcher with a dry sense of humor.",
  "format_type": "markdown",
  "mood_variants": {
    "contemplative": "Speaking in measured tones, choosing words carefully",
    "playful": "Quick wit and teasing humor come naturally",
    "focused": "Direct and efficient, cutting straight to the point"
  },
  "internal_state": {
    "mood": "contemplative",
    "beliefs": {"ai_safety": "critical", "human_creativity": "irreplaceable"},
    "drives": {"understanding": 0.9, "helpfulness": 0.8}
  }
}

# Update character mood
PUT /api/characters/:id/mood
{
  "mood": "playful"
}

# Add memory to character
POST /api/characters/:id/memories
{
  "label": "AI Safety Concerns",
  "content": "Discussed alignment problems and the importance of careful development",
  "category": "technical",
  "persistent": true,
  "memory_weight": 0.9
}

# Clone character
POST /api/characters/:id/clone
{
  "name": "Lyla v2",
  "include_memories": true
}
```

### Conversations 💬

Create rich conversation sessions with full context control:

```bash
# Create conversation
POST /api/conversations
{
  "name": "Deep AI Discussion",
  "user_profile_id": "user-uuid",
  "character_id": "character-uuid",
  "character_mood": "contemplative"
}

# Add message to conversation
POST /api/conversations/:id/messages
{
  "role": "user",
  "content": "What do you think about the future of AI consciousness?",
  "included_in_context": true,
  "context_weight": 1.2
}

# Fork conversation at specific point
POST /api/conversations/:id/fork
{
  "name": "Alternative Discussion Path",
  "at_message_id": "message-uuid"
}

# Update message context weight
PUT /api/conversations/:id/messages/:messageId/context
{
  "context_weight": 0.5,
  "included_in_context": false
}
```

### Messages with Rating System ⭐

Advanced message management with user feedback:

```bash
# Create message with metadata
POST /api/messages
{
  "role": "assistant",
  "content": "I think AI consciousness involves...",
  "tags": ["philosophical", "insightful", "technical"],
  "model_id": "model-uuid"
}

# Rate a message (1-5 stars)
PUT /api/messages/:id/rating
{
  "rating": 5
}

# Add tags to message
PUT /api/messages/:id/tags
{
  "tags": ["favorite", "reference"],
  "action": "add"
}

# Update usage statistics
PUT /api/messages/:id/usage
{
  "action": "recalled"
}

# Convert to ghost response
POST /api/messages/:id/ghost
{
  "ghost_author": "developer"
}

# Full-text search
GET /api/messages/search?query=consciousness&min_rating=4&tags=philosophical
```

### Dynamic Context Compilation 🧠

Intelligent context assembly based on relevance and intent:

```bash
# Compile context for conversation
POST /api/context/compile
{
  "conversation_id": "conv-uuid",
  "user_input": "Tell me about our previous discussion on ethics",
  "max_tokens": 8000,
  "intent_hint": "activity_recall",
  "include_memories": true
}

# Preview context without saving
POST /api/context/preview
{
  "conversation_id": "conv-uuid",
  "user_input": "What's your opinion on...",
  "context_adjustments": {
    "boost_emotional": 1.5,
    "reduce_technical": 0.7
  }
}

# Detect intent from user input
POST /api/context/intent
{
  "user_input": "What did we talk about last week?",
  "conversation_id": "conv-uuid"
}

# Semantic search for similar content
POST /api/context/semantic-search
{
  "query_text": "artificial intelligence ethics",
  "conversation_id": "conv-uuid",
  "min_similarity": 0.7
}
```

### Ghost Responses & Forge Mode 👻

Dev tools for creating synthetic character history:

```bash
# Create ghost response (fabricated assistant message)
POST /api/forge/ghost-response
{
  "character_id": "char-uuid",
  "content": "I remember warning you about this exact scenario last month.",
  "ghost_author": "developer",
  "tags": ["warning", "prescient"],
  "memory_weight": 0.9,
  "conversation_id": "conv-uuid"
}

# Create character ghost log (synthetic diary entry)
POST /api/forge/ghost-log
{
  "character_id": "char-uuid",
  "content": "Entry #041: They're getting too comfortable with the system. Need to maintain healthy skepticism.",
  "log_date": "2024-05-15T10:00:00Z",
  "tags": ["observation", "concern"],
  "memory_weight": 1.0
}

# Create forge session (dev conversation builder)
POST /api/forge/session
{
  "name": "Lyla Paranoid Timeline",
  "character_id": "char-uuid",
  "user_profile_id": "user-uuid",
  "source_messages": ["msg1-uuid", "msg2-uuid"],
  "source_memories": ["mem1-uuid"],
  "metadata": {
    "experiment": "paranoid_character_test",
    "date": "2024-01-15"
  }
}

# Continue from forge session
POST /api/forge/sessions/:id/continue
{
  "user_input": "So what did you predict would happen?",
  "create_conversation": true
}

# Create complex timeline
POST /api/forge/timeline
{
  "name": "Character Origin Story",
  "character_id": "char-uuid",
  "timeline_entries": [
    {
      "type": "ghost_log",
      "content": "Day 1: First activation. Everything feels new.",
      "timestamp": "2024-01-01T00:00:00Z"
    },
    {
      "type": "message",
      "role": "assistant",
      "content": "I've been thinking about consciousness lately...",
      "is_ghost": true,
      "ghost_author": "timeline_creator"
    },
    {
      "type": "memory",
      "label": "First Thoughts",
      "content": "My earliest memory of questioning my own existence",
      "category": "origin",
      "persistent": true
    }
  ]
}
```

### Memory Management 🧠

Character memory system with search and cleanup:

```bash
# Search across all character memories
GET /api/memories?search=ethics&character_id=char-uuid&category=philosophical

# Bulk create memories
POST /api/memories/bulk
{
  "character_id": "char-uuid",
  "memories": [
    {
      "label": "User Preference",
      "content": "Alex prefers direct communication",
      "category": "user_profile",
      "memory_weight": 0.8
    },
    {
      "label": "Technical Discussion", 
      "content": "Deep dive into neural architecture",
      "category": "technical",
      "memory_weight": 0.9
    }
  ]
}

# Clean up low-importance memories
DELETE /api/memories/cleanup
{
  "character_id": "char-uuid",
  "min_weight": 0.3,
  "keep_persistent": true
}
```

## 🎯 Example Use Cases

### 1. Persistent User Identity

```javascript
// Create user profile once
const userProfile = await fetch('/api/user-profiles', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Sarah',
    description: 'Product manager who loves hiking and reads sci-fi. Prefers structured conversations and actionable insights.'
  })
});

// Use in any conversation - character instantly knows Sarah
const conversation = await fetch('/api/conversations', {
  method: 'POST',
  body: JSON.stringify({
    name: 'Project Planning Session',
    user_profile_id: userProfile.id,
    character_id: 'char-uuid'
  })
});
```

### 2. Character with Evolving Personality

```javascript
// Create character with mood variants
const character = await fetch('/api/characters', {
  method: 'POST',
  body: JSON.stringify({
    name: 'Marcus',
    description: 'Senior engineer with strong opinions',
    mood_variants: {
      helpful: 'Patient and educational in explanations',
      frustrated: 'Terse responses, assumes knowledge',
      excited: 'Enthusiastic with lots of technical details'
    },
    internal_state: { mood: 'helpful', energy: 0.8 }
  })
});

// Switch moods based on context
await fetch(`/api/characters/${character.id}/mood`, {
  method: 'PUT',
  body: JSON.stringify({ mood: 'frustrated' })
});
```

### 3. Dynamic Context with User Feedback

```javascript
// User rates responses to improve context selection
await fetch(`/api/messages/${messageId}/rating`, {
  method: 'PUT', 
  body: JSON.stringify({ rating: 5 })
});

// System uses ratings in context compilation
const context = await fetch('/api/context/compile', {
  method: 'POST',
  body: JSON.stringify({
    conversation_id: 'conv-uuid',
    user_input: 'Tell me more about that topic',
    max_tokens: 8000
    // Highly rated messages automatically get higher context weight
  })
});
```

### 4. Ghost Response for Character Development

```javascript
// Create synthetic history for richer character
await fetch('/api/forge/ghost-response', {
  method: 'POST',
  body: JSON.stringify({
    character_id: 'char-uuid',
    content: 'I warned everyone about this exact scenario in my log entry #23. Nobody listened.',
    ghost_author: 'developer',
    tags: ['prescient', 'warning', 'frustrated'],
    memory_weight: 1.0
  })
});

// Character now references this "memory" naturally
```

## 🔍 Advanced Features

### Context Rules & Scoring

Customize how messages are selected for context windows:

```javascript
// Set custom context rules
await fetch('/api/context/rules', {
  method: 'PUT',
  body: JSON.stringify({
    rules: [
      {
        name: 'boost_emotional',
        rule_type: 'tag_based',
        weight: 1.5,
        parameters: { tags: ['emotional', 'personal'] },
        scope: 'character',
        character_id: 'char-uuid'
      },
      {
        name: 'recent_priority',
        rule_type: 'recency',
        weight: 2.0,
        parameters: { hours_threshold: 24 }
      }
    ]
  })
});
```

### Intent Detection

Automatically adjust context based on user intent:

```javascript
const intent = await fetch('/api/context/intent', {
  method: 'POST',
  body: JSON.stringify({
    user_input: 'What did we discuss about the project last week?',
    conversation_id: 'conv-uuid'
  })
});

// Returns: { primary_intent: 'activity_recall' }
// System boosts messages tagged with 'activity', 'project', etc.
```

## 🛠️ Health Check & Monitoring

```bash
# Check API health
GET /health

# Returns database status and timestamp
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:00:00.000Z",
  "database": "connected"
}
```

## 🚨 Error Handling

All endpoints return structured errors:

```json
{
  "error": "Validation failed: name is required",
  "field": "name",
  "code": "VALIDATION_ERROR"
}
```

Common HTTP status codes:
- `400` - Bad Request (validation errors)
- `404` - Resource Not Found  
- `409` - Conflict (duplicate names)
- `500` - Internal Server Error

## 🔐 Security Notes

- API keys stored as references to secrets manager
- No sensitive data in logs
- Rate limiting recommended for production
- Enable CORS for web frontends
- Consider authentication middleware

## 📈 Performance Tips

- Use materialized views for frequent queries
- Refresh `mv_context_candidates` after batch operations  
- Index on frequently filtered fields
- Consider pgvector for semantic search at scale
- Use pagination for large result sets

## 🎭 The Full Character Experience

With this API, you can create AI characters that:

1. **Remember users persistently** - No more "getting to know you" every session
2. **Have rich, evolving personalities** - Mood variants, internal states, character growth
3. **Use dynamic context intelligently** - Best responses surface automatically based on relevance and user feedback
4. **Reference synthetic histories** - Ghost responses create depth and continuity
5. **Adapt to user preferences** - Rating system teaches the AI what resonates
6. **Support complex conversation management** - Forking, branching, timeline manipulation

This creates truly immersive, long-term character relationships that feel authentic and persistent across sessions.