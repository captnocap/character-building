# Character Builder: AI Character & Conversation Management System

[![Node.js](https://img.shields.io/badge/Node.js-v20-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-v18-blue.svg)](https://reactjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-v15-lightblue.svg)](https://www.postgresql.org/)
[![Prisma](https://img.shields.io/badge/Prisma-v5-orange.svg)](https://www.prisma.io/)

Character Builder is a full-stack application for creating, managing, and interacting with AI characters and conversations. It features a robust backend API for data management and a React-based frontend dashboard for intuitive user interaction. The system supports persistent user profiles, dynamic character personas, conversation forking, ghost responses, and advanced context compilation for building immersive AI experiences.

## 🚀 Features

### Core Capabilities
- **User Profiles**: Create and manage persistent identities that AI characters remember across sessions.
- **Character Management**: Define complex AI personas with mood variants, internal states, and persistent memories.
- **Conversation System**: Handle dynamic conversations with forking, branching, and synthetic history.
- **Model & Provider Integration**: Manage AI providers (OpenAI, Anthropic, local models) and their models with custom overrides.
- **Dynamic Context**: Intelligent context window compilation with rules, scoring, and intent detection.
- **Forge Mode**: Developer tools for creating synthetic timelines, ghost responses, and character logs.
- **Memory System**: Categorized, weighted memories with full-text search.
- **Presets & Templates**: Manage inference presets, prompt wrappers, response tones, and conversation templates.
- **Full-Text Search**: Search across messages, memories, profiles, and more.

### Frontend Dashboard
- Interactive sections for managing providers, models, characters, profiles, presets, templates, rules, forge mode, and conversations.
- Real-time previews of context compilation and token usage.
- Search, filtering, and favorite toggling for models.
- Tabbed editors for character profiles, moods, and internal states.
- Global state management with React Context for selections and UI state.

### Backend API
- RESTful endpoints for all resources with validation using Joi.
- Health checks, error handling, and logging.
- Database backups, restores, and model population scripts.

## 🏗️ Architecture

- **Frontend**: React with TypeScript, React Router for navigation, Tailwind CSS for styling, and React Context for state management.
  - Main components: Layout with left navigation, main content sections, and right inspector panel.
  - Sections include Providers, Models, Characters, Profiles, Presets, Templates, Rules, Forge, and Conversation.
- **Backend**: Node.js with Express.js, Prisma ORM for database interactions.
  - Routes for all resources (e.g., /api/providers, /api/models, /api/characters, etc.).
  - Uses PostgreSQL with full-text search, JSONB fields, and constraints.
- **Database**: PostgreSQL managed via Prisma, with schema including tables for providers, models, characters, conversations, messages, memories, etc.
- **Deployment**: Backend runs on port 3000, frontend on port 3001 (proxied to backend).

## 🔧 Setup

### Prerequisites
- Node.js >= 20
- PostgreSQL >= 15 (or use Docker for setup)
- npm for package management

### 1. Clone the Repository
```bash
git clone https://github.com/captnocap/character-building
cd character-building
```

### 2. Database Setup
Follow the instructions in [DATABASE_SETUP.md](/DATABASE_SETUP.md) for detailed setup.

- Create `.env` from `.env.example` and update database credentials.
- Run setup scripts:
  ```bash
  ./setup-db.sh  # Sets up PostgreSQL in Docker if needed
  ./setup-schema.sh  # Applies schema
  npm run db:generate  # Generate Prisma client
  ```
- Populate initial data:
  ```bash
  npm run models:populate  # Requires API keys in .env
  ```

### 3. Backend Installation
```bash
npm install
```

### 4. Frontend Installation
```bash
cd frontend
npm install
cd ..
```

### 5. Environment Configuration
Update `.env` with:
- Database URL
- API keys for providers (OPENAI_API_KEY, ANTHROPIC_API_KEY, etc.)
- Ports if needed (default: backend 3000, frontend 3001)

## 🏃 Running the Application

### Development Mode
- Backend:
  ```bash
  npm run dev  # Starts with nodemon for auto-reload
  ```
- Frontend (in separate terminal):
  ```bash
  cd frontend
  npm start
  ```
- Access the dashboard at `http://localhost:3001`
- API at `http://localhost:3000/api`
- Prisma Studio: `npm run studio` (opens at http://localhost:5555)

### Production Mode
- Backend: `npm start`
- Frontend: `cd frontend && npm run build` (serve the build folder)

Use the `start.sh` script for backend startup checks.

## 📋 Usage

### Dashboard Interface
- **Navigation**: Use the left sidebar to switch between sections.
- **Selection**: Click items in lists to edit in the right panel.
- **Creating Items**: Use "New" buttons in sections like Characters, Profiles.
- **Favorites**: Toggle stars on models for quick filtering.
- **Search & Filters**: Available in most sections for quick navigation.
- **Conversation Mode**: Select components and start chatting with AI characters.

### API Usage
The backend provides a comprehensive REST API. See the [API Endpoints](#core-api-endpoints) section below for details.

Example: Create a character
```bash
curl -X POST http://localhost:3000/api/characters \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Lyla",
    "description": "A contemplative AI researcher",
    "format_type": "markdown"
  }'
```

### Database Management
- Backups: `npm run db:backup`
- Restore: `npm run db:restore <backup-file>`
- Studio: `npm run studio`
- Reset: `npm run db:reset` (caution: destructive)

## Core API Endpoints

### Providers
- `GET /api/providers`: List all providers
- `GET /api/providers/:id`: Get provider details
- `POST /api/providers`: Create new provider
- `PUT /api/providers/:id`: Update provider
- `DELETE /api/providers/:id`: Delete provider

### Models
- `GET /api/models`: List all models
- `GET /api/models/:id`: Get model details
- `PUT /api/models/:id`: Update model (e.g., context override)
- `POST /api/models/:id/favorite`: Toggle favorite
- `POST /api/models/populate`: Populate from providers

### Characters
- `GET /api/characters`: List all characters
- `GET /api/characters/:id`: Get character details
- `POST /api/characters`: Create new character
- `PUT /api/characters/:id`: Update character
- `DELETE /api/characters/:id`: Delete character
- `POST /api/characters/:id/memories`: Add memory
- `PUT /api/characters/:id/mood`: Update mood

### User Profiles
- `GET /api/user-profiles`: List all profiles
- `GET /api/user-profiles/:id`: Get profile details
- `POST /api/user-profiles`: Create new profile
- `PUT /api/user-profiles/:id`: Update profile
- `DELETE /api/user-profiles/:id`: Delete profile
- `POST /api/user-profiles/:id/clone`: Clone profile

### Conversations
- `GET /api/conversations`: List all conversations
- `GET /api/conversations/:id`: Get conversation details
- `POST /api/conversations`: Create new conversation
- `PUT /api/conversations/:id`: Update conversation
- `DELETE /api/conversations/:id`: Delete conversation
- `POST /api/conversations/:id/messages`: Add message
- `POST /api/conversations/:id/fork`: Fork conversation

### Additional Endpoints
- Context: `/api/context/compile`, `/api/context/preview`, `/api/context/intent`
- Forge: `/api/forge/ghost-response`, `/api/forge/ghost-log`, `/api/forge/session`
- Memories: `/api/memories`, `/api/memories/bulk`, `/api/memories/cleanup`
- Rules: `/api/rules` (context rules management)
- Health: `GET /health`

For full API documentation, refer to the route files in `src/routes/` or use tools like Postman to explore.

## 🛠️ Development

- **Backend**: Add routes in `src/routes/`, validators in `validators/`.
- **Frontend**: Add sections in `frontend/src/sections/`, components in `components/`.
- **Database**: Update `prisma/schema.prisma` and run `npm run db:generate`.
- **Scripts**: Use `scripts/` for utilities like backups and model population.

### Contributing
1. Fork the repository
2. Create a feature branch
3. Commit changes
4. Push to branch
5. Open a Pull Request

## 🔐 Security
- API keys are referenced (not stored directly)
- Use HTTPS in production
- Add authentication for production use
- Validate all inputs with Joi

## 📈 Performance
- Use indexes for frequent queries
- Paginate large lists
- Cache frequent API calls if needed

## 🆘 Troubleshooting
- Check logs in `logs/` directory
- Verify database connection with `npm run studio`
- For frontend issues, check browser console
- Reset database with `npm run db:reset` (data loss warning)

## 📝 License
This project is licensed under the MIT License - see the [LICENSE](/LICENSE) file for details (assuming MIT; adjust as needed).

---

This README was generated based on a deep analysis of the codebase, including file structures, package configurations, database schema, API routes, and frontend components. For any updates or contributions, please refer to the source code.