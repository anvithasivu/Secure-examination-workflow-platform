const mysql = require('mysql2/promise');

async function test() {
    const myClient = await mysql.createConnection({
        host: "localhost",
        user: "root",
        password: "anvisivu07",
        database: "secure_exam"
    });

    const [rows] = await myClient.query(`SELECT * FROM users`);
    console.log("Columns:", Object.keys(rows[0]));
    console.log("First Row:", rows[0]);
    
    await myClient.end();
}
test().catch(console.error);
