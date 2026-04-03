const { Client } = require('pg');
const c = new Client({
    connectionString: 'postgresql://anvitha:mxS8KEtLqG8uBLIWPM39nQDS3r6OMbd5@dpg-d77m2hp5pdvs739cctd0-a.oregon-postgres.render.com/secureexaminationworkflow',
    ssl: { rejectUnauthorized: false }
});

c.connect()
    .then(() => c.query("INSERT INTO users (id, username, password, role, status, needs_password_setup) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING", [999, 'test', 'pass', 'student', 'active', 0]))
    .then(r => {
        console.log("Insert worked");
        return c.end();
    })
    .catch(err => {
        console.error("Insert failed:", err.message);
        c.end();
    });
