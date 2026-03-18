const fs = require('fs');
const path = require('path');
const db = require('./connection');

async function migrate() {
  try {
    console.log('Running database migrations...');
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    await db.query(schemaSql);

    const migrationsDir = path.join(__dirname, 'migrations');
    if (fs.existsSync(migrationsDir)) {
      const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
      for (const file of files) {
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
        await db.query(sql);
        console.log('  Ran', file);
      }
    }
    console.log('Database migrations completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Error running migrations:', err);
    process.exit(1);
  }
}

migrate();
