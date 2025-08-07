# PostgreSQL Installation Guide

Since the automated script requires sudo access, here are the manual steps to install PostgreSQL:

## Option 1: Using Package Manager (Recommended)

```bash
# Update package list
sudo apt update

# Install PostgreSQL and contrib packages
sudo apt install -y postgresql postgresql-contrib postgresql-server-dev-all

# Start and enable PostgreSQL service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Install pgvector for semantic search (optional)
cd /tmp
git clone --branch v0.5.1 https://github.com/pgvector/pgvector.git
cd pgvector
sudo make install
```

## Option 2: Using Docker (Alternative)

```bash
# Run PostgreSQL in Docker
docker run --name character-postgres \
  -e POSTGRES_USER=character_user \
  -e POSTGRES_PASSWORD=character_pass \
  -e POSTGRES_DB=character_db \
  -p 5432:5432 \
  -d postgres:15-alpine

# Install pgvector in Docker (optional)
docker exec -it character-postgres sh -c "
  apk add --no-cache git build-base postgresql-dev && \
  cd /tmp && \
  git clone https://github.com/pgvector/pgvector.git && \
  cd pgvector && \
  make && make install
"
```

## Create Database and User (Manual Setup)

If PostgreSQL is already installed, create the database:

```bash
# Switch to postgres user and create database
sudo -u postgres psql << EOF
CREATE USER character_user WITH PASSWORD 'character_pass';
CREATE DATABASE character_db OWNER character_user;
GRANT ALL PRIVILEGES ON DATABASE character_db TO character_user;
ALTER USER character_user CREATEDB;
\q
EOF
```

## Next Steps

Once PostgreSQL is running:

1. **Update your .env file** (already done):
   ```
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=character_db
   DB_USER=character_user
   DB_PASSWORD=character_pass
   ```

2. **Run the schema setup**:
   ```bash
   ./setup-schema.sh
   ```

3. **Start the API**:
   ```bash
   npm start
   ```

## Troubleshooting

### Check if PostgreSQL is running:
```bash
sudo systemctl status postgresql
# or for Docker:
docker ps | grep character-postgres
```

### Test connection:
```bash
psql -h localhost -p 5432 -U character_user -d character_db
```

### View logs:
```bash
sudo journalctl -u postgresql -f
# or for Docker:
docker logs character-postgres
```