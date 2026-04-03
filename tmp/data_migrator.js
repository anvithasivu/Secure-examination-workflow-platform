const mysql = require('mysql2/promise');
const { Client } = require('pg');
const fs = require('fs');

async function migrate() {
    let logOutput = "";
    const log = (msg) => {
        console.log(msg);
        logOutput += msg + "\n";
    };

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
    log("Connected to both databases!");

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
            log(`Migrating table: ${table}...`);
            const [rows] = await myClient.query(`SELECT * FROM ${table}`);
            if (rows.length === 0) {
                log(`No records found in ${table}. Skipping.`);
                continue;
            }

            const columns = Object.keys(rows[0]);
            
            // For conflict, specify ID if table has ID because DO NOTHING requires conflict target sometimes for table structures like postgres
            let conflictClause = "ON CONFLICT DO NOTHING";
            if (columns.includes('id')) {
                conflictClause = "ON CONFLICT (id) DO NOTHING";
            }
            if (table === 'teacher_courses') {
                conflictClause = "ON CONFLICT (teacher_id, course_id) DO NOTHING";
            }

            const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
            const query = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders}) ${conflictClause}`;

            let count = 0;
            for (const row of rows) {
                const values = columns.map(col => row[col]);
                try {
                    await pgClient.query(query, values);
                    count++;
                } catch (err) {
                    log(`ERROR inserting into ${table}: ${err.message}`);
                    log(`Query: ${query}`);
                    log(`Values: ${JSON.stringify(values)}`);
                }
            }
            log(`Inserted ${count} rows into ${table}.`);

            // Check if table has 'id' sequence to reset
            try {
                if (columns.includes('id')) {
                    const seqResult = await pgClient.query(`SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE((SELECT MAX(id) FROM ${table}), 1), true)`);
                    log(`Reset primary key sequence for ${table}.`);
                }
            } catch (seqErr) {
                log(`Warning: Could not reset sequence for ${table} (${seqErr.message}).`);
            }
        }
        log("Migration completed successfully!");
    } catch (e) {
        log("Migration exception: " + e.message);
    } finally {
        await pgClient.end();
        await myClient.end();
        fs.writeFileSync('c:/Users/anvit/OneDrive/Desktop/secure exam platform/tmp/migration_final_log.txt', logOutput);
    }
}

migrate();
