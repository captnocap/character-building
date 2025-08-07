#!/bin/bash

set -e  # Exit on any error

echo "🗄️ Setting up database schema..."

# Check if .env exists and load database credentials
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
    echo "📝 Loaded database credentials from .env"
else
    echo "⚠️  .env file not found. Using defaults..."
    export DB_HOST=localhost
    export DB_PORT=5432
    export DB_NAME=character_db
    export DB_USER=character_user
    export DB_PASSWORD=character_pass
fi

echo "🔗 Connecting to database: $DB_NAME on $DB_HOST:$DB_PORT as $DB_USER"

# Test connection first
echo "🔍 Testing database connection..."
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT version();" > /dev/null

if [ $? -eq 0 ]; then
    echo "✅ Database connection successful!"
else
    echo "❌ Cannot connect to database. Please check your credentials and ensure PostgreSQL is running."
    echo "   Run ./setup-db.sh first if you haven't already."
    exit 1
fi

# Run the schema
echo "📋 Executing schema.sql..."
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f schema.sql

if [ $? -eq 0 ]; then
    echo ""
    echo "🎉 Database setup complete!"
    echo ""
    echo "📊 Schema Summary:"
    PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "
        SELECT 
            schemaname,
            COUNT(*) as table_count
        FROM pg_tables 
        WHERE schemaname = 'public' 
        GROUP BY schemaname;
        
        SELECT 'Extensions installed:' as info;
        SELECT extname FROM pg_extension WHERE extname IN ('uuid-ossp', 'pgcrypto', 'pg_trgm', 'vector');
    "
    echo ""
    echo "🚀 Ready to start the API!"
    echo "   Run: npm start"
else
    echo "❌ Schema creation failed. Check the error messages above."
    exit 1
fi