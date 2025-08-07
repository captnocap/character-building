#!/bin/bash

# Database Management Script for Character API
# Combines common database operations into one easy script

set -e

echo "🗄️ Character API Database Manager"
echo "=================================="

case "$1" in
    "setup")
        echo "🚀 Setting up database from scratch..."
        ./setup-db.sh
        ./setup-schema.sh
        npm run db:generate
        echo "✅ Database setup complete!"
        ;;
    
    "backup")
        echo "📦 Creating database backup..."
        npm run db:backup
        ;;
        
    "backup-json")
        echo "📦 Creating JSON database backup..."
        npm run db:backup:json
        ;;
    
    "restore")
        if [ -z "$2" ]; then
            echo "📋 Available backups:"
            npm run db:list
            echo ""
            echo "Usage: $0 restore <backup-file>"
            echo "Example: $0 restore backups/character-db-backup-2024-01-15T10-30-00.sql"
            exit 1
        fi
        echo "🔄 Restoring database from $2..."
        npm run db:restore "$2"
        echo "✅ Database restored!"
        ;;
    
    "list")
        echo "📋 Available database backups:"
        npm run db:list
        ;;
    
    "populate")
        echo "🤖 Populating models from provider endpoints..."
        npm run models:populate
        ;;
    
    "studio")
        echo "🎨 Starting Prisma Studio..."
        npm run studio
        ;;
    
    "reset")
        echo "⚠️  WARNING: This will reset the database and lose all data!"
        read -p "Are you sure? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            echo "💥 Resetting database..."
            npm run db:reset
            echo "✅ Database reset complete!"
        else
            echo "❌ Reset cancelled"
        fi
        ;;
    
    "status")
        echo "📊 Database Status:"
        echo "==================="
        
        # Check PostgreSQL container
        if docker ps | grep -q character-postgres; then
            echo "✅ PostgreSQL container: Running"
        else
            echo "❌ PostgreSQL container: Stopped"
        fi
        
        # Test connection
        if PGPASSWORD=character_pass psql -h localhost -p 5432 -U character_user -d character_db -c "SELECT 1;" > /dev/null 2>&1; then
            echo "✅ Database connection: OK"
            
            # Get table counts
            echo ""
            echo "📋 Table Statistics:"
            PGPASSWORD=character_pass psql -h localhost -p 5432 -U character_user -d character_db -c "
                SELECT 
                    schemaname,
                    tablename,
                    n_tup_ins as inserts,
                    n_tup_upd as updates,
                    n_tup_del as deletes,
                    n_live_tup as live_rows
                FROM pg_stat_user_tables 
                WHERE schemaname = 'public' 
                ORDER BY n_live_tup DESC;
            "
        else
            echo "❌ Database connection: Failed"
        fi
        ;;
    
    "logs")
        echo "📜 PostgreSQL Logs:"
        docker logs character-postgres --tail=50 -f
        ;;
    
    "clean")
        echo "🧹 Cleaning up old backups (keeping last 10)..."
        cd backups 2>/dev/null || { echo "No backups directory found"; exit 0; }
        ls -t character-db-backup-*.sql character-db-backup-*.json 2>/dev/null | tail -n +11 | xargs rm -f
        echo "✅ Cleanup complete!"
        ;;
    
    *)
        echo "Usage: $0 {command}"
        echo ""
        echo "Commands:"
        echo "  setup        - Set up database from scratch (PostgreSQL + schema)"
        echo "  backup       - Create SQL backup of all data"
        echo "  backup-json  - Create JSON backup of all data"
        echo "  restore      - Restore from backup file"
        echo "  list         - List available backups"
        echo "  populate     - Populate models from provider APIs"
        echo "  studio       - Open Prisma Studio"
        echo "  reset        - Reset database (WARNING: loses all data)"
        echo "  status       - Show database status and statistics"
        echo "  logs         - Show PostgreSQL logs"
        echo "  clean        - Clean up old backup files"
        echo ""
        echo "Examples:"
        echo "  $0 setup                    # Initial setup"
        echo "  $0 backup                   # Create backup"
        echo "  $0 restore backups/file.sql # Restore backup"
        echo "  $0 populate                 # Fetch models from APIs"
        echo "  $0 status                   # Check database health"
        echo ""
        exit 1
        ;;
esac