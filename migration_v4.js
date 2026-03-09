const mysql = require("mysql2");

const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "anvisivu07",
    database: "secure_exam"
});

db.connect(err => {
    if (err) {
        console.error("DB connection failed:", err.message);
        process.exit(1);
    }

    const query = `
    CREATE TABLE IF NOT EXISTS password_reset_requests (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      requested_by_role VARCHAR(50) NOT NULL,
      status VARCHAR(20) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `;

    db.query(query, err => {
        if (err) {
            console.error("Migration failed:", err.message);
        } else {
            console.log("Migration successful: Added password_reset_requests table.");
        }
        db.end();
    });
});
