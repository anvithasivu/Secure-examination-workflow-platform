const { Client } = require('pg');
const c = new Client({
    connectionString: "postgresql://anvitha:mxS8KEtLqG8uBLIWPM39nQDS3r6OMbd5@dpg-d77m2hp5pdvs739cctd0-a.oregon-postgres.render.com/secureexaminationworkflow",
    ssl: { rejectUnauthorized: false }
});
c.connect()
    .then(() => c.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'password_reset_requests' AND column_name = 'created_at'"))
    .then(r => console.log(r.rows))
    .finally(() => c.end());
