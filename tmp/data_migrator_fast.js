const mysql = require('mysql2/promise');
const { Client } = require('pg');

async function migrate() {
    const pgClient = new Client({
        connectionString: "postgresql://anvitha:mxS8KEtLqG8uBLIWPM39nQDS3r6OMbd5@dpg-d77m2hp5pdvs739cctd0-a.oregon-postgres.render.com/secureexaminationworkflow",
        ssl: { rejectUnauthorized: false }
    });

    const myClient = await mysql.createConnection({
        host: "localhost",
        user: "root",
        password: "anvisivu07",
        database: "secure_exam"
    });

    await pgClient.connect();
    console.log("Connected to both databases!");

    const tables = [
        'users',
        'courses',
        'course_levels',
        'teacher_courses',
        'questions',
        'results',
        'password_reset_requests'
    ];

    try {
        for (const table of tables) {
            const [rows] = await myClient.query(`SELECT * FROM ${table}`);
            if (rows.length === 0) {
                console.log(`No records found in ${table}. Skipping.`);
                continue;
            }

            console.log(`Migrating ${rows.length} rows for table: ${table}...`);
            const columns = Object.keys(rows[0]);
            
            let conflictClause = "ON CONFLICT DO NOTHING";
            if (columns.includes('id')) conflictClause = "ON CONFLICT (id) DO NOTHING";
            if (table === 'teacher_courses') conflictClause = "ON CONFLICT (teacher_id, course_id) DO NOTHING";

            // Bulk Insert batches
            const batchSize = 100;
            for (let i = 0; i < rows.length; i += batchSize) {
                const batch = rows.slice(i, i + batchSize);
                
                let valueStrings = [];
                let flatValues = [];
                let paramIndex = 1;
                
                for (const row of batch) {
                    const rowPlaceholders = columns.map(() => `$${paramIndex++}`).join(', ');
                    valueStrings.push(`(${rowPlaceholders})`);
                    flatValues.push(...columns.map(col => row[col]));
                }
                
                const query = `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${valueStrings.join(', ')} ${conflictClause}`;
                try {
                    await pgClient.query(query, flatValues);
                } catch(err) {
                    console.log(`Batch error in ${table}: ` + err.message);
                }
            }
            
            console.log(`Migrated ${table} successfully.`);

            // Reset Sequence
            try {
                if (columns.includes('id')) {
                    await pgClient.query(`SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE((SELECT MAX(id) FROM ${table}), 1), true)`);
                    console.log(`Reset sequence for ${table}.`);
                }
            } catch (seqErr) {
                console.log(`Warning: Couldn't reset sequence for ${table}: ` + seqErr.message);
            }
        }
        console.log("Entire Database Migration Completed!");
    } catch (e) {
        console.log("Migration Error: " + e.message);
    } finally {
        await pgClient.end();
        await myClient.end();
    }
}

migrate();
