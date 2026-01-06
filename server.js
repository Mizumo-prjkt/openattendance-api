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
const e = require('express');
const { DESTRUCTION } = require('dns');


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

// [SQL-BENCHMARK: SW]
// We sequential write test
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
        debugLogWriteToFile(`[SQL-BENCHMARK: SW]: Benchmark Sequential write success!`)
        res.json({
            message: "success",
            id: this.lastID
        });
    });
});

// [SQL-BENCHMARK: BW]
// We Bulk write
app.post('/api/benchmark/bulk-write', (req, res) => {
    const records = req.body.records;
    if (!records || Array.isArray(records)) {
        return res.status(400).json({
            error: "Invalid Payload, 'records' array not found..."
        })
    }
    const insert = db.prepare('INSERT INTO benchmark_test (col_text1, col_text2, col_int1) VALUES (?,?,?)');
    db.serialize(() => {
        debugLogWriteToFile("[SQL-BENCHMARK: BW]: BEGIN TRANSACTION");
        db.run("BEGIN TRANSACTION!!!");
        records.forEach(record => {
            insert.run(record.col_text1, record.col_text2, record.col_int1);
        });
        db.run("COMMIT", (err) => {
            if (err) {
                debugLogWriteToFile(`[SQL-BENCHMARK: BW]: FAIL TO COMMIT: ${err.message}`);
                res.status(500).json({
                    "error": err.message
                });
                return console.error(err.message)
            }
            debugLogWriteToFile(`[SQL-BENCHMARK: BW]: Sucess BulkWrite`);
            res.json({
                message: "success",
                count: records.length
            });
        });
    });
    insert.finalize();
});

// [CRT_ADM]
// Creating admin account
app.post('/api/setup/create-admin', (req, res) => {
    const { username, password } = req.body;
    // We check if the API got the username and password before proceeding...
    if (!username || !password) {
        // Failed, because its blank, probably format error.
        debugLogWriteToFile(`[CRT_ADM]: Admin creation failed... Username and Password was not provided to Endpoint`);
        return res.status(400).json({
            error: 'Username and Password are required.'
        });
    }
    // We check if an account already exists
    // to prevent creating more accounts with identical credentials
    db.get('SELECT COUNT(*) as count FROM admin_login', (err, row) => {
        if (err) {
            debugLogWriteToFile(`[CRT_ADM]: Error checking for possible duplicate admin account, are you sure that the database is ok? Raw error: ${err.message}`);
            return res.status(500).json({
                error: 'Database error while checking for existing admin'
            });
        }
        if (row.count > 0) {
            debugLogWriteToFile(`[CRT_ADM]: Admin account creation halted, account already exists!`);
            return res.status(409).json({
                error: 'An admin account already exists!!!'
            });
        }
        bcrypt.hash(password, 10, (hashErr, hashedPassword) => {
            if (hashErr) {
                debugLogWriteToFile(`[CRT_ADM - CRITICAL!]: BCrypt Error! SOMETHING WENT WRONG WITH BCRYPT!: ${hashErr.message}`);
                return res.status(500).json({
                    error: 'Failed to hash password'
                });
            }
            const insert = 'INSERT INTO admin_login (username, password) VALUES (?,?)';
            db.run(insert, [username, hashedPassword], function(dbErr) {
                if (dbErr) {
                    debugLogWriteToFile(`[CRT-ADM]: DB Error on admin creation: ${dbErr.message}`);
                    return res.status(500).json({
                        error: dbErr.message
                    });
                }
                debugLogWriteToFile(`[CRT-ADM]: Admin account successfully creeated with ID: ${this.lastID}`);
                res.json({
                    message: 'Admin account successfuly created',
                    id: this.lastID
                });
            });
        });
    });
});

// [CLNP]
// Cleanup benchmark traces
app.post('/api/benchmark/cleanup', (req, res) => {
    db.run('DELETE from benchmark_test', function(err) {
        if (err) {
            debugLogWriteToFile(`[CLNP]: Cleanup runs failed... ${err.message}`)
            res.status(500).json({
                "error": err.message
            });
        }
        // Reset autoincrement counters
        db.run("DELETE FROM sqlite_sequence WHERE name='benchmark_test'", (err) => {
            debugLogWriteToFile(`[CLNP]: Cleanup complete for benchmark_test. ${this.changes} rows deleted`);
            res.json({
                message: "success", 
                deleted_rows: this.changes
            });
        });
    });
});

// [SQL-BENCHMARK RA]
// SQL Benchmark read-all
app.get('/api/benchmark/read-all', (req, res) => {
    db.all("SELECT id FROM benchmark_test", [], (err, rows) => {
        if (err) {
            debugLogWriteToFile(`[SQL-BENCHMARK RA]: Benchmark ReadAll Failure: ${err.message}`)
            res.status(500).json({
                "error": err.message
            });
            return console.error(err.message);
        }
        res.json({
            message: "success",
            data: rows
        });
    });
});

// [VA-ADMIN]
// Admin validation
app.post('/api/setup/validate-admin', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        debugLogWriteToFile(`[VA-ADMIN]: Admin validation failed, username or password not provided`);
        return res.status(400).json({
            error: 'Username and password are not provided'
        });
    }
    const query = 'SELECT * FROM admin_login WHERE username = ?';
    db.get(query, [username], (err, admin) => {
        if (err) {
            debugLogWriteToFile(`[VA-ADMIN] CRITICAL: DB Error on admin validation: ${err.message} `);
            return res.status(500).json({
                error: `Database error during validation: ${err.message}`
            })
        }
        if (!admin) {
            debugLogWriteToFile(`[VA-ADMIN]: Admin validation failed, user '${username}' was not found in the database records for administator`);
            return res.status(500).json({
                error: 'Database error during validation, probably records arent being written or you just immediately pressed verification without adding the account.'
            });
        }

        bcrypt.compare(password, admin.password, (compareErr, isMatch) => {
            if (compareErr) {
                debugLogWriteToFile(`[VA-ADMIN] CRITICAL: Bcrypt compare error: ${compareErr.message}`);
                return res.status(500).json({
                    error: 'Error during password comparison on bcrypt side...'
                });
            }
            if (isMatch) {
                debugLogWriteToFile(`[VA-ADMIN]: Credentials are good/verified...`)
                res.json({
                    success: true,
                    message: 'Admin credentials are valid'
                })
            } else {
                debugLogWriteToFile(`[VA-ADMIN]: Admin credentials during verification did not match at all... Are you sure you inputted the correct letters?`)
                res.status(401).json({
                    success: false,
                    error: 'Invalid credentials'
                });
            }
        });
    });
});

// [MULTER-UPD]
// Multer Configuration Component

// Create a directory for logo uploads if it doesn't exist
const logoUploadDir = path.join(__dirname, 'setup/assets/images/logos');
if (!fs.existsSync(logoUploadDir)) {
    fs.mkdirSync(logoUploadDir, { recursive: true });
}

// LOGO STORAGE
const logoStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, logoUploadDir);
    },
    filename: function (req, file, cb) {
        // Create a unique filename to avoid any possible overwrites!
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: logoStorage,
    fileFilter: (req, file, cb) => {
        // Accept only image files!
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('ONLY IMAGE FILES ARE ALLOWED!!! (PNG/JPG/JPEG)'), false);
        }
    }
}).single('logo_file'); // logo_file is the name of input field in the form

// [CONF]
// Configure
app.post('/api/setup/configure', upload, (req, res) => {
    // By placing upload here, multer can already process these request
    // req.body is populated with text fields
    // and req.file should have the file.

    const { school_name, school_type, address, organization_hotline, country_code } = req.body;
    const logo_directory = req.file ? `/assets/images/logos/${req.file.filename}`: null;

    if (!school_name || !country_code) {
        debugLogWriteToFile('[CONF]: Configuration save failed, school name or country code was not provided at all.');
        return res.status(400).json({
            error: 'School name or country code are required...'
        });
    }
    // Check if a configuration already exists
    db.get('SELECT COUNT(*) as count FROM configurations', (dbErr, row) => {
        if (dbErr) {
            debugLogWriteToFile(`[CONF]: Error checking to the database for possible duplicate configurations. Error: ${dbErr.message}`);
            return res.status(500).json({
                error: 'Database Error while checking for existing configuration'
            });
        }
        if (row.count > 0) {
            debugLogWriteToFile(`[CONF]: Configuration Blocked: A configuration entry already exists`);
            return res.status(409).json({
                error: 'Configuration entry already exists, abort.'
            });
        }

        const insert = `
        
        `
    })
})