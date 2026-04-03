const { Client } = require('pg');
const c = new Client({
    connectionString: 'postgresql://anvitha:mxS8KEtLqG8uBLIWPM39nQDS3r6OMbd5@dpg-d77m2hp5pdvs739cctd0-a.oregon-postgres.render.com/secureexaminationworkflow',
    ssl: { rejectUnauthorized: false }
});

c.connect()
    .then(() => c.query("SELECT * FROM users"))
    .then(r => {
        console.log("users table exists, rows:", r.rowCount);
        return c.end();
    })
    .catch(console.error);
