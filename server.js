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

// Database connection
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "anvisivu07", // change as needed
  database: "secure_exam"
});

db.connect(err => {
  if (err) {
    console.error("Database connection failed:", err.message);
    process.exit(1);
  } else {
    console.log("Connected to MySQL Database");
    app.listen(3000, () => console.log("Server running at http://localhost:3000"));
  }
});

// Login page
app.get("/", (req, res) => res.render("login"));

// Handle login
app.post("/login", (req, res) => {
  const { username, password, role } = req.body;

  db.query("SELECT * FROM users WHERE username=?", [username], (err, users) => {
    if (err) throw err;
    if (!users.length) return res.send("User not found");

    const user = users[0];
    bcrypt.compare(password, user.password, (err, match) => {
      if (err) throw err;
      if (!match) return res.send("Wrong password");
      if (role && user.role !== role && user.role !== "admin") return res.send("Role mismatch");

      req.session.user = user;

      if (user.role === "admin") return res.redirect("/admin");
      else if (user.role === "student") return res.redirect("/student-courses");
      else return res.send("Role not allowed");
    });
  });
});

// Admin dashboard
app.get("/admin", (req, res) => {
  if (!req.session.user || req.session.user.role !== "admin") return res.redirect("/");
  res.render("admin_dashboard", { user: req.session.user });
});

// Add question
app.get("/add-question", (req, res) => {
  if (!req.session.user || req.session.user.role !== "admin") return res.redirect("/");
  db.query("SELECT * FROM courses", (err, courses) => {
    if (err) throw err;
    res.render("add_question", { courses });
  });
});

// View questions
app.get("/view-questions", (req, res) => {
  if (!req.session.user || req.session.user.role !== "admin") return res.redirect("/");

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
        res.render("view_questions", { mcqQuestions, codingQuestions, courses, selectedCourse, selectedLevel, maxLevel: Math.max(...courses.map(c=>c.levels)) });
      });
    });
  });
});

// Delete question
app.get("/delete-question/:id", (req, res) => {
  if (!req.session.user || req.session.user.role !== "admin") return res.redirect("/");
  db.query("DELETE FROM questions WHERE id=?", [req.params.id], err => {
    if (err) throw err;
    res.redirect("/view-questions");
  });
});

// Student courses
app.get("/student-courses", (req, res) => {
  if (!req.session.user || req.session.user.role !== "student") return res.redirect("/");
  db.query("SELECT * FROM courses ORDER BY id ASC", (err, courses) => {
    if (err) throw err;
    res.render("student_courses", { user: req.session.user, courses });
  });
});

// Student levels
app.get("/student-levels/:course_id", (req, res) => {
  if (!req.session.user || req.session.user.role !== "student") return res.redirect("/");
  const courseId = req.params.course_id;

  db.query("SELECT * FROM courses WHERE id=?", [courseId], (err, courseRows) => {
    if (err) throw err;
    if (!courseRows.length) return res.send("Course not found");

    const course = courseRows[0];

    // Level topics
    const levelTopics = {
      1: "Conditional Statements",
      2: "Loop Statements",
      3: "Arrays",
      4: "Strings"
    };

    res.render("student_levels", {
      course,
      levels: course.levels,
      levelTopics
    });
  });
});

// Logout
app.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/");
});
