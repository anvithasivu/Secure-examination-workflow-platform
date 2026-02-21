const mysql = require('mysql2');

const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "anvisivu07",
    database: "secure_exam"
});

db.connect(async err => {
    if (err) {
        console.error("Connection failed:", err);
        process.exit(1);
    }

    try {
        // 1. Add status column to users if it doesn't exist
        const [columns] = await db.promise().query("SHOW COLUMNS FROM users LIKE 'status'");
        if (columns.length === 0) {
            await db.promise().query("ALTER TABLE users ADD COLUMN status ENUM('active', 'pending') DEFAULT 'active'");
            console.log("Added status column to users");
        } else {
            console.log("Status column already exists in users");
        }

        // 2. Create course_levels table
        await db.promise().query(`
      CREATE TABLE IF NOT EXISTS course_levels (
        id INT AUTO_INCREMENT PRIMARY KEY,
        course_id INT,
        level_number INT,
        level_name VARCHAR(100),
        FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
      )
    `);
        console.log("Created course_levels table (or already existed)");

        // 3. Migrate existing levels
        const [courses] = await db.promise().query("SELECT id, levels, course_name FROM courses");
        for (const course of courses) {
            const [existingLevels] = await db.promise().query("SELECT * FROM course_levels WHERE course_id = ?", [course.id]);
            if (existingLevels.length === 0) {
                for (let i = 1; i <= course.levels; i++) {
                    await db.promise().query("INSERT INTO course_levels (course_id, level_number, level_name) VALUES (?, ?, ?)", [course.id, i, `Level ${i}`]);
                }
                console.log(`Migrated ${course.levels} levels for course: ${course.course_name}`);
            }
        }

        // 4. Set existing teachers to active
        await db.promise().query("UPDATE users SET status = 'active' WHERE role = 'teacher' AND status IS NULL");

        console.log("Migration completed successfully");
        process.exit(0);
    } catch (err) {
        console.error("Migration failed:", err);
        process.exit(1);
    }
});
