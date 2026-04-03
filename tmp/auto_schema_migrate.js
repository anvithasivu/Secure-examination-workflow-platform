const mysql = require('mysql2/promise');
const { Client } = require('pg');

async function sync() {
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
    console.log("Connected to both databases for schema sync");

    const tables = ['users', 'courses', 'course_levels', 'teacher_courses', 'questions', 'results', 'password_reset_requests'];

    for (const table of tables) {
        const [myCols] = await myClient.query(`SHOW COLUMNS FROM ${table}`);
        const pgColsRes = await pgClient.query(`SELECT column_name FROM information_schema.columns WHERE table_name = '${table}'`);
        const pgCols = pgColsRes.rows.map(r => r.column_name);

        for (const myCol of myCols) {
            const colName = myCol.Field;
            if (!pgCols.includes(colName)) {
                let type = 'TEXT'; 
                if (myCol.Type.includes('int')) type = 'INT';
                if (myCol.Type.includes('varchar')) type = 'VARCHAR(255)';
                if (myCol.Type.includes('tinyint')) type = 'INT';
                
                let query = `ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${colName} ${type}`;
                console.log("Executing:", query);
                await pgClient.query(query);
            }
        }
    }
    
    console.log("Schema synced!");
    await pgClient.end();
    await myClient.end();
}
sync().catch(console.error);
