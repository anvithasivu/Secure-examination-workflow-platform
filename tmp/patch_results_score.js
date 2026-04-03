const { Client } = require('pg');

async function patch() {
    const pgClient = new Client({
        connectionString: "postgresql://anvitha:mxS8KEtLqG8uBLIWPM39nQDS3r6OMbd5@dpg-d77m2hp5pdvs739cctd0-a.oregon-postgres.render.com/secureexaminationworkflow",
        ssl: { rejectUnauthorized: false }
    });

    try {
        await pgClient.connect();
        console.log("Connected for score column patch.");

        // Alter type to NUMERIC
        await pgClient.query(`ALTER TABLE results ALTER COLUMN score TYPE NUMERIC USING score::NUMERIC`);
        console.log("Successfully changed 'score' column to NUMERIC.");

    } catch (err) {
        console.error("Patching failed:", err.message);
    } finally {
        await pgClient.end();
    }
}

patch();
