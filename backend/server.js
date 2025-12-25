require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const db = require('./database/db');
const initDb = require('./database/init_db');
const bcrypt = require('bcrypt');

const jwt = require('jsonwebtoken');
const SECRET_KEY = process.env.SECRET_KEY || 'your-secret-key'; // In prod, use .env

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Database Tables
initDb();

// Security Middleware (Rule 1)
app.use(helmet());
app.use(cors());
app.use(express.json()); // Parse JSON bodies

// Global Request Logger
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});



// Static Files
app.use(express.static(path.join(__dirname, '../frontend')));

// Authentication Middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) {
            console.error('JWT Verification Error:', err);
            return res.status(403).json({ success: false, message: 'Invalid token.' });
        }
        console.log('Decoded JWT User:', user); // DEBUG
        req.user = user;
        next();
    });
};

const verifyTeacher = (req, res, next) => {
    console.log('Checking Role for:', req.user); // DEBUG
    if (req.user.role !== 'TEACHER') {
        console.log('Role Mismatch! Expected TEACHER, got:', req.user.role); // DEBUG
        return res.status(403).json({ success: false, message: 'Access denied. Teachers only.' });
    }
    next();
};

// API Status Endpoint
app.get('/api/status', (req, res) => {
    res.json({
        status: 'active',
        timestamp: new Date(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// Add New Member Endpoint
app.post('/api/users/add', authenticateToken, verifyTeacher, (req, res) => {
    console.log('Received Add User Request Body:', req.body); // DEBUG
    const { fullName, email, job, gid, role } = req.body; // Role added

    // Basic Validation
    if (!fullName || !email || !job || !gid) {
        console.error('Validation Failed: Missing fields'); // DEBUG
        return res.status(400).json({ success: false, message: 'All fields are required.' });
    }

    // Role Validation
    const validRoles = ['NORMAL', 'LEADER'];
    const userRole = (role && validRoles.includes(role)) ? role : 'NORMAL';

    // DB Constraints Handling
    const formattedJob = job.toUpperCase().replace(/\s+/g, '_');

    // Strict Name Check (Matches DB: CHECK(length(full_name) <= 30 AND full_name NOT GLOB '*[^a-zA-Z ]*'))
    if (fullName.length > 30) {
        return res.status(400).json({ success: false, message: 'Name must be 30 characters or less.' });
    }
    if (!/^[a-zA-Z ]+$/.test(fullName)) {
        return res.status(400).json({ success: false, message: 'Name must contain only letters and spaces.' });
    }

    // Strict Job Check (Matches DB: CHECK(length(job) <= 20 AND job NOT GLOB '*[^A-Z_-]*'))
    if (formattedJob.length > 20) {
        return res.status(400).json({ success: false, message: 'Job title too long (max 20 chars).' });
    }
    if (/[^A-Z_-]/.test(formattedJob)) {
        return res.status(400).json({ success: false, message: 'Job title contains invalid characters (only A-Z, _, - allowed).' });
    }

    // Strict Email Check (Matches DB: CHECK(length(email) <= 40))
    if (email.length > 40) {
        return res.status(400).json({ success: false, message: 'Email must be 40 characters or less.' });
    }

    const defaultPassword = 'password123';

    bcrypt.hash(defaultPassword, 10, (err, hash) => {
        if (err) {
            console.error('Bcrypt Error:', err);
            return res.status(500).json({ success: false, message: 'Error securing password.' });
        }

        // Updated SQL to include Role
        const sql = `INSERT INTO users (full_name, email, job, role, gid, password) VALUES (?, ?, ?, ?, ?, ?)`;

        db.run(sql, [fullName, email, formattedJob, userRole, gid, hash], function (err) {
            if (err) {
                console.error('Insert User Error:', err);
                if (err.message.includes('UNIQUE') || (err.message.includes('unique'))) {
                    return res.status(400).json({ success: false, message: 'Email already exists.' });
                }
                if (err.message.includes('CHECK constraint')) {
                    // Fallback for any other constraint missed by pre-validation
                    return res.status(400).json({ success: false, message: `Database rule violation: ${err.message}` });
                }
                return res.status(500).json({ success: false, message: 'Database error adding user.' });
            }

            res.json({ success: true, message: 'User added successfully.', userId: this.lastID });
        });
    });
});

// Update User Endpoint
app.put('/api/users/:id', authenticateToken, verifyTeacher, (req, res) => {
    const userId = req.params.id;
    const { fullName, email, job, gid, role } = req.body;

    // Default to NORMAL if role invalid/missing, unless logic dictates otherwise
    const userRole = (role === 'LEADER' || role === 'TEACHER') ? role : 'NORMAL';

    // 1. Strict Validation (Mirror of Add User)
    const formattedJob = job.toUpperCase().replace(/\s+/g, '_'); // Auto-format job

    // Strict Name Check
    if (!/^[a-zA-Z ]+$/.test(fullName)) {
        return res.status(400).json({ success: false, message: 'Name must contain only letters and spaces.' });
    }
    if (fullName.length > 30) {
        return res.status(400).json({ success: false, message: 'Name must be 30 characters or less.' });
    }

    // Strict Job Check
    if (formattedJob.length > 20) {
        return res.status(400).json({ success: false, message: 'Job title too long (max 20 chars).' });
    }
    if (/[^A-Z_-]/.test(formattedJob)) {
        return res.status(400).json({ success: false, message: 'Job title contains invalid characters (only A-Z, _, - allowed).' });
    }

    // Strict Email Check
    if (email.length > 40) {
        return res.status(400).json({ success: false, message: 'Email must be 40 characters or less.' });
    }

    // 2. Perform Update
    const sql = `UPDATE users SET full_name = ?, email = ?, job = ?, role = ?, gid = ? WHERE id = ?`;

    db.run(sql, [fullName, email, formattedJob, userRole, gid, userId], function (err) {
        if (err) {
            console.error('Update User Error:', err);
            if (err.message.includes('UNIQUE') || (err.message.includes('unique'))) {
                return res.status(400).json({ success: false, message: 'Email already exists.' });
            }
            if (err.message.includes('CHECK constraint')) {
                return res.status(400).json({ success: false, message: `Database rule violation: ${err.message}` });
            }
            return res.status(500).json({ success: false, message: 'Database error updating user.' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }
        res.json({ success: true, message: 'User updated successfully.' });
    });
});

// Delete User Endpoint
app.delete('/api/users/:id', authenticateToken, verifyTeacher, (req, res) => {
    const userId = req.params.id;
    console.log(`Request to delete user ID: ${userId}`);

    db.run(`DELETE FROM users WHERE id = ?`, [userId], function (err) {
        if (err) {
            console.error('Delete User Error:', err);
            return res.status(500).json({ success: false, message: 'Database error deleting user.' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }
        res.json({ success: true, message: 'User deleted successfully.' });
    });
});

// --- Profile Endpoints ---

// Get Own Profile
app.get('/api/profile', authenticateToken, (req, res) => {
    const userId = req.user.id;
    const sql = `SELECT id, full_name, email, phone as phone_number, role, gid FROM users WHERE id = ?`;

    db.get(sql, [userId], (err, row) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        if (!row) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        res.json({ success: true, user: row });
    });
});

// Update Own Profile
app.put('/api/profile', authenticateToken, (req, res) => {
    const userId = req.user.id;
    const { full_name, email, phone_number } = req.body;

    if (!full_name || !email) {
        return res.status(400).json({ success: false, message: 'Name and Email are required.' });
    }

    const sql = `UPDATE users SET full_name = ?, email = ?, phone = ? WHERE id = ?`;

    db.run(sql, [full_name, email, phone_number, userId], function (err) {
        if (err) {
            console.error('Update profile error:', err);
            if (err.message.includes('UNIQUE') || err.message.includes('unique')) {
                return res.status(400).json({ success: false, message: 'Email already in use.' });
            }
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        res.json({ success: true, message: 'Profile updated successfully.' });
    });
});

// Change Password Endpoint
app.put('/api/profile/password', authenticateToken, (req, res) => {
    const userId = req.user.id;
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
        return res.status(400).json({ success: false, message: 'Old and New passwords are required.' });
    }

    // 1. Get current password hash
    db.get('SELECT password FROM users WHERE id = ?', [userId], (err, user) => {
        if (err) return res.status(500).json({ success: false, message: 'Database error' });
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        // 2. Verify Old Password
        bcrypt.compare(oldPassword, user.password, (err, isMatch) => {
            if (err) return res.status(500).json({ success: false, message: 'Error verifying password' });
            if (!isMatch) return res.status(401).json({ success: false, message: 'Incorrect old password.' });

            // 3. Hash New Password
            bcrypt.hash(newPassword, 10, (err, hash) => {
                if (err) return res.status(500).json({ success: false, message: 'Error hashing password' });

                // 4. Update Password
                db.run('UPDATE users SET password = ? WHERE id = ?', [hash, userId], (err) => {
                    if (err) return res.status(500).json({ success: false, message: 'Database update error' });
                    res.json({ success: true, message: 'Password changed successfully.' });
                });
            });
        });
    });
});

// Login Endpoint
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    // Get IP (handle proxies if needed, simplify for now)
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const now = new Date();

    // 1. Check for Active Block
    db.get(
        `SELECT * FROM login WHERE ip_address = ? AND last_status = 'BLOCKED' AND end_block > ? ORDER BY id DESC LIMIT 1`,
        [ip, now.toISOString()],
        (err, blockRow) => {
            if (err) {
                console.error('Rate Limit Check Error:', err);
                return res.status(500).json({ success: false, message: 'Internal server error' });
            }

            if (blockRow) {
                const endDate = new Date(blockRow.end_block);
                const diffMs = endDate - now;
                const minutesLeft = Math.ceil(diffMs / 60000);
                return res.status(429).json({
                    success: false,
                    message: `Too many failed attempts. Try again in ${minutesLeft} minute(s).`
                });
            }

            // 2. Proceed with Credential Verification
            db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
                if (err) {
                    console.error(err);
                    return res.status(500).json({ success: false, message: 'Internal server error' });
                }

                // Function to Handle Failed Attempt
                const handleFailedAttempt = () => {
                    // Check previous attempts
                    // We look for the most recent log for this IP to increment count
                    // We only care about the sequence of recent failures.
                    // A simple heuristic: Get the latest login record for this IP.
                    // If it was FAILED or BLOCKED and recent (< 10 mins?), increment count. Else set to 1.

                    db.get(`SELECT * FROM login WHERE ip_address = ? ORDER BY id DESC LIMIT 1`, [ip], (err, lastLog) => {
                        let newCount = 1;
                        // If last log was recent and failed/blocked, increment
                        // "Recent" definition: let's say 1 hour to allow the backoff to be effective
                        if (lastLog && (lastLog.last_status === 'FAILED' || lastLog.last_status === 'BLOCKED')) {
                            const lastTime = new Date(lastLog.timestamp);
                            // If within 24 hours keep incrementing? Or reset?
                            // User said "time going multiple", implies persistent track.
                            // Let's reset if successful login happens. If just failures, keep counting.
                            newCount = (lastLog.attempt_count || 0) + 1;
                        }

                        let status = 'FAILED';
                        let startBlock = null;
                        let endBlock = null;

                        // BLOCK LOGIC
                        if (newCount >= 3) {
                            status = 'BLOCKED';
                            // 3 -> 1 min, 4 -> 2 min, 5 -> 4 min...
                            // Math.pow(2, 3-3) = 1 min
                            // Math.pow(2, 4-3) = 2 min
                            const power = newCount - 3;
                            const blockMinutes = Math.pow(2, power);

                            startBlock = new Date().toISOString();
                            endBlock = new Date(new Date().getTime() + blockMinutes * 60000).toISOString();
                        }

                        db.run(
                            `INSERT INTO login (ip_address, attempt_count, last_status, start_block, end_block, timestamp) VALUES (?, ?, ?, ?, ?, ?)`,
                            [ip, newCount, status, startBlock, endBlock, new Date().toISOString()],
                            (err) => {
                                if (err) console.error("Error logging failed attempt:", err);
                            }
                        );
                    });
                };


                if (user) {
                    bcrypt.compare(password, user.password, (err, result) => {
                        if (err) {
                            console.error('Bcrypt Error:', err);
                            return res.status(500).json({ success: false, message: 'Internal server error' });
                        }

                        if (result) {
                            // SUCCESS
                            // 3. Reset Check: Ideally, we insert a 'LOGIN' success record to break the failure chain
                            db.run(
                                `INSERT INTO login (ip_address, attempt_count, last_status, timestamp) VALUES (?, 0, 'LOGIN', ?)`,
                                [ip, new Date().toISOString()]
                            );

                            // Generate Token
                            const token = jwt.sign({ id: user.id, role: user.role, email: user.email, full_name: user.full_name }, SECRET_KEY, { expiresIn: '1h' });
                            return res.json({
                                success: true,
                                role: user.role,
                                gid: user.gid,
                                token: token,
                                message: 'Login successful'
                            });
                        } else {
                            // Password Mismatch
                            handleFailedAttempt();
                            return res.status(401).json({ success: false, message: 'Invalid credentials' });
                        }
                    });
                } else {
                    // User Not Found
                    handleFailedAttempt();
                    return res.status(401).json({ success: false, message: 'Invalid credentials' });
                }
            });
        }
    );
});

// Create Groups Endpoint (Teachers Only)
app.post('/api/groups/create', authenticateToken, verifyTeacher, (req, res) => {
    const { groupNames } = req.body;

    if (!groupNames || !Array.isArray(groupNames) || groupNames.length === 0) {
        return res.status(400).json({ success: false, message: 'No group names provided.' });
    }

    let successCount = 0;
    let errors = [];

    // Using serialize to ensure sequential execution (optional but good for tracking)
    db.serialize(() => {
        const stmt = db.prepare(`INSERT INTO groups (group_name) VALUES (?)`);

        groupNames.forEach(name => {
            // Validation (Backend redundancy for security)
            if (!/^[a-zA-Z0-9 ]+$/.test(name)) {
                errors.push(`Invalid name: "${name}"`);
                return;
            }

            stmt.run(name, function (err) {
                if (err) {
                    if (err.message.includes('UNIQUE constraint failed')) {
                        errors.push(`Start: "${name}" already exists.`);
                    } else {
                        errors.push(`Failed: "${name}"`);
                    }
                } else {
                    successCount++;
                }
            });
        });

        stmt.finalize(() => {
            // This callback runs after all insertions are queued/done? 
            // Actually finalizing is async. We might need to wrap in a promise or wait.
            // But db.serialize doesn't wait for async callbacks inside.

            // Better approach for Express response:
            // Since sqlite3 is async callback based, doing a loop is tricky for valid response.
            // We'll respond optimistically or use Promise.all wrap (if using sqlite-async, but we have sqlite3).
            // A simple way for sqlite3:

            setTimeout(() => {
                // Return result after short delay to allow DB ops to likely finish. 
                // This is a hack but works for small batches. 
                // A better way is counting callbacks.
                if (successCount > 0) {
                    return res.json({ success: true, message: `Created ${successCount} groups.` });
                } else {
                    return res.status(400).json({ success: false, message: errors.join(', ') || 'Failed to create groups.' });
                }
            }, 500);
        });
    });
});

// Groups Endpoint (Public for reading count, can be secured if needed)
app.get('/api/groups', (req, res) => {
    const sql = `
        SELECT 
            g.gid as id, 
            g.group_name as name, 
            g.score,
            COUNT(DISTINCT u.id) as count,
            (SELECT COUNT(*) FROM tasks t WHERE t.gid = g.gid AND t.status = 'completed') as completed_count,
            (SELECT COUNT(*) FROM tasks t WHERE t.gid = g.gid AND t.status = 'in-progress') as in_progress_count,
            (SELECT COUNT(*) FROM tasks t WHERE t.gid = g.gid AND t.status = 'failed') as failed_count 
        FROM groups g 
        LEFT JOIN users u ON g.gid = u.gid 
        GROUP BY g.gid
    `;
    db.all(sql, [], (err, rows) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        res.json(rows);
    });
});

// Bulk Delete Groups Endpoint (Secured: Teachers Only)
app.post('/api/groups/delete', authenticateToken, verifyTeacher, (req, res) => {
    const { groupIds } = req.body;

    if (!groupIds || !Array.isArray(groupIds) || groupIds.length === 0) {
        return res.status(400).json({ success: false, message: 'No groups selected' });
    }

    // Using a transaction-like approach (Sequentially for sqlite)
    db.serialize(() => {
        const placeholders = groupIds.map(() => '?').join(',');

        // 1. Delete Users in these groups
        db.run(`DELETE FROM users WHERE gid IN (${placeholders})`, groupIds, function (err) {
            if (err) {
                console.error(err);
                return res.status(500).json({ success: false, message: 'Failed to delete group members' });
            }

            // 2. Delete Groups
            db.run(`DELETE FROM groups WHERE gid IN (${placeholders})`, groupIds, function (err) {
                if (err) {
                    console.error(err);
                    return res.status(500).json({ success: false, message: 'Failed to delete groups' });
                }

                res.json({
                    success: true,
                    message: `Successfully deleted ${this.changes} groups and their members.`
                });
            });
        });
    });
});




// Get Users Endpoint (for Managed Teams)
// Get Users Endpoint (for Managed Teams)
app.get('/api/users', (req, res) => {
    // Select users and their group names, excluding sensitive info like password
    const sql = `
        SELECT u.id, u.full_name as name, u.job, u.phone, u.email, u.role, u.gid, g.group_name as "group"
        FROM users u
        LEFT JOIN groups g ON u.gid = g.gid
        WHERE u.role != 'TEACHER'
    `;
    db.all(sql, [], (err, rows) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        res.json(rows);
    });
});

// Tasks Endpoint
// Tasks Endpoint
app.get('/api/tasks', (req, res) => {
    const { gid } = req.query;
    let sql = `
        SELECT t.*, u.full_name as maker_name 
        FROM tasks t 
        LEFT JOIN users u ON t.maker = u.id
    `;
    const params = [];

    if (gid && gid !== 'all') {
        sql += ` WHERE t.gid = ?`;
        params.push(gid);
    }

    db.all(sql, params, (err, rows) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ success: false, message: 'Database error' });
        }

        // Transform for frontend matches (camelCase)
        const tasks = rows.map(t => ({
            id: t.id,
            title: t.title,
            description: t.description,
            maker_name: t.maker_name, // Include maker name
            criticality: t.criticality,
            status: t.status,
            createdAt: t.start_time,
            deadline: t.end_time,
            group: t.gid // Send GID as group identifier
        }));

        res.json(tasks);
    });
});

// Seed Tasks
const seedTasks = () => {
    db.get("SELECT COUNT(*) as count FROM tasks", (err, row) => {
        if (err) return console.error("Error checking tasks:", err);
        if (row.count === 0) {
            console.log("Seeding tasks...");
            // Get Groups to assign
            db.all("SELECT gid FROM groups LIMIT 3", (err, groups) => {
                if (err || !groups || groups.length === 0) {
                    // Try to create at least one group if none exist? 
                    // Or just skip. If init_db ran, groups might be empty initially until seeded or created.
                    console.log("No groups found to seed tasks. Skipping.");
                    return;
                }

                const tasks = [
                    {
                        title: "[DB] Database Schema",
                        description: "Design and implement the initial user schema with role-based access control.",
                        criticality: "high",
                        status: "in-progress",
                        createdAt: "2024-12-10T09:00:00",
                        deadline: "2024-12-25T17:00:00",
                        gid: groups[0].gid
                    },
                    {
                        title: "[DB] API Authentication",
                        description: "Implement JWT authentication flow and secure all protected routes.",
                        criticality: "high",
                        status: "in-progress",
                        createdAt: "2024-12-12T10:30:00",
                        deadline: "2024-12-20T12:00:00",
                        gid: groups[1] ? groups[1].gid : groups[0].gid
                    },
                    {
                        title: "[DB] Frontend Dashboard",
                        description: "Create the main dashboard layout with glassmorphism effects and responsive design.",
                        criticality: "med",
                        status: "in-progress",
                        createdAt: "2024-12-14T14:00:00",
                        deadline: "2025-01-05T09:00:00",
                        gid: groups[0].gid
                    },
                    {
                        title: "[DB] Unit Testing",
                        description: "Write unit tests for the user registration and login services.",
                        criticality: "low",
                        status: "in-progress",
                        createdAt: "2024-12-15T11:00:00",
                        deadline: "2025-01-10T17:00:00",
                        gid: groups[2] ? groups[2].gid : groups[0].gid
                    },
                    {
                        title: "[DB] Legacy Code Cleanup",
                        description: "Remove deprecated API v1 endpoints.",
                        criticality: "low",
                        status: "completed",
                        createdAt: "2024-11-01T09:00:00",
                        deadline: "2024-11-10T17:00:00",
                        gid: groups[1] ? groups[1].gid : groups[0].gid
                    },
                    {
                        title: "[DB] Overdue Audit",
                        description: "This task should be hidden because it is expired.",
                        criticality: "high",
                        status: "in-progress",
                        createdAt: "2024-11-01T09:00:00",
                        deadline: "2024-11-15T17:00:00",
                        gid: groups[0].gid
                    }
                ];

                const stmt = db.prepare("INSERT INTO tasks (title, description, criticality, status, start_time, end_time, gid) VALUES (?, ?, ?, ?, ?, ?, ?)");
                tasks.forEach(t => {
                    stmt.run(t.title, t.description, t.criticality, t.status, t.createdAt, t.deadline, t.gid);
                });
                stmt.finalize();
                console.log("Tasks seeded.");
            });
        }
    });
};

// Check and seed after a delay to ensure tables exist
setTimeout(seedTasks, 2000);

// Start Server with TLS (HTTPS)
const fs = require('fs');
const https = require('https');

// Load SSL Certificates
// NOTE: For "Real" HTTPS in production, replace these with files from a CA (like Let's Encrypt)
const httpsOptions = {
    key: fs.readFileSync(path.join(__dirname, 'certs/server.key')),
    cert: fs.readFileSync(path.join(__dirname, 'certs/server.cert'))
};

https.createServer(httpsOptions, app).listen(PORT, () => {
    console.log(`Secure Server (HTTPS) is running on https://localhost:${PORT}`);
});

// Create Task Endpoint (Teachers Only)
app.post('/api/tasks/create', authenticateToken, verifyTeacher, (req, res) => {
    const { title, description, criticality, end_time, gids } = req.body;
    let { status, start_time } = req.body;
    let maker = req.user.id; // Store User ID

    // Set Defaults
    if (!status) status = 'NOT_STARTED';
    if (!start_time) start_time = new Date().toISOString();

    // 1. Validation
    if (!title || !description || !criticality || !end_time || !gids || !Array.isArray(gids) || gids.length === 0) {
        return res.status(400).json({ success: false, message: 'All fields are required.' });
    }

    // Strict Alphabet, Space, @, -, _ Check
    if (!/^[a-zA-Z@\-_ ]+$/.test(title)) {
        return res.status(400).json({ success: false, message: 'Title contains invalid characters.' });
    }
    if (!/^[a-zA-Z@\-_ ]+$/.test(description)) {
        return res.status(400).json({ success: false, message: 'Description contains invalid characters.' });
    }

    // 2. Insert for each Group
    let successCount = 0;

    db.serialize(() => {
        const stmt = db.prepare("INSERT INTO tasks (title, description, maker, criticality, status, start_time, end_time, gid) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");

        gids.forEach(gid => {
            stmt.run(title, description, maker, criticality, status, start_time, end_time, gid, function (err) {
                if (err) {
                    console.error("Task Insert Error:", err);
                } else {
                    successCount++;
                }
            });
        });

        stmt.finalize(() => {
            // Delay response to allow async inserts to complete
            setTimeout(() => {
                if (successCount > 0) {
                    res.json({ success: true, message: `Task created for ${successCount} groups.` });
                } else {
                    res.status(500).json({ success: false, message: 'Failed to create tasks.' });
                }
            }, 500);
        });
    });
});


// Get Single Task Endpoint
app.get('/api/tasks/:id', authenticateToken, (req, res) => {
    const taskId = req.params.id;
    const sql = `SELECT t.*, u.full_name as maker_name FROM tasks t LEFT JOIN users u ON t.maker = u.id WHERE t.id = ?`;

    db.get(sql, [taskId], (err, row) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        if (!row) {
            return res.status(404).json({ success: false, message: 'Task not found' });
        }

        // Transform
        const task = {
            id: row.id,
            title: row.title,
            description: row.description,
            maker_name: row.maker_name,
            criticality: row.criticality,
            status: row.status,
            createdAt: row.start_time,
            deadline: row.end_time,
            groups: [row.gid] // Return as array for frontend compatibility
        };

        res.json(task);
    });
});

// Update Task Endpoint
app.put('/api/tasks/:id', authenticateToken, verifyTeacher, (req, res) => {
    const taskId = req.params.id;
    const { title, description, criticality, status, deadline, groups } = req.body;
    // Frontend sends 'deadline', DB uses 'end_time'

    if (!title || !description || !criticality || !deadline) {
        return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    // Normalize Status for DB Constraint
    let dbStatus = status;
    // status is now expected to be correct from frontend

    // Strict Validation (Match Create Logic)
    if (!/^[a-zA-Z@\-_ ]+$/.test(title)) {
        return res.status(400).json({ success: false, message: 'Title contains invalid characters.' });
    }
    if (!/^[a-zA-Z@\-_ ]+$/.test(description)) {
        return res.status(400).json({ success: false, message: 'Description contains invalid characters.' });
    }

    // Default: update the current task
    const sql = `UPDATE tasks SET title = ?, description = ?, criticality = ?, status = ?, end_time = ? WHERE id = ?`;
    const params = [title, description, criticality, dbStatus || 'NOT_STARTED', deadline, taskId];

    db.run(sql, params, function (err) {
        if (err) {
            console.error("Update Task Error:", err);
            // Check for specific constraint errors
            if (err.message.includes('CHECK constraint failed')) {
                return res.status(500).json({ success: false, message: `Database contraint failed: ${err.message}` });
            }
            return res.status(500).json({ success: false, message: 'Database error updating task' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ success: false, message: 'Task not found' });
        }

        // Handle Group Re-assignment / Expansion
        try {
            // Serialize the operations to ensure avoiding races and send response after
            const finish = () => {
                console.log("Sending Success Response");
                if (!res.headersSent) {
                    res.json({ success: true, message: 'Task updated successfully.' });
                }
            };

            if (groups && Array.isArray(groups) && groups.length > 0) {
                const primaryGid = groups[0];
                const otherGids = groups.slice(1);

                db.serialize(() => {
                    // 1. Update Primary GID
                    db.run(`UPDATE tasks SET gid = ? WHERE id = ?`, [primaryGid, taskId], (err) => {
                        if (err) console.error("Error updating Group ID:", err);
                    });

                    // 2. Create Copies (if any)
                    if (otherGids.length > 0) {
                        const maker = req.user ? req.user.id : 'system'; // Handled safely
                        const start_time = new Date().toISOString();

                        // Prepare simple insert for copies
                        const stmt = db.prepare("INSERT INTO tasks (title, description, maker, criticality, status, start_time, end_time, gid) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
                        otherGids.forEach(gid => {
                            stmt.run(title, description, maker, criticality, dbStatus || 'NOT_STARTED', start_time, deadline, gid, (err) => {
                                if (err) console.error("Error inserting copy for gid " + gid, err);
                            });
                        });
                        stmt.finalize();
                    }

                    // Safe way in sqlite3 for response after operations:
                    db.run("SELECT 1", [], () => {
                        finish();
                    });
                });
            } else {
                finish();
            }
        } catch (innerError) {
            console.error("Critical Error in Edit Task Callback:", innerError);
            if (!res.headersSent) {
                res.status(500).json({ success: false, message: 'Internal Server Error during group update' });
            }
        }
    });
});

// Delete Task Endpoint
app.delete('/api/tasks/:id', authenticateToken, verifyTeacher, (req, res) => {
    const taskId = req.params.id;

    db.run("DELETE FROM tasks WHERE id = ?", [taskId], function (err) {
        if (err) {
            console.error("Delete Task Error:", err);
            return res.status(500).json({ success: false, message: 'Database error deleting task.' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ success: false, message: 'Task not found.' });
        }
        res.json({ success: true, message: 'Task deleted successfully.' });
    });
});

// Update Task Status Only (For Leaders/Teachers)
app.put('/api/tasks/:id/status', authenticateToken, (req, res) => {
    const taskId = req.params.id;
    const { status } = req.body;

    // Validate Status
    const validStatuses = ['NOT_STARTED', 'in-progress', 'completed', 'failed'];
    // helper to normalize input
    let dbStatus = status;
    // status is now expected to be correct from frontend

    if (!validStatuses.includes(dbStatus)) {
        return res.status(400).json({ success: false, message: 'Invalid status value.' });
    }

    // Check Permissions and Get Task Details
    db.get('SELECT gid, criticality, status FROM tasks WHERE id = ?', [taskId], (err, task) => {
        if (err) return res.status(500).json({ success: false, message: 'Database error.' });
        if (!task) return res.status(404).json({ success: false, message: 'Task not found.' });

        if (req.user.role === 'LEADER') {
            // Verify Leader's Group
            db.get('SELECT gid FROM users WHERE id = ?', [req.user.id], (err, user) => {
                if (err || !user) return res.status(500).json({ success: false, message: 'User data error.' });

                if (user.gid !== task.gid) {
                    return res.status(403).json({ success: false, message: 'You can only update tasks assigned to your group.' });
                }

                performStatusUpdate(dbStatus, task);
            });
        } else if (req.user.role === 'TEACHER') {
            performStatusUpdate(dbStatus, task);
        } else {
            return res.status(403).json({ success: false, message: 'Unauthorized.' });
        }
    });

    function performStatusUpdate(newStatus, task) {
        let params = [newStatus, taskId];

        // Optimize: Use serialize to ensure Score update happens if status update succeeds (or slightly before/after)
        // Since we want atomicity, strict usage would require transactions, but db.serialize handles sequence.

        db.serialize(() => {
            db.run(`UPDATE tasks SET status = ? WHERE id = ?`, params, function (err) {
                if (err) {
                    console.error("Status Update Error:", err);
                    return res.status(500).json({ success: false, message: 'Failed to update status.' });
                }

                // Check for Completion Scoring
                if (newStatus === 'completed' && task.status !== 'completed') {
                    let points = 1;
                    if (task.criticality === 'high') points = 10;
                    else if (task.criticality === 'med') points = 5;
                    else if (task.criticality === 'low') points = 1;

                    // Update Group Score
                    // Use MIN to ensure we don't exceed 1000 (DB Check Constraint)
                    const scoreSql = `
                        UPDATE groups 
                        SET score = MIN(score + ?, 1000), 
                            completed_count = MIN(completed_count + 1, 1000)
                        WHERE gid = ?
                    `;

                    db.run(scoreSql, [points, task.gid], (err) => {
                        if (err) console.error("Error updating group score:", err);
                        // We respond success even if score update fails (non-critical functionality fallback?)
                        // Or we can log it. The task status IS updated.
                    });
                }

                res.json({ success: true, message: 'Status updated successfully.' });
            });
        });
    }
});
