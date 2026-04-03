const { Client } = require('pg');

async function patch() {
    const pgClient = new Client({
        connectionString: "postgresql://anvitha:mxS8KEtLqG8uBLIWPM39nQDS3r6OMbd5@dpg-d77m2hp5pdvs739cctd0-a.oregon-postgres.render.com/secureexaminationworkflow",
        ssl: { rejectUnauthorized: false }
    });

    try {
        await pgClient.connect();
        console.log("Connected to PostgreSQL for patching.");

        // Add created_at column if not exists
        await pgClient.query(`
            ALTER TABLE password_reset_requests 
            ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        `);
        console.log("Column 'created_at' verified/added.");

        // Set null values to current time
        await pgClient.query(`
            UPDATE password_reset_requests 
            SET created_at = CURRENT_TIMESTAMP 
            WHERE created_at IS NULL
        `);
        console.log("Null created_at values patched.");

    } catch (err) {
        console.error("Patching failed:", err.message);
    } finally {
        await pgClient.end();
    }
}

patch();
