const fs = require('fs');
const { Client } = require('pg');

const client = new Client({
  connectionString: "postgresql://anvitha:mxS8KEtLqG8uBLIWPM39nQDS3r6OMbd5@dpg-d77m2hp5pdvs739cctd0-a.oregon-postgres.render.com/secureexaminationworkflow",
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    await client.connect();
    const sql = fs.readFileSync('c:/Users/anvit/OneDrive/Desktop/secure exam platform/init_postgres.sql', 'utf8');
    await client.query(sql);
    console.log("Database schema applied successfully to your Render PostgreSQL instance.");
  } catch(err) {
    console.error("Error setting up database:", err);
  } finally {
    await client.end();
  }
}

run();
