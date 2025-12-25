const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Rule 2: Hosting - Use absolute path or env var for DB location
const dbPath = process.env.DB_PATH || path.join(__dirname, 'app.db');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database ' + dbPath + ': ' + err.message);
    } else {
        console.log('Connected to the SQLite database.');
    }
});

module.exports = db;
