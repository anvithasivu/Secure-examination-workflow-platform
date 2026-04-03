const mysql = require('mysql2/promise');
const { Client } = require('pg');

async function check() {
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

    const tables = ['users', 'courses', 'course_levels', 'teacher_courses', 'questions', 'results', 'password_reset_requests'];
    
    console.log("=== MySQL ===");
    for (const t of tables) {
        const [r] = await myClient.query(`SELECT COUNT(*) as c FROM ${t}`);
        console.log(`${t}: ${r[0].c}`);
    }

    console.log("\n=== PostgreSQL ===");
    for (const t of tables) {
        const r = await pgClient.query(`SELECT COUNT(*) as c FROM ${t}`);
        console.log(`${t}: ${r.rows[0].c}`);
    }

    await pgClient.end();
    await myClient.end();
}

check().catch(console.error);
