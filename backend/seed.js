const db = require('./database/db');
const bcrypt = require('bcrypt');

const seed = () => {
    console.log("Starting seeding process...");

    db.serialize(() => {
        // 1. Seed Groups
        const groups = ['Alpha Team', 'Beta Squad', 'Gamma Cell'];
        const groupStmt = db.prepare("INSERT OR IGNORE INTO groups (group_name) VALUES (?)");

        groups.forEach(name => {
            groupStmt.run(name, (err) => {
                if (err) console.error(`Error inserting group ${name}:`, err.message);
            });
        });
        groupStmt.finalize();
        console.log("Groups seeded (if not existing).");

        // 2. Seed Admin User
        const password = 'password123';
        const saltRounds = 10;

        bcrypt.hash(password, saltRounds, (err, hash) => {
            if (err) {
                console.error("Error hashing password:", err);
                return;
            }

            // check constraints: 
            // full_name: alpha only (space allowed)
            // job: A-Z, _, - only
            // phone: 05... or 06... 10 digits

            const sql = `INSERT OR IGNORE INTO users (full_name, email, job, role, phone, password) 
                         VALUES ('System Admin', 'admin@injaz.com', 'SYS_ADMIN', 'TEACHER', '0500000000', ?)`;

            db.run(sql, [hash], function (err) {
                if (err) {
                    console.error("Error seeding admin:", err.message);
                } else if (this.changes > 0) {
                    console.log("Admin user created.");
                    console.log("Credentials -> Email: admin@injaz.com | Password: password123");
                } else {
                    console.log("Admin user already exists.");
                }
            });
        });
    });
};

// Wait a moment for DB connection if needed, though db.js usually connects immediately
setTimeout(seed, 1000);
