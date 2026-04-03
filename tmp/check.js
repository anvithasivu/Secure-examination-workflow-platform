const { Client } = require('pg');
const c = new Client({
    connectionString: 'postgresql://anvitha:mxS8KEtLqG8uBLIWPM39nQDS3r6OMbd5@dpg-d77m2hp5pdvs739cctd0-a.oregon-postgres.render.com/secureexaminationworkflow',
    ssl: { rejectUnauthorized: false }
});

c.connect()
    .then(() => c.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'"))
    .then(r => {
        console.log("Tables in Postgres:", r.rows.map(x => x.table_name).join(", "));
        return c.end();
    })
    .catch(console.error);
