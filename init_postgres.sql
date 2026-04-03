CREATE TABLE IF NOT EXISTS courses (
    id SERIAL PRIMARY KEY,
    course_name VARCHAR(100) NOT NULL,
    levels INT DEFAULT 1
);

CREATE TABLE IF NOT EXISTS course_levels (
    id SERIAL PRIMARY KEY,
    course_id INT REFERENCES courses(id) ON DELETE CASCADE,
    level_number INT,
    level_name VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    needs_password_setup INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS teacher_courses (
    id SERIAL PRIMARY KEY,
    teacher_id INT REFERENCES users(id) ON DELETE CASCADE,
    course_id INT REFERENCES courses(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending',
    UNIQUE (teacher_id, course_id)
);

CREATE TABLE IF NOT EXISTS questions (
    id SERIAL PRIMARY KEY,
    question TEXT,
    option1 VARCHAR(100),
    option2 VARCHAR(100),
    option3 VARCHAR(100),
    option4 VARCHAR(100),
    correct INT,
    coding_question TEXT,
    starter_code TEXT,
    course_id INT REFERENCES courses(id) ON DELETE CASCADE,
    level INT DEFAULT 1,
    topic VARCHAR(255),
    teacher_id INT REFERENCES users(id),
    test_cases TEXT
);

CREATE TABLE IF NOT EXISTS results (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    score NUMERIC,
    course_id INT REFERENCES courses(id) ON DELETE CASCADE,
    level INT DEFAULT 1,
    attempts INT DEFAULT 0,
    pass_fail VARCHAR(10) DEFAULT 'Pending'
);

CREATE TABLE IF NOT EXISTS password_reset_requests (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    requested_by_role VARCHAR(50),
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
