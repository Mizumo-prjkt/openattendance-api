/*
 * OpenAttendance API
 * License: <to be declared>
 *
 * 
 */

/*
 * Initialize some components
 */
const express = require('express');
const path = require('path');
const sequelize = require('sequelize');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const app = express();
const bcrypt = require('bcrypt');
const fs = require('fs');
const PORT = 8080;
const mkdirp = require('mkdirp');
const crypto = require('crypto');
const { exec } = require('child_process');


// Initial
let debugMode = false;
let logFilePath;
let argEnv = process.argv.slice(2);

// DebugWriteToFile function
// From @MizProject/Mitra setup.js
// Check if being run by nodemon
if (argenv.includes('--debug')) {
    console.log("Setup is being run with --debug flag.");
    console.log("Which means, its being run in development mode.");
    console.log("Enabling extreme debug logging for development.");
    debugMode = true; // This was a const, changed to let.
    // Now, create the logfile
    const __dayToday = new Date();
    const __timeToday = __dayToday.toLocaleTimeString().replace(/:/g, '-');
    const __dateToday = __dayToday.toLocaleDateString().replace(/\//g, '-');
    // Variable for logfile name should be exposed at runtime so no new file
    // is created every time a log is written to.
    const logFileName = `debug-openattendance-log-server-${__dateToday}_${__timeToday}.log`;
    const logDir = path.join(__dirname, 'data', 'logs');
    mkdirp.sync(logDir); // Ensure the directory exists
    logFilePath = path.join(logDir, logFileName); // Assign to the higher-scoped variable
    fs.writeFileSync(logFilePath, `Debug Log Created on ${__dateToday} at ${__timeToday}\n\n`);
    debugLogWriteToFile(`Debug logging started. Log file: ${logFilePath}`);
}

function debugLogWriteToFile(message) {
    if (debugMode === false) return;
    // Fetch timedate for stamping
    const dayToday = new Date();
    const timeToday = dayToday.toLocaleTimeString();
    const dateToday = dayToday.toLocaleDateString().replace(/\//g, '-');
    const logEntry = `[${dateToday} ${timeToday}] ${message}\n`;
    fs.appendFileSync(logFilePath, logEntry); // logFilePath is now in scope
}

// Override console.log to also write to log file in debug mode
console.error = function(message) {
    const dayToday = new Date();
    const timeToday = dayToday.toLocaleTimeString();
    const dateToday = dayToday.toLocaleDateString().replace(/\//g, '-');
    const logEntry = `[${dateToday} ${timeToday}] ERROR: ${message}\n`;
    if (debugMode) {
        fs.appendFileSync(logFilePath, logEntry);
        process.stdout.write(logEntry);
    } else {
        // In non-debug mode, spit it out to the console only
        process.stdout.write(logEntry);
    }
};

// Also pass the warn to log
console.warn = function(message) {
    const dayToday = new Date();
    const timeToday = dayToday.toLocaleTimeString();
    const dateToday = dayToday.toLocaleDateString().replace(/\//g, '-');
    const logEntry = `[${dateToday} ${timeToday}] WARNING: ${message}\n`;
    if (debugMode) {
        fs.appendFileSync(logFilePath, logEntry);
        process.stdout.write(logEntry);
    } else {
        process.stdout.write(logEntry);
    }
};

// Capture process terminations while on debug
process.on('exit', (code) => {
    debugLogWriteToFile(`Setup process exiting with code: ${code}`);
})

process.on('SIGINT', () => {
    debugLogWriteToFile("Setup process interrupted (SIGINT). Exiting...");
    process.exit(0);
})

process.on('uncaughtException', (err) => {
    debugLogWriteToFile(`Uncaught Exception: ${err.message}`);
    process.exit(1);
});


app.listen(PORT, () => {
    console.log('OpenAttendance API is running...');
    console.log(`API PORT: ${PORT}`);
    console.log(`For developers, please check the documentation...`)
})

// Set the SQLite DB
// We put the DB file in ./database/main.db relative to project root

const dbPath = path.join(__dirname, 'database', 'main.db');
const dbDir = path.dirname(dbPath);

// First, we make sure that this directory exists in the first place
// then we create one if not
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, {recursive: true});
    debugLogWriteToFile('[DB] : Directory for the DB does not exist, we created it!');
}

const dbExists = fs.existsSync(dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error(`Error opening the database ${dbPath}, raw message: ${err.message}`);
        debugLogWriteToFile(`[SQLITE]: Error opening database ${dbPath}: ${err.message}`);
        return; // We cant proceed if we cant access the db in the first place!
    }
    if (!dbExists) {
        console.log('Database not found, recreating new DB from schema')
        debugLogWriteToFile('[SQLITE]: Database not found in directory, creating new database from schema')
        const schemaPath = path.join(__dirname, 'database_schema.sql');
        const schemaSql = fs.readFileSync(schemaPath, 'utf-8');

        db.exec(schemaSql, (execErr) => {
            if (execErr) {
                console.error(`Error Executing schema script: ${execErr.message}`);
                debugLogWriteToFile(`[SQL]: Error executing schema script: ${execErr.message}`);
            } else {
                console.log(`Database Created and initialized sucessfully`);
                debugLogWriteToFile(`[SQL]: DB created and initialized successfully...`)
            }
        });
    } else {
        console.log(`Succssfully connected to db: ${dbPath}`);
        debugLogWriteToFile(`[SQL]: Successfully connected to database: ${dbPath}`);
    }
});

// API Features
app.post('/api/benchmark/sequential-write', (req, res) => {
    const insert = 'INSERT INTO benchmark_test (col_text1, col_text2, col_int1) VALUES (?,?,?)';
    db.run(insert, ["seq_write", `random_text_${Math.random()}`, Math.floor(Math.random() * 1000)], function(err) {
        if (err) {
            res,status(500).json({
                "error": err.message
            })
            debugLogWriteToFile(`[SQL-BENCHMARK: SW] : Benchmark Sequential write extreme fail. Error: ${err.message}`);
            return console.error(err.message);
        }
        res.json({
            message: "success",
            id: this.lastID
        });
    });
});

app.post('/api/benchmark/bulk-write', (req, res) => {
    const records = req.body.records;
    if (!records || Array.isArray(records)) {
        return res.status(400).json({
            error: "Invalid Payload, 'records' array not found..."
        })
    }
    const insert = db.prepare('INSERT INTO benchmark_test (col_text1, col_text2, col_int1) VALUES (?,?,?)');
    db.serialize(() => {
        debugLogWriteToFile("[SQL-BW]: BEGIN TRANSACTION");
        db.run("BEGIN TRANSACTION!!!");
        records.forEach(record => {
            
        })
    })
})