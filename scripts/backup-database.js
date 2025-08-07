#!/usr/bin/env node
import { PrismaClient } from '../src/generated/prisma/index.js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

// Tables in dependency order (for proper restore)
const TABLE_ORDER = [
  'providers',
  'models',
  'inference_presets',
  'user_profiles',
  'characters',
  'character_memories',
  'prompt_wrappers',
  'response_tones',
  'response_settings',
  'conversations',
  'messages',
  'conversation_messages',
  'context_windows',
  'context_rules',
  'intent_patterns',
  'forge_sessions',
  'ghost_logs',
  'conversation_templates'
];

// Generate timestamp for backup file
function getTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
}

// Convert data to SQL INSERT statements
function generateInsertSQL(tableName, records) {
  if (!records.length) return '';
  
  const columns = Object.keys(records[0]);
  const columnList = columns.join(', ');
  
  const values = records.map(record => {
    const valueList = columns.map(col => {
      const val = record[col];
      if (val === null || val === undefined) return 'NULL';
      if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
      if (typeof val === 'boolean') return val.toString();
      if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
      if (Array.isArray(val)) return `ARRAY[${val.map(v => `'${String(v).replace(/'/g, "''")}'`).join(',')}]`;
      return String(val);
    }).join(', ');
    
    return `(${valueList})`;
  }).join(',\n  ');
  
  return `INSERT INTO ${tableName} (${columnList}) VALUES\n  ${values};\n\n`;
}

// Backup all data to SQL file
async function backupDatabase() {
  const timestamp = getTimestamp();
  const backupDir = 'backups';
  const backupFile = path.join(backupDir, `character-db-backup-${timestamp}.sql`);
  
  console.log(`📦 Creating database backup: ${backupFile}`);
  
  // Create backups directory
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  
  let sqlContent = '';
  
  // Header
  sqlContent += `-- Character Database Backup\n`;
  sqlContent += `-- Generated: ${new Date().toISOString()}\n`;
  sqlContent += `-- Tables: ${TABLE_ORDER.join(', ')}\n\n`;
  
  // Disable constraints temporarily
  sqlContent += `-- Disable constraints for faster restore\n`;
  sqlContent += `SET session_replication_role = replica;\n\n`;
  
  try {
    let totalRecords = 0;
    
    for (const tableName of TABLE_ORDER) {
      try {
        console.log(`   📋 Backing up table: ${tableName}`);
        
        // Get data using Prisma - using exact model names from schema.prisma
        let data = [];
        try {
          switch (tableName) {
            case 'providers':
              data = await prisma.providers.findMany();
              break;
            case 'models':
              data = await prisma.models.findMany();
              break;
            case 'inference_presets':
              data = await prisma.inference_presets.findMany();
              break;
            case 'user_profiles':
              data = await prisma.user_profiles.findMany();
              break;
            case 'characters':
              data = await prisma.characters.findMany();
              break;
            case 'character_memories':
              data = await prisma.character_memories.findMany();
              break;
            case 'prompt_wrappers':
              data = await prisma.prompt_wrappers.findMany();
              break;
            case 'response_tones':
              data = await prisma.response_tones.findMany();
              break;
            case 'response_settings':
              data = await prisma.response_settings.findMany();
              break;
            case 'conversations':
              data = await prisma.conversations.findMany();
              break;
            case 'messages':
              data = await prisma.messages.findMany();
              break;
            case 'conversation_messages':
              data = await prisma.conversation_messages.findMany();
              break;
            case 'context_windows':
              data = await prisma.context_windows.findMany();
              break;
            case 'context_rules':
              data = await prisma.context_rules.findMany();
              break;
            case 'intent_patterns':
              data = await prisma.intent_patterns.findMany();
              break;
            case 'forge_sessions':
              data = await prisma.forge_sessions.findMany();
              break;
            case 'ghost_logs':
              data = await prisma.ghost_logs.findMany();
              break;
            case 'conversation_templates':
              data = await prisma.conversation_templates.findMany();
              break;
            default:
              console.log(`   ⚠️  Unknown table: ${tableName}`);
          }
        } catch (modelError) {
          console.log(`   ❌ Prisma model error for ${tableName}: ${modelError.message}`);
          continue;
        }
        
        if (data.length > 0) {
          sqlContent += `-- Table: ${tableName} (${data.length} records)\n`;
          sqlContent += `TRUNCATE TABLE ${tableName} CASCADE;\n`;
          sqlContent += generateInsertSQL(tableName, data);
          totalRecords += data.length;
          console.log(`   ✅ ${data.length} records`);
        } else {
          sqlContent += `-- Table: ${tableName} (empty)\n\n`;
          console.log(`   ⚪ 0 records`);
        }
        
      } catch (error) {
        console.log(`   ❌ Error backing up ${tableName}: ${error.message}`);
        sqlContent += `-- ERROR backing up ${tableName}: ${error.message}\n\n`;
      }
    }
    
    // Re-enable constraints
    sqlContent += `-- Re-enable constraints\n`;
    sqlContent += `SET session_replication_role = DEFAULT;\n\n`;
    
    // Refresh materialized view
    sqlContent += `-- Refresh materialized view\n`;
    sqlContent += `REFRESH MATERIALIZED VIEW mv_context_candidates;\n\n`;
    
    // Footer with stats
    sqlContent += `-- Backup completed: ${totalRecords} total records\n`;
    sqlContent += `-- Generated: ${new Date().toISOString()}\n`;
    
    // Write to file
    fs.writeFileSync(backupFile, sqlContent, 'utf8');
    
    console.log(`\n🎉 Backup completed successfully!`);
    console.log(`   📄 File: ${backupFile}`);
    console.log(`   📊 Total records: ${totalRecords}`);
    console.log(`   💾 Size: ${(fs.statSync(backupFile).size / 1024).toFixed(1)} KB`);
    
    return backupFile;
    
  } catch (error) {
    console.error('❌ Backup failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Restore database from backup file
async function restoreDatabase(backupFile) {
  if (!fs.existsSync(backupFile)) {
    throw new Error(`Backup file not found: ${backupFile}`);
  }
  
  console.log(`🔄 Restoring database from: ${backupFile}`);
  
  const sqlContent = fs.readFileSync(backupFile, 'utf8');
  
  try {
    // Execute the SQL file using raw query
    await prisma.$executeRawUnsafe(sqlContent);
    
    console.log('✅ Database restored successfully!');
    
  } catch (error) {
    console.error('❌ Restore failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// List available backups
function listBackups() {
  const backupDir = 'backups';
  
  if (!fs.existsSync(backupDir)) {
    console.log('📁 No backups directory found');
    return [];
  }
  
  const files = fs.readdirSync(backupDir)
    .filter(file => file.endsWith('.sql') && file.startsWith('character-db-backup-'))
    .map(file => {
      const filePath = path.join(backupDir, file);
      const stats = fs.statSync(filePath);
      return {
        file: file,
        path: filePath,
        size: stats.size,
        created: stats.birthtime,
        sizeKB: (stats.size / 1024).toFixed(1)
      };
    })
    .sort((a, b) => b.created - a.created);
  
  console.log(`📋 Available backups (${files.length}):`);
  files.forEach(backup => {
    console.log(`   📄 ${backup.file} (${backup.sizeKB} KB) - ${backup.created.toISOString()}`);
  });
  
  return files;
}

// Create a lightweight JSON backup (smaller, human-readable)
async function backupDatabaseJSON() {
  const timestamp = getTimestamp();
  const backupDir = 'backups';
  const backupFile = path.join(backupDir, `character-db-backup-${timestamp}.json`);
  
  console.log(`📦 Creating JSON database backup: ${backupFile}`);
  
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  
  const backup = {
    metadata: {
      created: new Date().toISOString(),
      version: '1.0.0',
      tables: TABLE_ORDER.length
    },
    data: {}
  };
  
  try {
    let totalRecords = 0;
    
    for (const tableName of TABLE_ORDER) {
      console.log(`   📋 Backing up table: ${tableName}`);
      
      let data = [];
      try {
        switch (tableName) {
          case 'providers':
            data = await prisma.providers.findMany();
            break;
          case 'models':
            data = await prisma.models.findMany();
            break;
          case 'inference_presets':
            data = await prisma.inference_presets.findMany();
            break;
          case 'user_profiles':
            data = await prisma.user_profiles.findMany();
            break;
          case 'characters':
            data = await prisma.characters.findMany();
            break;
          case 'character_memories':
            data = await prisma.character_memories.findMany();
            break;
          case 'prompt_wrappers':
            data = await prisma.prompt_wrappers.findMany();
            break;
          case 'response_tones':
            data = await prisma.response_tones.findMany();
            break;
          case 'response_settings':
            data = await prisma.response_settings.findMany();
            break;
          case 'conversations':
            data = await prisma.conversations.findMany();
            break;
          case 'messages':
            data = await prisma.messages.findMany();
            break;
          case 'conversation_messages':
            data = await prisma.conversation_messages.findMany();
            break;
          case 'context_windows':
            data = await prisma.context_windows.findMany();
            break;
          case 'context_rules':
            data = await prisma.context_rules.findMany();
            break;
          case 'intent_patterns':
            data = await prisma.intent_patterns.findMany();
            break;
          case 'forge_sessions':
            data = await prisma.forge_sessions.findMany();
            break;
          case 'ghost_logs':
            data = await prisma.ghost_logs.findMany();
            break;
          case 'conversation_templates':
            data = await prisma.conversation_templates.findMany();
            break;
          default:
            console.log(`   ⚠️  Unknown table: ${tableName}`);
        }
      } catch (modelError) {
        console.log(`   ❌ Prisma model error for ${tableName}: ${modelError.message}`);
        continue;
      }
      backup.data[tableName] = data;
      totalRecords += data.length;
      
      console.log(`   ✅ ${data.length} records`);
    }
    
    backup.metadata.totalRecords = totalRecords;
    
    fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2), 'utf8');
    
    console.log(`\n🎉 JSON backup completed successfully!`);
    console.log(`   📄 File: ${backupFile}`);
    console.log(`   📊 Total records: ${totalRecords}`);
    console.log(`   💾 Size: ${(fs.statSync(backupFile).size / 1024).toFixed(1)} KB`);
    
    return backupFile;
    
  } catch (error) {
    console.error('❌ JSON backup failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Handle command line execution
async function main() {
  const command = process.argv[2];
  const arg = process.argv[3];
  
  switch (command) {
    case 'backup':
    case 'sql':
      await backupDatabase();
      break;
      
    case 'json':
      await backupDatabaseJSON();
      break;
      
    case 'restore':
      if (!arg) {
        console.log('❌ Please provide backup file path');
        process.exit(1);
      }
      await restoreDatabase(arg);
      break;
      
    case 'list':
      listBackups();
      break;
      
    default:
      console.log(`
📦 Database Backup & Restore Tool

Usage:
  node scripts/backup-database.js backup   # Create SQL backup
  node scripts/backup-database.js json     # Create JSON backup  
  node scripts/backup-database.js restore <file> # Restore from backup
  node scripts/backup-database.js list     # List available backups

Examples:
  npm run db:backup
  npm run db:restore backups/character-db-backup-2024-01-15T10-30-00.sql
  npm run db:list
`);
      break;
  }
}

if (process.argv[1].endsWith('backup-database.js')) {
  main().catch(console.error);
}

export { backupDatabase, restoreDatabase, listBackups, backupDatabaseJSON };