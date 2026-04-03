const { Client } = require('pg');

async function fix() {
    const pgClient = new Client({
        connectionString: "postgresql://anvitha:mxS8KEtLqG8uBLIWPM39nQDS3r6OMbd5@dpg-d77m2hp5pdvs739cctd0-a.oregon-postgres.render.com/secureexaminationworkflow",
        ssl: { rejectUnauthorized: false }
    });

    try {
        await pgClient.connect();
        
        // Convert to timestamp
        await pgClient.query(`
            ALTER TABLE password_reset_requests 
            ALTER COLUMN created_at TYPE TIMESTAMP 
            USING created_at::TIMESTAMP
        `);
        
        // Ensure default is set
        await pgClient.query(`
            ALTER TABLE password_reset_requests 
            ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP
        `);
        
        console.log("Column 'created_at' converted to TIMESTAMP with DEFAULT CURRENT_TIMESTAMP.");

    } catch (err) {
        console.error("Fix failed:", err.message);
    } finally {
        await pgClient.end();
    }
}

fix();
