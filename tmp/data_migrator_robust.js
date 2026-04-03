const mysql = require('mysql2/promise');
const { Client } = require('pg');
const fs = require('fs');

async function migrate() {
    let logOutput = "";
    const log = (msg) => { logOutput += msg + "\n"; console.log(msg); };

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
        // First truncate all tables starting from the dependent ones
        for (const table of [...tables].reverse()) {
            await pgClient.query(`TRUNCATE TABLE ${table} CASCADE`);
            log(`Truncated ${table} CASCADE`);
        }

        for (const table of tables) {
            const [rows] = await myClient.query(`SELECT * FROM ${table}`);
            if (rows.length === 0) {
                log(`No records found in ${table}. Skipping.`);
                continue;
            }

            log(`Migrating ${rows.length} rows for table: ${table}...`);
            const columns = Object.keys(rows[0]);
            
            let conflictClause = "ON CONFLICT DO NOTHING";
            if (columns.includes('id')) conflictClause = "ON CONFLICT (id) DO NOTHING";
            if (table === 'teacher_courses') conflictClause = "ON CONFLICT (teacher_id, course_id) DO NOTHING";

            let successCount = 0;
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
                    successCount += batch.length;
                    process.stdout.write(`.` ); // progress indicator
                } catch(err) {
                    log(`Batch error in ${table}: ` + err.message);
                    log(`Falling back to sequential inserts for this batch...`);
                    // sequential fallback
                    for (const row of batch) {
                        const rowPlaceholders = columns.map((_, idx) => `$${idx+1}`).join(', ');
                        const rowQuery = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${rowPlaceholders}) ${conflictClause}`;
                        try {
                            await pgClient.query(rowQuery, columns.map(col => row[col]));
                            successCount++;
                        } catch(rowErr) {
                            log(`Row error failed: ${rowErr.message} on data: ${JSON.stringify(row)}`);
                        }
                    }
                }
            }
            
            console.log();
            log(`Migrated ${successCount}/${rows.length} rows for ${table} successfully.`);

            // Reset Sequence
            try {
                if (columns.includes('id')) {
                    await pgClient.query(`SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE((SELECT MAX(id) FROM ${table}), 1), true)`);
                    log(`Reset sequence for ${table}.`);
                }
            } catch (seqErr) {
                log(`Warning: Couldn't reset sequence for ${table}: ` + seqErr.message);
            }
        }
        log("Entire Database Migration Completed!");
    } catch (e) {
        log("Migration Error: " + e.message);
    } finally {
        await pgClient.end();
        await myClient.end();
        fs.writeFileSync('tmp/data_migrator_robust_log.txt', logOutput);
    }
}

migrate();
