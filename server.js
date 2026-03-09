const express = require("express");
const mysql = require("mysql2");
const session = require("express-session");
const bcrypt = require("bcrypt");


const app = express();

function requireRole(role) {
  return (req, res, next) => {
    if (!req.session.user || req.session.user.role !== role) return res.redirect("/");
    next();
  };
}

function requireAnyRole(roles) {
  return (req, res, next) => {
    if (!req.session.user || !roles.includes(req.session.user.role)) return res.redirect("/");
    next();
  };
}

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

    if (user.needs_password_setup) {
      req.session.temp_user_id = user.id;
      return res.redirect("/setup-password");
    }

    bcrypt.compare(password, user.password, (err, match) => {
      if (err) throw err;
      if (!match) return res.send("Wrong password");

      if (user.status === 'pending') {
        req.session.user = user;
        if (user.role === 'teacher') return res.redirect("/teacher/pending");
        // Students are active by default, but just in case
        return res.send("Your account is pending approval.");
      }

      req.session.user = user;

      // Redirect by role
      if (user.role === "admin") return res.redirect("/admin");
      if (user.role === "academic_coordinator") return res.redirect("/coordinator");
      if (user.role === "teacher") {
        db.query("SELECT * FROM teacher_courses WHERE teacher_id=?", [user.id], (err, courses) => {
          if (err) throw err;
          if (courses.length > 0) {
            const course = courses[0];
            if (course.status === 'approved') return res.redirect("/teacher-dashboard");
            return res.redirect("/teacher/pending");
          }
          return res.redirect("/teacher/choose-course");
        });
        return; // wait for async query
      }
      return res.redirect("/student-dashboard");
    });
  });
});

app.get("/setup-password", (req, res) => {
  if (!req.session.temp_user_id) return res.redirect("/");
  res.render("setup_password");
});

app.post("/setup-password", (req, res) => {
  if (!req.session.temp_user_id) return res.redirect("/");
  const { password } = req.body;
  const userId = req.session.temp_user_id;

  bcrypt.hash(password, 10, (err, hash) => {
    if (err) throw err;
    db.query("UPDATE users SET password=?, needs_password_setup=0 WHERE id=?", [hash, userId], err => {
      if (err) throw err;
      delete req.session.temp_user_id;
      db.query("SELECT * FROM users WHERE id=?", [userId], (err, rows) => {
        if (err) throw err;
        const user = rows[0];
        req.session.user = user;

        // Redirect by role
        if (user.role === "admin") return res.redirect("/admin");
        if (user.role === "academic_coordinator") return res.redirect("/coordinator");
        if (user.role === "teacher") {
          db.query("SELECT * FROM teacher_courses WHERE teacher_id=?", [user.id], (err2, courses) => {
            if (err2) throw err2;
            if (courses.length > 0) {
              const course = courses[0];
              if (course.status === 'approved') return res.redirect("/teacher-dashboard");
              return res.redirect("/teacher/pending");
            }
            return res.redirect("/teacher/choose-course");
          });
          return;
        }
        res.redirect("/student-dashboard");
      });
    });
  });
});

// ----------------------
// Registration / Signup
// ----------------------
app.get("/signup", (req, res) => res.render("signup"));

app.post("/signup", (req, res) => {
  const { username, password } = req.body;
  const role = "student"; // Forced to student as per requirements
  bcrypt.hash(password, 10, (err, hash) => {
    if (err) throw err;
    const status = 'active';
    db.query("INSERT INTO users (username, password, role, status) VALUES (?, ?, ?, ?)", [username, hash, role, status], (err, result) => {
      if (err) {
        if (err.code === 'ER_DUP_ENTRY') return res.send("Username already exists.");
        throw err;
      }

      // Auto-login
      db.query("SELECT * FROM users WHERE id=?", [result.insertId], (err, users) => {
        if (err) throw err;
        req.session.user = users[0];
        res.redirect("/student-dashboard");
      });
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
// Password Recovery
// ----------------------
app.get("/forgot-password", (req, res) => res.render("forgot_password", { success: req.query.success, error: req.query.error }));

app.post("/forgot-password", (req, res) => {
  const { username } = req.body;
  db.query("SELECT * FROM users WHERE username=?", [username], (err, users) => {
    if (err) throw err;
    if (!users.length) return res.redirect("/forgot-password?error=user_not_found");

    const user = users[0];

    // Check if there is already a pending request
    db.query("SELECT * FROM password_reset_requests WHERE user_id=? AND status='pending'", [user.id], (err2, requests) => {
      if (err2) throw err2;
      if (requests.length > 0) return res.redirect("/forgot-password?error=already_pending");

      db.query("INSERT INTO password_reset_requests (user_id, requested_by_role) VALUES (?, ?)", [user.id, user.role], err3 => {
        if (err3) throw err3;
        res.redirect("/forgot-password?success=1");
      });
    });
  });
});

// ----------------------
// Admin Dashboard
// ----------------------
app.get("/admin", (req, res) => {
  if (!req.session.user || req.session.user.role !== "admin") return res.redirect("/");

  const stats = {
    totalCourses: 0,
    totalStudents: 0,
    totalTeachers: 0,
    totalResults: 0,
  };

  db.query("SELECT COUNT(*) AS cnt FROM courses", (err, courseRows) => {
    if (err) throw err;
    stats.totalCourses = courseRows?.[0]?.cnt ?? 0;

    db.query("SELECT COUNT(*) AS cnt FROM users WHERE role='student'", (err2, studentRows) => {
      if (err2) throw err2;
      stats.totalStudents = studentRows?.[0]?.cnt ?? 0;

      db.query("SELECT COUNT(*) AS cnt FROM users WHERE role='teacher'", (err3, teacherRows) => {
        if (err3) throw err3;
        stats.totalTeachers = teacherRows?.[0]?.cnt ?? 0;

        db.query("SELECT COUNT(*) AS cnt FROM results", (err4, resultCountRows) => {
          if (err4) throw err4;
          stats.totalResults = resultCountRows?.[0]?.cnt ?? 0;

          db.query(
            "SELECT id, username, role FROM users ORDER BY id DESC LIMIT 6",
            (err5, recentUsers) => {
              if (err5) throw err5;

              db.query(
                `SELECT r.id, u.username, c.course_name, r.level, r.score
                 FROM results r
                 JOIN users u ON u.id = r.user_id
                 JOIN courses c ON c.id = r.course_id
                 ORDER BY r.id DESC
                 LIMIT 6`,
                (err6, recentResults) => {
                  if (err6) throw err6;
                  res.render("admin_dashboard", {
                    user: req.session.user,
                    stats,
                    recentUsers,
                    recentResults,
                  });
                }
              );
            }
          );
        });
      });
    });
  });
});

// ----------------------
// Academic Coordinator Dashboard
// ----------------------
app.get("/coordinator", requireRole("academic_coordinator"), (req, res) => {
  const stats = {
    totalCourses: 0,
    activeCourses: 0,
    totalTeachers: 0,
  };

  db.query("SELECT COUNT(*) AS cnt FROM courses", (err, courseCountRows) => {
    if (err) throw err;
    stats.totalCourses = courseCountRows?.[0]?.cnt ?? 0;

    db.query(
      "SELECT COUNT(DISTINCT course_id) AS cnt FROM teacher_courses WHERE status='approved'",
      (err2, activeCourseRows) => {
        if (err2) throw err2;
        stats.activeCourses = activeCourseRows?.[0]?.cnt ?? 0;

        db.query("SELECT COUNT(*) AS cnt FROM users WHERE role='teacher'", (err3, teacherCountRows) => {
          if (err3) throw err3;
          stats.totalTeachers = teacherCountRows?.[0]?.cnt ?? 0;

          db.query(
            "SELECT id, course_name FROM courses ORDER BY id DESC LIMIT 6",
            (err4, recentCourses) => {
              if (err4) throw err4;

              db.query(
                "SELECT id, username FROM users WHERE role='teacher' ORDER BY id DESC LIMIT 6",
                (err5, recentTeachers) => {
                  if (err5) throw err5;
                  res.render("academic_coordinator_dashboard", {
                    user: req.session.user,
                    stats,
                    recentCourses,
                    recentTeachers,
                  });
                }
              );
            }
          );
        });
      }
    );
  });
});

app.get("/admin/manage-users", requireRole("admin"), (req, res) => {
  db.query("SELECT * FROM users", (err, users) => {
    if (err) throw err;
    db.query("SELECT * FROM courses", (err2, courses) => {
      if (err2) throw err2;
      const students = users.filter(u => u.role === 'student');
      const pendingTeachers = users.filter(u => u.role === 'teacher' && u.needs_password_setup === 1);
      const activeTeachers = users.filter(u => u.role === 'teacher' && u.needs_password_setup === 0);

      db.query(
        `SELECT tc.teacher_id, c.course_name
         FROM teacher_courses tc
         JOIN courses c ON c.id = tc.course_id`,
        (err3, teacherCourseRows) => {
          if (err3) throw err3;
          const teacherCoursesMap = {};
          (teacherCourseRows || []).forEach(r => {
            if (!teacherCoursesMap[r.teacher_id]) teacherCoursesMap[r.teacher_id] = [];
            teacherCoursesMap[r.teacher_id].push(r.course_name);
          });

          db.query(
            `SELECT pr.*, u.username
             FROM password_reset_requests pr
             JOIN users u ON pr.user_id = u.id
             WHERE pr.status = 'pending' AND pr.requested_by_role = 'academic_coordinator'`,
            (err4, pwdRequests) => {
              if (err4) throw err4;
              res.render("admin_manage_users", { user: req.session.user, students, pendingTeachers, activeTeachers, courses, teacherCoursesMap, pwdRequests });
            }
          );
        }
      );
    });
  });
});

app.get("/coordinator/manage-users", requireRole("academic_coordinator"), (req, res) => {
  db.query("SELECT * FROM users", (err, users) => {
    if (err) throw err;
    db.query("SELECT * FROM courses", (err2, courses) => {
      if (err2) throw err2;
      const students = users.filter(u => u.role === 'student');
      const pendingTeachers = users.filter(u => u.role === 'teacher' && u.needs_password_setup === 1);
      const activeTeachers = users.filter(u => u.role === 'teacher' && u.needs_password_setup === 0);

      db.query(
        `SELECT tc.teacher_id, c.course_name
         FROM teacher_courses tc
         JOIN courses c ON c.id = tc.course_id`,
        (err3, teacherCourseRows) => {
          if (err3) throw err3;
          const teacherCoursesMap = {};
          (teacherCourseRows || []).forEach(r => {
            if (!teacherCoursesMap[r.teacher_id]) teacherCoursesMap[r.teacher_id] = [];
            teacherCoursesMap[r.teacher_id].push(r.course_name);
          });

          db.query(
            `SELECT pr.*, u.username
             FROM password_reset_requests pr
             JOIN users u ON pr.user_id = u.id
             WHERE pr.status = 'pending' AND pr.requested_by_role IN ('teacher', 'student')`,
            (err4, pwdRequests) => {
              if (err4) throw err4;
              res.render("admin_manage_users", { user: req.session.user, students, pendingTeachers, activeTeachers, courses, teacherCoursesMap, pwdRequests });
            }
          );
        }
      );
    });
  });
});

app.post("/admin/approve-password-reset", requireAnyRole(["admin", "academic_coordinator"]), (req, res) => {
  const { request_id, user_id } = req.body;

  // Default temp password is "defaultpassword123"
  bcrypt.hash("defaultpassword123", 10, (err, hash) => {
    if (err) throw err;

    db.query("UPDATE users SET password=?, needs_password_setup=1 WHERE id=?", [hash, user_id], err2 => {
      if (err2) throw err2;

      db.query("UPDATE password_reset_requests SET status='approved' WHERE id=?", [request_id], err3 => {
        if (err3) throw err3;
        if (req.session.user.role === "academic_coordinator") return res.redirect("/coordinator/manage-users?tab=requests");
        res.redirect("/admin/manage-users?tab=requests");
      });
    });
  });
});

app.post("/coordinator/add-teacher", requireRole("academic_coordinator"), (req, res) => {
  const { username, course_id } = req.body;
  const role = 'teacher';
  const status = 'active';
  const needs_password_setup = 1;

  // course_id might be an array if multiple selected, or a single string
  let courses_to_assign = Array.isArray(course_id) ? course_id : [course_id];
  // Filter out any undefined or empty strings
  courses_to_assign = courses_to_assign.filter(id => id);

  // Default password "teacherlogin"
  bcrypt.hash("teacherlogin", 10, (err, hash) => {
    if (err) throw err;
    db.query("INSERT INTO users (username, password, role, status, needs_password_setup) VALUES (?, ?, ?, ?, ?)", [username, hash, role, status, needs_password_setup], (err, result) => {
      if (err) {
        if (err.code === 'ER_DUP_ENTRY') return res.send("Username already exists.");
        throw err;
      }
      const teacher_id = result.insertId;

      if (courses_to_assign.length > 0) {
        // Prepare values for bulk insert
        const values = courses_to_assign.map(cid => [teacher_id, cid, 'approved']);
        db.query("INSERT INTO teacher_courses (teacher_id, course_id, status) VALUES ?", [values], err2 => {
          if (err2) throw err2;
          res.redirect("/coordinator/manage-users");
        });
      } else {
        res.redirect("/coordinator/manage-users");
      }
    });
  });
});

app.post("/coordinator/approve-course-request", requireAnyRole(["admin", "academic_coordinator"]), (req, res) => {
  const { teacher_id, course_id } = req.body;
  db.query("UPDATE teacher_courses SET status='approved' WHERE teacher_id=? AND course_id=?", [teacher_id, course_id], (err) => {
    if (err) throw err;
    const redirectPath = req.session.user.role === 'admin' ? '/admin/manage-courses' : '/coordinator/manage-courses';
    res.redirect(redirectPath);
  });
});

app.post("/coordinator/reject-course-request", requireAnyRole(["admin", "academic_coordinator"]), (req, res) => {
  const { teacher_id, course_id } = req.body;
  db.query("UPDATE teacher_courses SET status='rejected' WHERE teacher_id=? AND course_id=?", [teacher_id, course_id], (err) => {
    if (err) throw err;
    const redirectPath = req.session.user.role === 'admin' ? '/admin/manage-courses' : '/coordinator/manage-courses';
    res.redirect(redirectPath);
  });
});

app.post("/admin/edit-user", requireAnyRole(["admin", "academic_coordinator"]), (req, res) => {
  const { user_id, new_username } = req.body;
  if (!user_id || !new_username) return res.redirect("back");

  db.query("UPDATE users SET username=? WHERE id=?", [new_username, user_id], err => {
    if (err) throw err;
    if (req.session.user.role === "academic_coordinator") return res.redirect("/coordinator/manage-users");
    res.redirect("/admin/manage-users");
  });
});

app.post("/admin/delete-user", requireAnyRole(["admin", "academic_coordinator"]), (req, res) => {
  const { user_id } = req.body;

  // Also delete associated results, etc. if user is student
  db.query("DELETE FROM results WHERE user_id=?", [user_id], err => {
    if (err) throw err;
    db.query("DELETE FROM teacher_courses WHERE teacher_id=?", [user_id], err2 => {
      if (err2) throw err2;
      db.query("DELETE FROM users WHERE id=?", [user_id], err3 => {
        if (err3) throw err3;
        if (req.session.user.role === "academic_coordinator") return res.redirect("/coordinator/manage-users");
        res.redirect("/admin/manage-users");
      });
    });
  });
});

app.get("/admin/manage-courses", requireRole("admin"), (req, res) => {
  db.query("SELECT * FROM courses", (err, courses) => {
    if (err) throw err;
    db.query("SELECT * FROM users WHERE role='teacher'", (err, teachers) => {
      if (err) throw err;
      db.query(`SELECT teacher_courses.course_id, teacher_courses.teacher_id, teacher_courses.status, users.username FROM teacher_courses JOIN users ON teacher_courses.teacher_id = users.id`, (err, assignments) => {
        if (err) throw err;

        courses.forEach(c => {
          let assigned = assignments.filter(a => a.course_id === c.id && a.status === 'approved').map(a => a.username);
          c.teachers = assigned.length ? assigned.join(", ") : "None";
        });

        // Fetch pending course requests
        db.query(
          `SELECT tc.teacher_id, tc.course_id, u.username, c.course_name 
           FROM teacher_courses tc 
           JOIN users u ON tc.teacher_id = u.id 
           JOIN courses c ON tc.course_id = c.id 
           WHERE tc.status = 'pending'`,
          (errP, pendingApprovals) => {
            if (errP) throw errP;
            res.render("manage_courses", { user: req.session.user, courses, teachers, pendingApprovals });
          }
        );
      });
    });
  });
});

app.get("/coordinator/manage-courses", requireRole("academic_coordinator"), (req, res) => {
  db.query("SELECT * FROM courses", (err, courses) => {
    if (err) throw err;
    db.query("SELECT * FROM users WHERE role='teacher'", (err, teachers) => {
      if (err) throw err;
      db.query(`SELECT teacher_courses.course_id, teacher_courses.teacher_id, teacher_courses.status, users.username FROM teacher_courses JOIN users ON teacher_courses.teacher_id = users.id`, (err, assignments) => {
        if (err) throw err;

        courses.forEach(c => {
          let assigned = assignments.filter(a => a.course_id === c.id && a.status === 'approved').map(a => a.username);
          c.teachers = assigned.length ? assigned.join(", ") : "None";
        });

        // Fetch pending course requests
        db.query(
          `SELECT tc.teacher_id, tc.course_id, u.username, c.course_name 
           FROM teacher_courses tc 
           JOIN users u ON tc.teacher_id = u.id 
           JOIN courses c ON tc.course_id = c.id 
           WHERE tc.status = 'pending'`,
          (errP, pendingApprovals) => {
            if (errP) throw errP;
            res.render("manage_courses", { user: req.session.user, courses, teachers, pendingApprovals });
          }
        );
      });
    });
  });
});

app.get("/course/:id/manage", (req, res) => {
  if (!req.session.user || !["admin", "teacher"].includes(req.session.user.role)) return res.redirect("/");
  const courseId = req.params.id;

  const renderCourse = () => {
    db.query("SELECT * FROM courses WHERE id=?", [courseId], (err, courseRows) => {
      if (err) throw err;
      if (courseRows.length === 0) return res.send("Course not found");

      db.query("SELECT * FROM course_levels WHERE course_id=? ORDER BY level_number ASC", [courseId], (err, levels) => {
        if (err) throw err;
        const canEdit = ["teacher"].includes(req.session.user.role);
        res.render("course_management", { user: req.session.user, course: courseRows[0], levels, canEdit });
      });
    });
  };

  if (req.session.user.role === "teacher") {
    db.query("SELECT * FROM teacher_courses WHERE teacher_id=? AND course_id=? AND status='approved'", [req.session.user.id, courseId], (err, rows) => {
      if (err) throw err;
      if (rows.length === 0) return res.redirect("/teacher-dashboard");
      renderCourse();
    });
  } else {
    renderCourse();
  }
});

app.post("/course/add-new-level", (req, res) => {
  if (!req.session.user || !["teacher"].includes(req.session.user.role)) return res.redirect("/");
  const { course_id } = req.body;

  db.query("SELECT * FROM teacher_courses WHERE teacher_id=? AND course_id=? AND status='approved'", [req.session.user.id, course_id], (err, rows) => {
    if (err) throw err;
    if (rows.length === 0) return res.redirect("/teacher-dashboard");

    db.query("SELECT MAX(level_number) as maxLevel FROM course_levels WHERE course_id=?", [course_id], (err, result) => {
      if (err) throw err;
      const nextLevel = (result[0].maxLevel || 0) + 1;
      db.query("INSERT INTO course_levels (course_id, level_number, level_name) VALUES (?, ?, ?)", [course_id, nextLevel, `Level ${nextLevel}`], err => {
        if (err) throw err;
        db.query("UPDATE courses SET levels = levels + 1 WHERE id=?", [course_id], err2 => {
          if (err2) throw err2;
          res.redirect(`/course/${course_id}/manage`);
        });
      });
    });
  });
});

app.post("/course/remove-specific-level", (req, res) => {
  if (!req.session.user || !["teacher"].includes(req.session.user.role)) return res.redirect("/");
  const { course_id, level_id } = req.body;

  db.query("SELECT * FROM teacher_courses WHERE teacher_id=? AND course_id=? AND status='approved'", [req.session.user.id, course_id], (err, rows) => {
    if (err) throw err;
    if (rows.length === 0) return res.redirect("/teacher-dashboard");

    db.query("DELETE FROM questions WHERE course_id=? AND level=(SELECT level_number FROM course_levels WHERE id=?)", [course_id, level_id], err1 => {
      if (err1) throw err1;
      db.query("DELETE FROM course_levels WHERE id=?", [level_id], err => {
        if (err) throw err;
        db.query("UPDATE courses SET levels = GREATEST(levels - 1, 1) WHERE id=?", [course_id], err2 => {
          if (err2) throw err2;
          res.redirect(`/course/${course_id}/manage`);
        });
      });
    });
  });
});

app.post("/course/rename-level", (req, res) => {
  if (!req.session.user || !["teacher"].includes(req.session.user.role)) return res.redirect("/");
  const { level_id, level_name } = req.body;

  db.query("SELECT course_id FROM course_levels WHERE id=?", [level_id], (errL, lvlRows) => {
    if (errL || !lvlRows.length) return res.redirect("/teacher-dashboard");
    const course_id = lvlRows[0].course_id;

    db.query("SELECT * FROM teacher_courses WHERE teacher_id=? AND course_id=? AND status='approved'", [req.session.user.id, course_id], (err, rows) => {
      if (err) throw err;
      if (rows.length === 0) return res.redirect("/teacher-dashboard");

      db.query("UPDATE course_levels SET level_name=? WHERE id=?", [level_name, level_id], err => {
        res.redirect(`/course/${course_id}/manage`);
      });
    });
  });
});

/* Legacy assignment route removed - handled during teacher creation
app.post("/admin/assign-teacher", (req, res) => {
  ...
});
*/

app.post("/coordinator/add-course", requireRole("academic_coordinator"), (req, res) => {
  let { course_name, levels } = req.body;
  if (!levels || levels < 1) levels = 1;
  db.query("INSERT INTO courses (course_name, levels) VALUES (?, ?)", [course_name, levels], err => {
    if (err) throw err;
    res.redirect("/coordinator/manage-courses");
  });
});

app.post("/admin/delete-course", (req, res) => {
  if (!req.session.user || !["admin"].includes(req.session.user.role)) return res.redirect("/");
  const { course_id } = req.body;

  // Delete associated teacher assignments
  db.query("DELETE FROM teacher_courses WHERE course_id=?", [course_id], err0 => {
    if (err0) throw err0;
    // Delete questions associated with the course
    db.query("DELETE FROM questions WHERE course_id=?", [course_id], err => {
      if (err) throw err;
      // Delete results associated with the course
      db.query("DELETE FROM results WHERE course_id=?", [course_id], err2 => {
        if (err2) throw err2;
        // Delete course levels
        db.query("DELETE FROM course_levels WHERE course_id=?", [course_id], err_lvl => {
          if (err_lvl) throw err_lvl;
          // Delete the course itself
          db.query("DELETE FROM courses WHERE id=?", [course_id], err3 => {
            if (err3) throw err3;
            res.redirect("/admin/manage-courses");
          });
        });
      });
    });
  });
});

app.get("/view-results", (req, res) => {
  if (!req.session.user || !["admin", "teacher"].includes(req.session.user.role)) return res.redirect("/");

  let query = `
    SELECT 
      users.username, 
      courses.course_name, 
      results.level, 
      results.score 
    FROM results 
    JOIN users ON results.user_id = users.id 
    JOIN courses ON results.course_id = courses.id
  `;

  const selectedCourse = req.query.course_id;

  if (req.session.user.role === "admin") {
    if (selectedCourse) {
      query += " WHERE courses.id = ? ORDER BY results.id DESC";
      db.query(query, [selectedCourse], (err, resultsData) => {
        if (err) throw err;
        const groupedResults = resultsData.reduce((acc, row) => {
          acc[row.course_name] = acc[row.course_name] || [];
          acc[row.course_name].push(row);
          return acc;
        }, {});
        res.render("admin_results", { user: req.session.user, results: resultsData, groupedResults });
      });
    } else {
      query += " ORDER BY results.id DESC";
      db.query(query, (err, resultsData) => {
        if (err) throw err;
        const groupedResults = resultsData.reduce((acc, row) => {
          acc[row.course_name] = acc[row.course_name] || [];
          acc[row.course_name].push(row);
          return acc;
        }, {});
        res.render("admin_results", { user: req.session.user, results: resultsData, groupedResults });
      });
    }
  } else {
    // Teacher
    const teacherId = req.session.user.id;
    query += ` JOIN teacher_courses ON courses.id = teacher_courses.course_id WHERE teacher_courses.teacher_id = ?`;
    let params = [teacherId];
    if (selectedCourse) {
      query += " AND courses.id = ?";
      params.push(selectedCourse);
    }
    query += " ORDER BY results.id DESC";
    db.query(query, params, (err, resultsData) => {
      if (err) throw err;
      res.render("admin_results", { user: req.session.user, results: resultsData, groupedResults: null });
    });
  }
});

// ----------------------
// Teacher Dashboard & Course Selection
// ----------------------
app.get("/teacher/choose-course", (req, res) => {
  if (!req.session.user || req.session.user.role !== "teacher") return res.redirect("/");
  db.query("SELECT * FROM courses", (err, courses) => {
    if (err) throw err;
    res.render("teacher_choose_course", { courses });
  });
});

app.post("/teacher/assign-course", (req, res) => {
  if (!req.session.user || req.session.user.role !== "teacher") return res.redirect("/");
  const { course_id } = req.body;
  const teacher_id = req.session.user.id;

  db.query("SELECT * FROM teacher_courses WHERE course_id=? AND teacher_id=?", [course_id, teacher_id], (err, exists) => {
    if (err) throw err;
    if (exists.length === 0) {
      db.query("INSERT INTO teacher_courses (teacher_id, course_id, status) VALUES (?, ?, 'pending')", [teacher_id, course_id], err => {
        if (err) throw err;
        req.session.active_course_id = course_id;
        res.redirect("/teacher/pending");
      });
    } else {
      req.session.active_course_id = course_id;
      if (exists[0].status === 'approved') return res.redirect("/teacher-dashboard");
      res.redirect("/teacher/pending");
    }
  });
});

app.get("/teacher/pending", (req, res) => {
  if (!req.session.user || req.session.user.role !== "teacher") return res.redirect("/");
  res.render("teacher_pending");
});

app.get("/teacher-dashboard", (req, res) => {
  if (!req.session.user || req.session.user.role !== "teacher") return res.redirect("/");
  db.query("SELECT courses.*, teacher_courses.status as request_status FROM courses JOIN teacher_courses ON courses.id = teacher_courses.course_id WHERE teacher_courses.teacher_id = ?", [req.session.user.id], (err, courses) => {
    if (err) throw err;
    res.render("teacher_dashboard", { user: req.session.user, courses });
  });
});

app.get("/teacher/request-course", requireRole("teacher"), (req, res) => {
  const teacherId = req.session.user.id;
  // Fetch courses not already assigned or requested by this teacher
  db.query(
    "SELECT * FROM courses WHERE id NOT IN (SELECT course_id FROM teacher_courses WHERE teacher_id = ?)",
    [teacherId],
    (err, courses) => {
      if (err) throw err;
      res.render("teacher_request_course", { user: req.session.user, courses });
    }
  );
});

app.post("/teacher/request-course", requireRole("teacher"), (req, res) => {
  const { course_id } = req.body;
  const teacherId = req.session.user.id;
  db.query(
    "INSERT INTO teacher_courses (teacher_id, course_id, status) VALUES (?, ?, 'pending')",
    [teacherId, course_id],
    (err) => {
      if (err) throw err;
      res.redirect("/teacher-dashboard");
    }
  );
});

// ----------------------
// Add Question (Teacher/Admin)
// ----------------------
app.get("/add-question", (req, res) => {
  if (!req.session.user || !["teacher"].includes(req.session.user.role)) return res.redirect("/");

  const preCourseId = req.query.course_id || 0;
  const preLevelNum = req.query.level || 0;

  let q = "SELECT * FROM courses";
  let params = [];
  if (req.session.user.role === "teacher") {
    q = "SELECT courses.* FROM courses JOIN teacher_courses ON courses.id = teacher_courses.course_id WHERE teacher_courses.teacher_id = ? AND teacher_courses.status = 'approved'";
    params.push(req.session.user.id);
  }

  db.query(q, params, (err, courses) => {
    if (err) throw err;
    res.render("add_question", { courses, user: req.session.user, preCourseId, preLevelNum });
  });
});

app.post("/add-question", (req, res) => {
  if (!req.session.user || !["teacher"].includes(req.session.user.role)) return res.redirect("/");
  const { course_id, level, question, option1, option2, option3, option4, correct } = req.body;

  db.query("SELECT * FROM teacher_courses WHERE teacher_id=? AND course_id=? AND status='approved'", [req.session.user.id, course_id], (err, rows) => {
    if (err) throw err;
    if (rows.length === 0) return res.redirect("/teacher-dashboard");

    db.query(
      "INSERT INTO questions (course_id, level, question, option1, option2, option3, option4, correct) VALUES (?,?,?,?,?,?,?,?)",
      [course_id, level, question, option1, option2, option3, option4, correct],
      err => { if (err) throw err; res.redirect("/add-question"); }
    );
  });
});

// ----------------------
// View Questions (Teacher/Admin)
// ----------------------
app.get("/view-questions", (req, res) => {
  if (!req.session.user || !["admin", "teacher"].includes(req.session.user.role)) return res.redirect("/");

  const selectedCourse = req.query.course_id || 0;
  const selectedLevel = req.query.level || 0;

  let courseQ = "SELECT * FROM courses";
  let courseParams = [];
  if (req.session.user.role === "teacher") {
    courseQ = "SELECT courses.* FROM courses JOIN teacher_courses ON courses.id = teacher_courses.course_id WHERE teacher_courses.teacher_id = ? AND teacher_courses.status = 'approved'";
    courseParams.push(req.session.user.id);
  }

  db.query(courseQ, courseParams, (err, courses) => {
    if (err) throw err;

    let mcqQuery = "SELECT * FROM questions WHERE question IS NOT NULL";
    const params1 = [];

    if (req.session.user.role === "teacher") {
      mcqQuery += " AND course_id IN (SELECT course_id FROM teacher_courses WHERE teacher_id = ? AND status = 'approved')";
      params1.push(req.session.user.id);
    }

    if (selectedCourse != 0) {
      mcqQuery += " AND course_id=?";
      params1.push(selectedCourse);
    }
    if (selectedLevel != 0) {
      mcqQuery += " AND level=?";
      params1.push(selectedLevel);
    }

    db.query(mcqQuery, params1, (err, mcqQuestions) => {
      if (err) throw err;
      res.render("view_questions", { mcqQuestions, courses, selectedCourse, selectedLevel, user: req.session.user });
    });
  });
});

// Delete Question
app.get("/delete-question/:id", (req, res) => {
  if (!req.session.user || !["admin", "teacher"].includes(req.session.user.role)) return res.redirect("/");
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
    db.query(
      "SELECT course_id, COUNT(DISTINCT CASE WHEN score >= 60 THEN level END) AS cleared_levels FROM results WHERE user_id=? GROUP BY course_id",
      [req.session.user.id],
      (err2, rows) => {
        if (err2) throw err2;
        const clearedByCourse = rows.reduce((acc, r) => {
          acc[r.course_id] = r.cleared_levels || 0;
          return acc;
        }, {});

        const progressByCourse = courses.reduce((acc, c) => {
          const cleared = clearedByCourse[c.id] || 0;
          const total = c.levels || 0;
          const pct = total > 0 ? Math.round((cleared / total) * 100) : 0;
          acc[c.id] = Math.max(0, Math.min(100, pct));
          return acc;
        }, {});

        res.render("student_dashboard", { user: req.session.user, courses, progressByCourse });
      }
    );
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

    db.query("SELECT * FROM course_levels WHERE course_id=? ORDER BY level_number ASC", [courseId], (err, levelRows) => {
      if (err) throw err;

      db.query("SELECT * FROM results WHERE user_id=? AND course_id=?", [req.session.user.id, courseId], (err, results) => {
        if (err) throw err;

        let maxUnlocked = 1;
        let attemptsMap = {};
        let clearedMap = {};

        results.forEach(r => {
          attemptsMap[r.level] = r.attempts;
          // Cleared if score (percentage) is >= 60
          if (r.score >= 60 && r.level >= maxUnlocked) {
            maxUnlocked = r.level + 1;
          }
          if (r.score >= 60) {
            clearedMap[r.level] = true;
          }
        });

        res.render("student_levels", { course, levels: levelRows, maxUnlocked, attemptsMap, clearedMap });
      });
    });
  });
});

app.post("/submit-exam", (req, res) => {
  if (!req.session.user || req.session.user.role !== "student") return res.redirect("/");
  const { course_id, level } = req.body;
  const user_id = req.session.user.id;

  db.query("SELECT * FROM courses WHERE id=?", [course_id], (err, courses) => {
    if (err) throw err;
    const course = courses[0];
    if (!course) return res.send("Course not found");

    const courseName = course.course_name;

    // We should only grade the questions that were actually in the exam
    // The form sends mcq_ID fields, so we can iterate over body keys to find them
    let questionIds = [];
    for (let key in req.body) {
      if (key.startsWith('mcq_')) {
        questionIds.push(key.split('_')[1]);
      }
    }

    if (questionIds.length === 0) {
      return res.send("No questions answered.");
    }

    db.query("SELECT * FROM questions WHERE id IN (?)", [questionIds], (err, questions) => {
      if (err) throw err;

      const totalQuestions = questions.length;
      let correctCount = 0;
      let wrongCount = 0;
      const negativePerWrong = 0.25;

      for (let q of questions) {
        const studentAns = req.body[`mcq_${q.id}`];
        if (studentAns) {
          if (studentAns == q.correct) {
            correctCount += 1;
          } else {
            wrongCount += 1;
          }
        }
      }

      const attemptedCount = correctCount + wrongCount;
      const marksObtained = correctCount - (wrongCount * negativePerWrong);
      const maxMarks = totalQuestions;
      const marksPercentage = maxMarks > 0 ? (marksObtained / maxMarks) * 100 : 0;
      const marksPercentageRounded = Number(marksPercentage.toFixed(2));

      // Pass/Fail based on the same marks-based percentage shown on the result page
      const pass_fail = (marksPercentageRounded >= 60) ? 'Pass' : 'Fail';

      db.query("SELECT * FROM results WHERE user_id=? AND course_id=? AND level=?", [user_id, course_id, level], (err, existing) => {
        if (err) throw err;
        if (existing.length > 0) {
          db.query("UPDATE results SET score=?, attempts=attempts+1, pass_fail=? WHERE user_id=? AND course_id=? AND level=?", [marksPercentageRounded, pass_fail, user_id, course_id, level], err => {
            if (err) throw err;
            res.redirect(`/exam-result/${existing[0].id}?total=${encodeURIComponent(totalQuestions)}&correct=${encodeURIComponent(correctCount)}&wrong=${encodeURIComponent(wrongCount)}&marks=${encodeURIComponent(marksObtained.toFixed(2))}&max=${encodeURIComponent(maxMarks)}&percentage=${encodeURIComponent(marksPercentageRounded.toFixed(2))}`);
          });
        } else {
          db.query("INSERT INTO results (user_id, course_id, level, score, attempts, pass_fail) VALUES (?,?,?,?,?,?)", [user_id, course_id, level, marksPercentageRounded, 1, pass_fail], (err, result) => {
            if (err) throw err;
            res.redirect(`/exam-result/${result.insertId}?total=${encodeURIComponent(totalQuestions)}&correct=${encodeURIComponent(correctCount)}&wrong=${encodeURIComponent(wrongCount)}&marks=${encodeURIComponent(marksObtained.toFixed(2))}&max=${encodeURIComponent(maxMarks)}&percentage=${encodeURIComponent(marksPercentageRounded.toFixed(2))}`);
          });
        }
      });
    });
  });
});

app.get("/exam-result/:result_id", (req, res) => {
  if (!req.session.user) return res.redirect("/");
  const resultId = req.params.result_id;

  const query = `
    SELECT results.*, courses.course_name 
    FROM results 
    JOIN courses ON results.course_id = courses.id 
    WHERE results.id = ? AND results.user_id = ?
  `;

  db.query(query, [resultId, req.session.user.id], (err, rows) => {
    if (err) throw err;
    if (rows.length === 0) return res.send("Result not found");
    res.render("student_exam_result", {
      result: rows[0],
      total: req.query.total || 0,
      correct: req.query.correct || 0,
      wrong: req.query.wrong || 0,
      marks: req.query.marks || 0,
      max: req.query.max || 0,
      percentage: req.query.percentage || 0,
    });
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

    db.query("SELECT * FROM results WHERE user_id=? AND course_id=?", [req.session.user.id, courseId], (err, results) => {
      if (err) throw err;

      let maxUnlocked = 1;
      let alreadyClearedThisLevel = false;
      results.forEach(r => {
        if (r.level === level && r.score >= 60) {
          alreadyClearedThisLevel = true;
        }
        if (r.score >= 60 && r.level >= maxUnlocked) {
          maxUnlocked = r.level + 1;
        }
      });

      if (level > maxUnlocked) return res.redirect(`/student-levels/${courseId}`);
      if (alreadyClearedThisLevel) return res.redirect(`/student-levels/${courseId}`);

      db.query(
        "SELECT * FROM questions WHERE course_id=? AND level=? AND question IS NOT NULL ORDER BY RAND() LIMIT 40",
        [courseId, level],
        (err, mcqQuestions) => {
          if (err) throw err;
          res.render("student_questions", { course, level, mcqQuestions });
        }
      );
    });
  });
});
