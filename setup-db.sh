#!/bin/bash

set -e  # Exit on any error

echo "🐘 Setting up PostgreSQL for Character API..."

# Update package list
echo "📦 Updating package list..."
sudo apt update

# Install PostgreSQL and extensions
echo "🔧 Installing PostgreSQL and required extensions..."
sudo apt install -y postgresql postgresql-contrib postgresql-server-dev-all

# Install pgvector extension (for semantic search)
echo "🧠 Installing pgvector extension..."
cd /tmp
git clone --branch v0.5.1 https://github.com/pgvector/pgvector.git || echo "Already cloned"
cd pgvector
sudo make install || echo "pgvector already installed"

# Start PostgreSQL service
echo "🚀 Starting PostgreSQL service..."
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database and user
echo "🗄️ Creating database and user..."
sudo -u postgres psql << EOF
CREATE USER character_user WITH PASSWORD 'character_pass';
CREATE DATABASE character_db OWNER character_user;
GRANT ALL PRIVILEGES ON DATABASE character_db TO character_user;
ALTER USER character_user CREATEDB;
\q
EOF

echo "✅ PostgreSQL setup complete!"
echo ""
echo "📋 Database Details:"
echo "   Host: localhost"
echo "   Port: 5432" 
echo "   Database: character_db"
echo "   User: character_user"
echo "   Password: character_pass"
echo ""
echo "🔧 Next steps:"
echo "   1. Update your .env file with these credentials"
echo "   2. Run the schema setup: ./setup-schema.sh"