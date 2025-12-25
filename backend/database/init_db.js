const db = require('./db');
const bcrypt = require('bcrypt');

const initDb = () => {
    db.serialize(() => {
        // 1. Groups Table
        db.run(`CREATE TABLE IF NOT EXISTS groups (
            gid INTEGER PRIMARY KEY AUTOINCREMENT,
            group_name VARCHAR(50) UNIQUE CHECK(length(group_name) <= 50 AND group_name NOT GLOB '*[^a-zA-Z0-9 ]*'),
            score INTEGER DEFAULT 0 CHECK(score BETWEEN 0 AND 1000),
            failed_count INTEGER DEFAULT 0 CHECK(failed_count BETWEEN 0 AND 1000),
            completed_count INTEGER DEFAULT 0 CHECK(completed_count BETWEEN 0 AND 1000),
            in_progress_count INTEGER DEFAULT 0 CHECK(in_progress_count BETWEEN 0 AND 1000)
        )`);

        // 2. Users Table
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            full_name VARCHAR(30) NOT NULL CHECK(length(full_name) <= 30 AND full_name NOT GLOB '*[^a-zA-Z ]*'),
            role TEXT CHECK(role IN ('LEADER', 'TEACHER', 'NORMAL')),
            gid INTEGER,
            job VARCHAR(20) CHECK(length(job) <= 20 AND job NOT GLOB '*[^A-Z_-]*'),
            email VARCHAR(40) NOT NULL UNIQUE CHECK(length(email) <= 40),
            phone CHAR(10) CHECK(length(phone) = 10 AND (phone GLOB '05*' OR phone GLOB '06*') AND phone NOT GLOB '*[^0-9]*'),
            password TEXT NOT NULL,
            FOREIGN KEY (gid) REFERENCES groups(gid),
            CHECK(role != 'TEACHER' OR gid IS NULL)
        )`);

        // 3. Tasks Table
        db.run(`CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title VARCHAR(100) NOT NULL,
            description TEXT,
            maker VARCHAR(50),
            criticality TEXT CHECK(criticality IN ('high', 'med', 'low')),
            gid INTEGER,
            status TEXT CHECK(status IN ('NOT_STARTED', 'in-progress', 'completed', 'failed')),
            start_time DATETIME,
            end_time DATETIME,
            FOREIGN KEY (gid) REFERENCES groups(gid)
        )`);

        // 4. Login Tracking Table
        db.run(`CREATE TABLE IF NOT EXISTS login (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ip_address VARCHAR(45) NOT NULL,
            mac_address VARCHAR(17),
            attempt_count INTEGER DEFAULT 0,
            last_status TEXT CHECK(last_status IN ('LOGIN', 'FAILED', 'BLOCKED')),
            start_block DATETIME,
            end_block DATETIME,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
            if (err) {
                console.error("Error creating login table:", err.message);
            } else {
                console.log("Database tables initialized.");

                // 5. Seed Default Admin
                const checkSql = "SELECT id FROM users WHERE email = 'teacher@test.com'";
                db.get(checkSql, (err, row) => {
                    if (err) console.error(err.message);
                    if (!row) {
                        const password = 'password123';
                        bcrypt.hash(password, 10, (err, hash) => {
                            if (err) return console.error("Error hashing default password:", err);
                            const insertSql = `INSERT INTO users (full_name, email, job, role, phone, password) 
                                              VALUES ('Default User', 'teacher@test.com', 'SYS_ADMIN', 'TEACHER', '0500000000', ?)`;
                            db.run(insertSql, [hash], (err) => {
                                if (err) console.error("Error creating default admin:", err.message);
                                else console.log("Default admin created: teacher@test.com");
                            });
                        });
                    }
                });
            }
        });
    });
};

module.exports = initDb;
