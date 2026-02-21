const mysql = require('mysql2');

const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'anvisivu07',
    database: 'secure_exam'
});

db.connect(async (err) => {
    if (err) throw err;
    console.log('Connected to database');

    try {
        // Step 1: Add needs_password_setup safely
        try {
            await db.promise().query("ALTER TABLE users ADD COLUMN needs_password_setup BOOLEAN DEFAULT FALSE");
            console.log("Column needs_password_setup added.");
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') console.log("Column needs_password_setup already exists.");
            else throw e;
        }

        // Step 2: Clean up duplicates (keep lowest ID)
        const cleanupQuery = `
      DELETE FROM users 
      WHERE id NOT IN (
        SELECT id FROM (
          SELECT MIN(id) AS id 
          FROM users 
          GROUP BY username
        ) AS tmp
      )
    `;
        await db.promise().query(cleanupQuery);
        console.log("Duplicates cleaned up.");

        // Step 3: Add UNIQUE constraint safely
        try {
            await db.promise().query("ALTER TABLE users ADD CONSTRAINT UNIQUE (username)");
            console.log("UNIQUE constraint added to username.");
        } catch (e) {
            if (e.code === 'ER_DUP_KEYNAME') console.log("UNIQUE constraint already exists.");
            else throw e;
        }

        console.log('Migration v2 complete');
    } catch (err) {
        console.error("Migration failed:", err);
    } finally {
        db.end();
    }
});
