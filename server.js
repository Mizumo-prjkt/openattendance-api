/*
 * OpenAttendance API (PostgreSQL Version)
 * License: <to be declared>
 * Server Version: ??
 * For Client Version:
 * 
 * 
 * */

/*
 * Initialize some components
 */
const env = require('dotenv');
env.config();
const express = require('express');
const session = require('express-session');
const path = require('path');
// const sequelize = require('sequelize'); // Removed if not strictly used, otherwise configure for PG
const { Pool } = require('pg'); // Changed from sqlite3 to pg
const bodyParser = require('body-parser');
const app = express();
const bcrypt = require('bcrypt');
const fs = require('fs');
const PORT = process.env.PORT || 8080;
const mkdirp = require('mkdirp');
const crypto = require('crypto');
const { exec } = require('child_process');
const e = require('express');
const { DESTRUCTION } = require('dns');
const NTP = require('ntp-time');
const os = require('os');
const checkDiskSpace = require('check-disk-space').default;
const multer = require('multer'); // Added missing requirement based on code usage

// Initial
let debugMode = false;
let logFilePath;
let argEnv = process.argv.slice(2);
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));

// Additional proceedures before we continue
// Create a directory for logo uploads if it doesn't exist
const logoUploadDir = path.join(__dirname, 'setup/assets/images/logos');
if (!fs.existsSync(logoUploadDir)) {
    fs.mkdirSync(logoUploadDir, { recursive: true });
}

// Create a directory for staff profile image uploads if it doesn't exist
const staffImageUploadDir = path.join(__dirname, 'runtime/shared/images/staff_profiles');
if (!fs.existsSync(staffImageUploadDir)) {
    fs.mkdirSync(staffImageUploadDir, { recursive: true });
}
// Create a directory for school logo uploads
const schoolLogoUploadDir = path.join(__dirname, 'runtime/shared/images/school_logos');
if (!fs.existsSync(schoolLogoUploadDir)) {
    fs.mkdirSync(schoolLogoUploadDir, { recursive: true });
}
// Create a directory for database backups
const backupsDir = path.join(__dirname, 'database', 'backups');
if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
}
// Create a temporary directory for experimental files
const tmpDir = path.join(__dirname, 'tmp');
if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
}


// DebugWriteToFile function
// From @MizProject/Mitra setup.js
// Check if being run by nodemon
if (argEnv.includes('--debug')) { // Fixed typo argenv -> argEnv
    console.log("Setup is being run with --debug flag.");
    console.log("Which means, its being run in development mode.");
    console.log("Enabling extreme debug logging for development.");
    debugMode = true; 
    // Now, create the logfile
    const __dayToday = new Date();
    const __timeToday = __dayToday.toLocaleTimeString().replace(/:/g, '-');
    const __dateToday = __dayToday.toLocaleDateString().replace(/\//g, '-');
    const logFileName = `debug-openattendance-log-server-${__dateToday}_${__timeToday}.log`;
    const logDir = path.join(__dirname, 'data', 'logs');
    mkdirp.sync(logDir); 
    logFilePath = path.join(logDir, logFileName); 
    fs.writeFileSync(logFilePath, `Debug Log Created on ${__dateToday} at ${__timeToday}\n\n`);
    debugLogWriteToFile(`Debug logging started. Log file: ${logFilePath}`);
}

function debugLogWriteToFile(message) {
    if (debugMode === false) return;
    const dayToday = new Date();
    const timeToday = dayToday.toLocaleTimeString();
    const dateToday = dayToday.toLocaleDateString().replace(/\//g, '-');
    const logEntry = `[${dateToday} ${timeToday}] ${message}\n`;
    fs.appendFileSync(logFilePath, logEntry); 
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
    brkln('nl');
    brkln('el');
    console.log('OpenAttendance API is running...');
    console.log(`API PORT: ${PORT}`);
    console.log(`For developers, please check the documentation...`);
    brkln('el');
    brkln('nl');
})

// Set the PostgreSQL DB
// Configuration should ideally come from environment variables
const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'openattendance',
    password: process.env.DB_PASSWORD || 'password',
    port: process.env.DB_PORT || 5432,
});

// Test connection
pool.connect((err, client, release) => {
    if (err) {
        console.error(`Error connecting to the PostgreSQL database: ${err.message}`);
        debugLogWriteToFile(`[POSTGRES]: Error connecting to database: ${err.message}`);
        return;
    }
    release();
    console.log(`Successfully connected to PostgreSQL`);
    debugLogWriteToFile(`[POSTGRES]: Successfully connected to database.`);
    
    // Check if tables exist, if not, run schema
    checkAndInitDB();
});

async function checkAndInitDB() {
    try {
        const res = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE  table_schema = 'public'
                AND    table_name   = 'configurations'
            );
        `);
        
        if (!res.rows[0].exists) {
            console.log('Database tables not found, creating new DB from schema');
            debugLogWriteToFile('[POSTGRES]: Database tables not found, creating new database from schema');
            const schemaPath = path.join(__dirname, 'database_schema.sql');
            const schemaSql = fs.readFileSync(schemaPath, 'utf-8');

            await pool.query(schemaSql);
            console.log(`Database Created and initialized successfully`);
            debugLogWriteToFile(`[POSTGRES]: DB created and initialized successfully...`);
        }
    } catch (err) {
        console.error(`Error checking/initializing DB: ${err.message}`);
        debugLogWriteToFile(`[POSTGRES]: Error checking/initializing DB: ${err.message}`);
    }
}


// Function
/*
 * Prints Break Lines for casual readability
 * @param {string} type of the breakline feature
 * - nl: uses \n (New Line)
 * - dl: uses ------ (Dashed Line)
 * - el: uses ====== (Equal Line)
 * @returns {void} Prints the break to console
 */
function brkln(type) {
    switch (type) {
        case 'nl':
            return console.log('\n');
        case 'dl':
            return console.log('--------------------------');
        case 'el':
            return console.log('==========================');
        default:
            return console.log('\n');
    }
}

// API Features

// [SQL-BENCHMARK: SW]
// We sequential write test
app.post('/api/benchmark/sequential-write', (req, res) => {
    // Postgres uses $1, $2, etc. RETURNING id is needed to get the inserted ID back.
    const insert = 'INSERT INTO benchmark_test (col_text1, col_text2, col_int1) VALUES ($1, $2, $3) RETURNING id';
    
    pool.query(insert, ["seq_write", `random_text_${Math.random()}`, Math.floor(Math.random() * 1000)], (err, result) => {
        if (err) {
            res.status(500).json({
                "error": err.message
            });
            debugLogWriteToFile(`[SQL-BENCHMARK: SW] : Benchmark Sequential write extreme fail. Error: ${err.message}`);
            return console.error(err.message);
        }
        debugLogWriteToFile(`[SQL-BENCHMARK: SW]: Benchmark Sequential write success!`)
        res.json({
            message: "success",
            id: result.rows[0].id // Accessed via rows array in PG
        });
    });
});

// [SQL-BENCHMARK: BW]
// We Bulk write
app.post('/api/benchmark/bulk-write', async (req, res) => {
    const records = req.body.records;
    if (!records || Array.isArray(records) === false) { // Fixed check
        return res.status(400).json({
            error: "Invalid Payload, 'records' array not found..."
        })
    }

    const client = await pool.connect();

    try {
        debugLogWriteToFile("[SQL-BENCHMARK: BW]: BEGIN TRANSACTION");
        await client.query('BEGIN');
        
        const insertText = 'INSERT INTO benchmark_test (col_text1, col_text2, col_int1) VALUES ($1, $2, $3)';
        
        for (const record of records) {
            await client.query(insertText, [record.col_text1, record.col_text2, record.col_int1]);
        }

        await client.query('COMMIT');
        debugLogWriteToFile(`[SQL-BENCHMARK: BW]: Success BulkWrite`);
        res.json({
            message: "success",
            count: records.length
        });
    } catch (err) {
        await client.query('ROLLBACK');
        debugLogWriteToFile(`[SQL-BENCHMARK: BW]: FAIL TO COMMIT: ${err.message}`);
        res.status(500).json({
            "error": err.message
        });
        console.error(err.message);
    } finally {
        client.release();
    }
});

// [CRT_ADM]
// Creating admin account
app.post('/api/setup/create-admin', async (req, res) => {
    const { username, password, name, staff_id, email_address, staff_type } = req.body;
    // We check if the API got the username and password before proceeding...
    if (!username || !password || !name || !staff_id || !staff_type) {
        // Failed, because its blank, probably format error.
        debugLogWriteToFile(`[CRT_ADM]: Admin creation failed... Missing required fields.`);
        return res.status(400).json({
            error: 'Username, Password, Name, Staff ID, and Staff Type are required.'
        });
    }
    
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // We check if an account already exists in staff_login
        const checkResult = await client.query('SELECT COUNT(*)::int as count FROM staff_login');

        // Postgres returns count as string usually, or we cast it in SQL
        if (checkResult.rows[0].count > 0) {
            await client.query('ROLLBACK');
            debugLogWriteToFile(`[CRT_ADM]: Admin account creation halted, account already exists!`);
            return res.status(409).json({
                error: 'An admin account already exists!!!'
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        // Split name for staff_accounts
        const nameParts = name.trim().split(/\s+/);
        const firstName = nameParts[0];
        const lastName = nameParts.slice(1).join(' ') || '';

        // Insert into staff_accounts
        await client.query(
            'INSERT INTO staff_accounts (staff_id, first_name, last_name, email_address, staff_type) VALUES ($1, $2, $3, $4, $5)',
            [staff_id, firstName, lastName, email_address, staff_type]
        );

        // Insert into staff_login
        const insertLogin = 'INSERT INTO staff_login (username, password, staff_id) VALUES ($1, $2, $3) RETURNING id';
        const loginResult = await client.query(insertLogin, [username, hashedPassword, staff_id]);

        await client.query('COMMIT');

        const newId = loginResult.rows[0].id;
        debugLogWriteToFile(`[CRT-ADM]: Admin account successfully creeated with ID: ${newId}`);
        res.json({
            message: 'Admin account successfuly created',
            id: newId
        });

    } catch (err) {
        await client.query('ROLLBACK');
        debugLogWriteToFile(`[CRT_ADM]: Error creating admin account: ${err.message}`);
        res.status(500).json({
            error: err.message
        });
    } finally {
        client.release();
    }
});

// [CLNP]
// Cleanup benchmark traces
app.post('/api/benchmark/cleanup', (req, res) => {
    // In Postgres, TRUNCATE with RESTART IDENTITY is more efficient and resets sequences
    pool.query('TRUNCATE benchmark_test RESTART IDENTITY', (err, result) => {
        if (err) {
            debugLogWriteToFile(`[CLNP]: Cleanup runs failed... ${err.message}`)
            return res.status(500).json({
                "error": err.message
            });
        }
        
        debugLogWriteToFile(`[CLNP]: Cleanup complete for benchmark_test.`);
        res.json({
            message: "success", 
            deleted_rows: "All (Truncated)"
        });
    });
});

// [SQL-BENCHMARK RA]
// SQL Benchmark read-all
app.get('/api/benchmark/read-all', (req, res) => {
    pool.query("SELECT id FROM benchmark_test", [], (err, result) => {
        if (err) {
            debugLogWriteToFile(`[SQL-BENCHMARK RA]: Benchmark ReadAll Failure: ${err.message}`)
            res.status(500).json({
                "error": err.message
            });
            return console.error(err.message);
        }
        res.json({
            message: "success",
            data: result.rows // Use .rows
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
    const query = 'SELECT * FROM staff_login WHERE username = $1';
    pool.query(query, [username], (err, result) => {
        if (err) {
            debugLogWriteToFile(`[VA-ADMIN] CRITICAL: DB Error on admin validation: ${err.message} `);
            return res.status(500).json({
                error: `Database error during validation: ${err.message}`
            })
        }
        
        const admin = result.rows[0];

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
    pool.query('SELECT COUNT(*)::int as count FROM configurations', (dbErr, result) => {
        if (dbErr) {
            debugLogWriteToFile(`[CONF]: Error checking to the database for possible duplicate configurations. Error: ${dbErr.message}`);
            return res.status(500).json({
                error: 'Database Error while checking for existing configuration'
            });
        }
        
        if (result.rows[0].count > 0) {
            debugLogWriteToFile(`[CONF]: Configuration Blocked: A configuration entry already exists`);
            return res.status(409).json({
                error: 'Configuration entry already exists, abort.'
            });
        }

        const insert = `
            INSERT INTO configurations (
                school_name, school_type, address, logo_directory, organization_hotline, country_code
            ) VALUES ($1, $2, $3, $4, $5, $6) RETURNING config_id
        `;

        const params = [school_name , school_type || null, address || null, logo_directory , organization_hotline || null , country_code]

        pool.query(insert, params, (insertErr, result) => {
            if (insertErr) {
                debugLogWriteToFile(`[CONF] ERROR: Database error on config creation: ${insertErr.message}`);
                return res.status(500).json({
                    error: insertErr.message
                });
            }
            
            const newId = result.rows[0].config_id;
            debugLogWriteToFile(`[CONF]: Configuration saved successfully with the ID: ${newId}`);
            res.json({
                message: 'Configuration saved successfully.',
                id: newId
            });
        });
    });
});

// [VERI_SCHEMA]
// Verifying schema DB creation and verification
app.get('/api/setup/verify-schema', async (req, res) => {
    debugLogWriteToFile(`[VERI_SCHEMA]: Starting DB schema creation and verification...`);
    try {
        // 1. Read the entire schema
        const schemaPath = path.join(__dirname, 'database_schema.sql');
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');

        // 2. Execute the entire script at once
        await pool.query(schemaSql);
        debugLogWriteToFile(`[VERI_SCHEMA]: Schema script executed successfully.`);

        // 3. We confirm that all table should exist
        const expectedTableNames = (schemaSql.match(/CREATE TABLE IF NOT EXISTS\s+`?(\w+)`?/gi) || [])
            .map(s => s.match(/CREATE TABLE IF NOT EXISTS\s+`?(\w+)`?/i)[1]);
        
        // Postgres-specific table check
        const getTables = async () => {
             const res = await pool.query(`
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public'
             `);
             return res.rows.map(r => r.table_name);
        };

        const actualTables = await getTables();

        const actions = expectedTableNames.map(table => ({
            table: table,
            status: actualTables.includes(table) ? 'exists': 'missing'
        }));

        const allTablesExist = actions.every(a => a.status === 'exists');
        debugLogWriteToFile('[VERI_SCHEMA]: Schema verification process complete.')
        res.json({
            sucess: allTablesExist,
            actions: actions
        });
    } catch (error) {
        debugLogWriteToFile(`[VERI_SCHEMA] FATAL: Schema verification failed... ${error.message}`);
        res.status(500).json({
            error: 'Failed to verify DB schema',
            details: error.message
        });
    }
});