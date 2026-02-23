const mysql = require("mysql2");

const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "anvisivu07",
    database: "secure_exam"
});

db.connect(err => {
    if (err) {
        console.error(err);
        process.exit(1);
    }

    const queries = [
        "ALTER TABLE results ADD COLUMN IF NOT EXISTS attempts INT DEFAULT 1",
        "ALTER TABLE results ADD COLUMN IF NOT EXISTS pass_fail VARCHAR(10) DEFAULT 'Fail'"
    ];

    let completed = 0;
    queries.forEach(q => {
        db.query(q, (err) => {
            if (err) console.error("Error executing query:", q, err.message);
            else console.log("Success:", q);
            completed++;
            if (completed === queries.length) {
                console.log("Migration finished.");
                process.exit(0);
            }
        });
    });
});
