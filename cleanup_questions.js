const mysql = require("mysql2");

const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "anvisivu07",
    database: "secure_exam"
});

// Criteria: HTML tags in MCQ questions
const deleteQuery = `
    DELETE FROM questions 
    WHERE (question LIKE '%<%')
`;

db.query(deleteQuery, (err, result) => {
    if (err) throw err;
    console.log(`Deleted ${result.affectedRows} imported questions.`);
    db.end();
});
