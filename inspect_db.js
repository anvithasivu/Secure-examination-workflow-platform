const mysql = require("mysql2");
const fs = require("fs");

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
    db.query("SHOW TABLES", (err, tables) => {
        let out = { tables };
        db.query("DESCRIBE courses", (err, coursesDesc) => {
            out.courses = coursesDesc;
            db.query("DESCRIBE results", (err, resultsDesc) => {
                if (!err) out.results = resultsDesc;
                else out.resultsError = err.message;
                db.query("DESCRIBE questions", (err, questionsDesc) => {
                    out.questions = questionsDesc;
                    fs.writeFileSync("db_schema.json", JSON.stringify(out, null, 2));
                    process.exit(0);
                });
            });
        });
    });
});
