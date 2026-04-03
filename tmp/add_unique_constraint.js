const { Client } = require('pg');

async function patch() {
    const pgClient = new Client({
        connectionString: "postgresql://anvitha:mxS8KEtLqG8uBLIWPM39nQDS3r6OMbd5@dpg-d77m2hp5pdvs739cctd0-a.oregon-postgres.render.com/secureexaminationworkflow",
        ssl: { rejectUnauthorized: false }
    });

    try {
        await pgClient.connect();
        console.log("Connected for unique constraint patch.");

        // Clean duplicates first if any
        await pgClient.query(`
            DELETE FROM teacher_courses T1
            USING teacher_courses T2
            WHERE T1.id < T2.id
            AND T1.teacher_id = T2.teacher_id
            AND T1.course_id = T2.course_id;
        `);
        console.log("Cleaned potential duplicates.");

        // Add UNIQUE constraint
        await pgClient.query(`
            ALTER TABLE teacher_courses 
            ADD CONSTRAINT unique_teacher_course UNIQUE (teacher_id, course_id)
        `);
        console.log("Successfully added UNIQUE constraint.");

    } catch (err) {
        console.error("Patching failed:", err.message);
    } finally {
        await pgClient.end();
    }
}

patch();
