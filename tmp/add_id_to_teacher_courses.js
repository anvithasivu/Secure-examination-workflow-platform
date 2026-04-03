const { Client } = require('pg');

async function patch() {
    const pgClient = new Client({
        connectionString: "postgresql://anvitha:mxS8KEtLqG8uBLIWPM39nQDS3r6OMbd5@dpg-d77m2hp5pdvs739cctd0-a.oregon-postgres.render.com/secureexaminationworkflow",
        ssl: { rejectUnauthorized: false }
    });

    try {
        await pgClient.connect();
        console.log("Connected for patching teacher_courses.");

        // First, check if 'id' exists
        const res = await pgClient.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'teacher_courses' AND column_name = 'id'
        `);

        if (res.rowCount === 0) {
            console.log("Adding 'id' SERIAL PRIMARY KEY to teacher_courses.");
            // 1. Remove composite primary key constraint if it exists
            // Usually, Postgres creates an implicit constraint name for PRIMARY KEY
            await pgClient.query(`ALTER TABLE teacher_courses DROP CONSTRAINT IF EXISTS teacher_courses_pkey`);

            // 2. Add id SERIAL column
            await pgClient.query(`ALTER TABLE teacher_courses ADD COLUMN id SERIAL PRIMARY KEY`);
            console.log("Successfully added 'id' column.");
        } else {
            console.log("Column 'id' already exists in teacher_courses.");
        }

    } catch (err) {
        console.error("Patching failed:", err.message);
    } finally {
        await pgClient.end();
    }
}

patch();
