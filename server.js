const express = require("express");
const mysql = require("mysql2");
const session = require("express-session");
const bcrypt = require("bcrypt");

const app = express();

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
app.set("view engine", "ejs");

app.use(session({
  secret: "secureexamkey",
  resave: false,
  saveUninitialized: true
}));

// MySQL Connection
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
  console.log("Connected to MySQL DB");
  app.listen(3000, () => console.log("Server running on http://localhost:3000"));
});

// ----------------------
// Login
// ----------------------
app.get("/", (req, res) => res.render("login"));

app.post("/login", (req, res) => {
  const { username, password } = req.body;
  db.query("SELECT * FROM users WHERE username=?", [username], (err, users) => {
    if (err) throw err;
    if (!users.length) return res.send("User not found");

    const user = users[0];
    bcrypt.compare(password, user.password, (err, match) => {
      if (err) throw err;
      if (!match) return res.send("Wrong password");

      req.session.user = user;

      // Redirect by role
      if (user.role === "admin") return res.redirect("/admin");
      if (user.role === "teacher") return res.redirect("/teacher-dashboard");
      return res.redirect("/student-dashboard");
    });
  });
});

// ----------------------
// Logout
// ----------------------
app.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/");
});

// ----------------------
// Admin Dashboard
// ----------------------
app.get("/admin", (req, res) => {
  if (!req.session.user || req.session.user.role !== "admin") return res.redirect("/");
  db.query("SELECT * FROM courses", (err, courses) => {
    if (err) throw err;
    res.render("admin_dashboard", { user: req.session.user, courses });
  });
});

// ----------------------
// Teacher Dashboard
// ----------------------
app.get("/teacher-dashboard", (req, res) => {
  if (!req.session.user || req.session.user.role !== "teacher") return res.redirect("/");
  db.query("SELECT * FROM courses", (err, courses) => {
    if (err) throw err;
    res.render("teacher_dashboard", { user: req.session.user, courses });
  });
});

// ----------------------
// Add Question (Teacher/Admin)
// ----------------------
app.get("/add-question", (req, res) => {
  if (!req.session.user || !["admin","teacher"].includes(req.session.user.role)) return res.redirect("/");
  db.query("SELECT * FROM courses", (err, courses) => {
    if (err) throw err;
    res.render("add_question", { courses, user: req.session.user });
  });
});

app.post("/add-question", (req, res) => {
  const { course_id, level, question_type, question, option1, option2, option3, option4, correct, coding_question, starter_code } = req.body;

  if (question_type === "mcq") {
    db.query(
      "INSERT INTO questions (course_id, level, question, option1, option2, option3, option4, correct) VALUES (?,?,?,?,?,?,?,?)",
      [course_id, level, question, option1, option2, option3, option4, correct],
      err => { if (err) throw err; res.redirect("/add-question"); }
    );
  } else if (question_type === "coding") {
    db.query(
      "INSERT INTO questions (course_id, level, coding_question, starter_code) VALUES (?,?,?,?)",
      [course_id, level, coding_question, starter_code],
      err => { if (err) throw err; res.redirect("/add-question"); }
    );
  } else res.send("Invalid question type");
});

// ----------------------
// View Questions (Teacher/Admin)
// ----------------------
app.get("/view-questions", (req, res) => {
  if (!req.session.user || !["admin","teacher"].includes(req.session.user.role)) return res.redirect("/");

  const selectedCourse = req.query.course_id || 0;
  const selectedLevel = req.query.level || 0;

  db.query("SELECT * FROM courses", (err, courses) => {
    if (err) throw err;

    let mcqQuery = "SELECT * FROM questions WHERE question IS NOT NULL";
    let codingQuery = "SELECT * FROM questions WHERE coding_question IS NOT NULL";
    const params = [];

    if (selectedCourse != 0) { mcqQuery += " AND course_id=?"; codingQuery += " AND course_id=?"; params.push(selectedCourse); }
    if (selectedLevel != 0) { mcqQuery += " AND level=?"; codingQuery += " AND level=?"; params.push(selectedLevel); }

    db.query(mcqQuery, params, (err, mcqQuestions) => {
      if (err) throw err;
      db.query(codingQuery, params, (err2, codingQuestions) => {
        if (err2) throw err2;
        res.render("view_questions", { mcqQuestions, codingQuestions, courses, selectedCourse, selectedLevel, user: req.session.user });
      });
    });
  });
});

// Delete Question
app.get("/delete-question/:id", (req, res) => {
  if (!req.session.user || !["admin","teacher"].includes(req.session.user.role)) return res.redirect("/");
  const questionId = req.params.id;
  db.query("DELETE FROM questions WHERE id=?", [questionId], err => { if (err) throw err; res.redirect("/view-questions"); });
});

// ----------------------
// Student Dashboard
// ----------------------
app.get("/student-dashboard", (req, res) => {
  if (!req.session.user || req.session.user.role !== "student") return res.redirect("/");
  db.query("SELECT * FROM courses ORDER BY id ASC", (err, courses) => {
    if (err) throw err;
    res.render("student_dashboard", { user: req.session.user, courses });
  });
});

// Student Levels
app.get("/student-levels/:course_id", (req, res) => {
  if (!req.session.user || req.session.user.role !== "student") return res.redirect("/");
  const courseId = req.params.course_id;

  db.query("SELECT * FROM courses WHERE id=?", [courseId], (err, courseRows) => {
    if (err) throw err;
    if (!courseRows.length) return res.send("Course not found");

    const course = courseRows[0];

    const levelTopics = {
      1: "Conditional Statements",
      2: "Loop Statements",
      3: "Arrays",
      4: "Strings"
    };

    res.render("student_levels", { course, levels: course.levels, levelTopics });
  });
});

// Student Exam Page (Random 2 MCQ + 2 coding)
app.get("/exam/:course_id/:level", (req, res) => {
  if (!req.session.user || req.session.user.role !== "student") return res.redirect("/");

  const courseId = req.params.course_id;
  const level = parseInt(req.params.level);

  db.query("SELECT * FROM courses WHERE id=?", [courseId], (err, courseRows) => {
    if (err) throw err;
    if (!courseRows.length) return res.send("Course not found");

    const course = courseRows[0];

    db.query(
      "SELECT * FROM questions WHERE course_id=? AND level=? AND question IS NOT NULL ORDER BY RAND() LIMIT 2",
      [courseId, level],
      (err, mcqQuestions) => {
        if (err) throw err;

        db.query(
          "SELECT * FROM questions WHERE course_id=? AND level=? AND coding_question IS NOT NULL ORDER BY RAND() LIMIT 2",
          [courseId, level],
          (err2, codingQuestions) => {
            if (err2) throw err2;

            res.render("student_questions", { course, level, mcqQuestions, codingQuestions });
          }
        );
      }
    );
  });
});
