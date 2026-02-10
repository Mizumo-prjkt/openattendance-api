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
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer'); // Added missing requirement based on code usage

// Initial
let debugMode = false;
let logFilePath;
let argEnv = process.argv.slice(2);
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));

// Initialize Socket.io
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});


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

// Create a directory for student profile image uploads
const studentImageUploadDir = path.join(__dirname, 'runtime/shared/images/student_profiles');
if (!fs.existsSync(studentImageUploadDir)) {
    fs.mkdirSync(studentImageUploadDir, { recursive: true });
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


// Socket.io Connection Handler
io.on('connection', (socket) => {
    debugLogWriteToFile(`[SOCKET]: Client Connected: ${socket.id}`);
    socket.on('disconnect', () => {
        debugLogWriteToFile(`[SOCKET]: Client Disconnected: ${socket.id}`);
    });
    // Allow other clients to request an immediate refresh
    socket.on('request_dashboard_refresh', () => {
        debugLogWriteToFile(`[SOCKET]: Empty Trigger in dev mode...`);
    });
});

// Start the server!
server.listen(PORT, () => {
    brkln('nl');
    brkln('el');
    console.log('OpenAttendance API is running...');
    console.log(`API PORT: ${PORT}`);
    console.log(`For developers, please check the documentation...`);
    brkln('el');
    brkln('nl');
});

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
            const schemaPath = path.join(__dirname, 'database_schema_postgres.sql');
            const schemaSql = fs.readFileSync(schemaPath, 'utf-8');

            await pool.query(schemaSql);
            console.log(`Database Created and initialized successfully`);
            debugLogWriteToFile(`[POSTGRES]: DB created and initialized successfully...`);
        } else {
            // Since Commit 12db02342be5c4a500603ec8b81bcda7c7d8042c and
            // 13899e29faee8ca5c0652375a4fdcac13c2f6256 have caused some problems (bruh)
            // This will serve as a failsafe...
            const checkColumn = await pool.query(`
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name = 'students' AND column_name = 'grade_level'
            `);
            if (checkColumn.rows.length === 0) {
                console.log('Detected outdated schema... Applying migration proceedures');
                debugLogWriteToFile(`[POSTGRES]: Detected outdated schema... Applying migration proceedures`);
                const migrationPath = path.join(__dirname, 'database_migration.sql');
                if (fs.existsSync(migrationPath)) {
                    const migrationSql = fs.readFileSync(migrationPath, 'utf-8');
                    await pool.query(migrationSql);
                    console.log('Database migration applied successfully.');
                    debugLogWriteToFile('[POSTGRES]: Database migration applied successfully.');
                }
            }

            // [HOTFIX] Force Gender Constraint Fix
            // This ensures the constraint is correct even if migration failed or constraint name varied
            // Remove this on prod
            console.log('Applying constraint hotfixes...');
            const hotfixClient = await pool.connect();
            try {
                await hotfixClient.query('BEGIN');

                // 0. Check and Fix Column Types (Prevent CHAR padding issues)
                const colsToFix = ['gender', 'status', 'emergency_contact_relationship'];
                for (const col of colsToFix) {
                     const res = await hotfixClient.query(`SELECT data_type FROM information_schema.columns WHERE table_name = 'students' AND column_name = $1`, [col]);
                     if (res.rows.length > 0 && res.rows[0].data_type === 'character') {
                         console.log(`[HOTFIX] Converting ${col} to TEXT to prevent padding issues...`);
                         await hotfixClient.query(`ALTER TABLE students ALTER COLUMN ${col} TYPE TEXT`);
                     }
                }
                
                // 1. Sanitize Gender (Handle Case & Invalid Values)
                await hotfixClient.query("UPDATE students SET gender = 'Male' WHERE gender ILIKE 'male'");
                await hotfixClient.query("UPDATE students SET gender = 'Female' WHERE gender ILIKE 'female'");
                await hotfixClient.query("UPDATE students SET gender = 'Other' WHERE gender ILIKE 'other'");
                // Catch-all: Set any remaining invalid values to 'Other' so constraint doesn't fail
                await hotfixClient.query("UPDATE students SET gender = 'Other' WHERE gender NOT IN ('Male', 'Female', 'Other') AND gender IS NOT NULL");
                
                // 2. Re-apply Gender Constraint
                await hotfixClient.query("ALTER TABLE students DROP CONSTRAINT IF EXISTS students_gender_check");
                await hotfixClient.query("ALTER TABLE students ADD CONSTRAINT students_gender_check CHECK (gender IN ('Male', 'Female', 'Other'))");

                // 3. Ensure Relationship Constraint Exists (Just in case)
                await hotfixClient.query("ALTER TABLE students DROP CONSTRAINT IF EXISTS students_emergency_contact_relationship_check");
                await hotfixClient.query("ALTER TABLE students ADD CONSTRAINT students_emergency_contact_relationship_check CHECK (emergency_contact_relationship IN ('parent', 'guardian'))");

                // Debug: Verify the constraint definition in DB
                const checkConstraint = await hotfixClient.query(`
                    SELECT pg_get_constraintdef(oid) as def 
                    FROM pg_constraint 
                    WHERE conname = 'students_gender_check'
                `);
                if (checkConstraint.rows.length > 0) {
                    console.log(`[DEBUG] Constraint Definition in DB: ${checkConstraint.rows[0].def}`);
                }

                // 4. Fix Status Constraint (Ensure Title Case)
                await hotfixClient.query("UPDATE students SET status = 'Active' WHERE status ILIKE 'active'");
                await hotfixClient.query("UPDATE students SET status = 'Inactive' WHERE status ILIKE 'inactive'");
                await hotfixClient.query("ALTER TABLE students DROP CONSTRAINT IF EXISTS students_status_check");
                await hotfixClient.query("ALTER TABLE students ADD CONSTRAINT students_status_check CHECK (status IN ('Active', 'Inactive'))");


                await hotfixClient.query('COMMIT');
                console.log('Constraint hotfixes applied successfully.');
            } catch (err) {
                await hotfixClient.query('ROLLBACK');
                console.error(`[HOTFIX] Error applying constraints: ${err.message}`);
            } finally {
                hotfixClient.release();
            };
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
        const nameParts = name

        // Insert into staff_accounts
        await client.query(
            'INSERT INTO staff_accounts (staff_id, name, email_address, staff_type) VALUES ($1, $2, $3, $4)',
            [staff_id, nameParts, email_address, staff_type]
        );

        // Insert into staff_login
        const insertLogin = 'INSERT INTO staff_login (username, password, staff_id) VALUES ($1, $2, $3) RETURNING login_id';
        const loginResult = await client.query(insertLogin, [username, hashedPassword, staff_id]);

        await client.query('COMMIT');

        const newId = loginResult.rows[0].login_id;
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

// [STUDENTS]
// Get all students
app.get('/api/students/list', async (req, res) => {
    const client = await pool.connect();
    try {
        const query = `
            SELECT 
                id, 
                student_id, 
                first_name, 
                last_name, 
                classroom_section as section, 
                gender,
                status, 
                emergency_contact_name,
                emergency_contact_phone,
                emergency_contact_relationship,
                profile_image_path as profile_image 
            FROM students 
            ORDER BY last_name ASC
        `;
        const result = await client.query(query);
        res.json(result.rows);
    } catch (err) {
        debugLogWriteToFile(`[STUDENTS] ERROR: ${err.message}`);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// Add student
app.post('/api/students/add', async (req, res) => {
    const { student_id, first_name, last_name, section, gender, status, profile_image, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Sanitize & Trim Inputs
        const s_student_id = student_id ? student_id.trim() : '';
        const s_first_name = first_name ? first_name.trim() : '';
        const s_last_name = last_name ? last_name.trim() : '';
        const s_section = section ? section.trim() : null;
        const s_status = status ? status.trim() : 'Active';
        const s_ec_name = emergency_contact_name ? emergency_contact_name.trim() : null;
        const s_ec_phone = emergency_contact_phone ? emergency_contact_phone.trim() : null;
        const s_ec_rel = emergency_contact_relationship ? emergency_contact_relationship.trim().toLowerCase() : null;

        
        let imagePath = null;
        if (profile_image && profile_image.startsWith('data:image')) {
             const base64Data = profile_image.replace(/^data:image\/\w+;base64,/, "");
             const buffer = Buffer.from(base64Data, 'base64');
             const fileName = `student_${s_student_id}_${Date.now()}.png`;
             const filePath = path.join(__dirname, 'runtime/shared/images/student_profiles', fileName);
             fs.writeFileSync(filePath, buffer);
             imagePath = `/assets/images/student_profiles/${fileName}`;
        }

        // Sanitize gender to match DB constraint (Title Case)
        console.log(`[DEBUG] Received Gender: ${gender}`);
        let sanitizedGender = 'Male';
        if (gender) {
            // Trim and capitalize first, lowercase rest (samples: "male" -> "Male")
            const g = gender.trim();
            sanitizedGender = g.charAt(0).toUpperCase() + g.slice(1).toLowerCase();
            if (!['Male', 'Female', 'Other'].includes(sanitizedGender)) {
                sanitizedGender = 'Male'; // Fallback
            }
        }

        const qr_code_token = crypto.randomUUID();
        const query = `
            INSERT INTO students (student_id, first_name, last_name, classroom_section, status, gender, profile_image_path, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship, qr_code_token)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING id
        `;
        await client.query(query, [s_student_id, s_first_name, s_last_name, s_section, sanitizedGender, s_status, imagePath, s_ec_name, s_ec_phone, s_ec_rel, qr_code_token]);
        await client.query('COMMIT');
        res.json({ success: true });
    } catch (err) {
        await client.query('ROLLBACK');
        debugLogWriteToFile(`[STUDENTS] ADD ERROR: ${err.message}`);
        if (err.detail) console.error(`[STUDENTS]: ADD ERROR DETAIL:   ${err.detail}`);
        if (err.constraint) console.error(`[STUDENTS]: ADD ERROR CONSTRAINT: ${err.constraint}`);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// Update student
app.put('/api/students/update', async (req, res) => {
    const { id, student_id, first_name, last_name, section, gender, status, profile_image, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Sanitize & Trim Inputs
        const s_student_id = student_id ? student_id.trim() : '';
        const s_first_name = first_name ? first_name.trim() : '';
        const s_last_name = last_name ? last_name.trim() : '';
        const s_section = section ? section.trim() : null;
        const s_status = status ? status.trim() : 'Active';
        const s_ec_name = emergency_contact_name ? emergency_contact_name.trim() : null;
        const s_ec_phone = emergency_contact_phone ? emergency_contact_phone.trim() : null;
        const s_ec_rel = emergency_contact_relationship ? emergency_contact_relationship.trim().toLowerCase() : null;

        
        let imagePath = profile_image; 
        if (profile_image && profile_image.startsWith('data:image')) {
             const base64Data = profile_image.replace(/^data:image\/\w+;base64,/, "");
             const buffer = Buffer.from(base64Data, 'base64');
             const fileName = `student_${s_student_id}_${Date.now()}.png`;
             const filePath = path.join(__dirname, 'runtime/shared/images/student_profiles', fileName);
             fs.writeFileSync(filePath, buffer);
             imagePath = `/assets/images/student_profiles/${fileName}`;
        }

        // Sanitize gender to match DB constraint (Title Case)
        let sanitizedGender = 'Male';
        if (gender) {
            // Capitalize first letter, lowercase rest (e.g. "male" -> "Male")
            // We first trim values
            const g = gender.trim();
            sanitizedGender = g.charAt(0).toUpperCase() + g.slice(1).toLowerCase();
            if (!['Male', 'Female', 'Other'].includes(sanitizedGender)) {
                sanitizedGender = 'Male'; // Fallback
            }
        }

        const query = `
            UPDATE students 
            SET student_id = $1, first_name = $2, last_name = $3, classroom_section = $4, gender = $5, status = $6, profile_image_path = $7, emergency_contact_name = $8, emergency_contact_phone = $9, emergency_contact_relationship = $10
            WHERE id = $11
        `;
        await client.query(query, [s_student_id, s_first_name, s_last_name, s_section, sanitizedGender, s_status, imagePath, s_ec_name, s_ec_phone, s_ec_rel, id]);
        await client.query('COMMIT');
        res.json({ success: true });
    } catch (err) {
        await client.query('ROLLBACK');
        debugLogWriteToFile(`[STUDENTS] UPDATE ERROR: ${err.message}`);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// Delete student
app.delete('/api/students/delete', async (req, res) => {
    const { id } = req.body;
    const client = await pool.connect();
    try {
        await client.query('DELETE FROM students WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (err) {
        debugLogWriteToFile(`[STUDENTS] DELETE ERROR: ${err.message}`);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
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
        const schemaPath = path.join(__dirname, 'database_schema_postgres.sql');
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
            success: allTablesExist,
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

// [DASH]
// Dashboard Overview Endpoint
app.get('/api/dashboard/overview', async (req, res) => {
    const client = await pool.connect();
    try {
        // 1. Stats
        const totalStudentsRes = await client.query("SELECT COUNT(*) FROM students WHERE status = 'Active'");
        const totalStudents = parseInt(totalStudentsRes.rows[0].count || 0);

        const presentTodayRes = await client.query("SELECT COUNT(DISTINCT student_id) FROM present WHERE time_in::date = CURRENT_DATE");
        const presentToday = parseInt(presentTodayRes.rows[0].count || 0);

        const absentTodayRes = await client.query("SELECT COUNT(*) FROM absent WHERE absent_datetime::date = CURRENT_DATE");
        const absentToday = parseInt(absentTodayRes.rows[0].count || 0);

        // Late: Assuming late is after 8:00 AM (Hardcoded for now, should be config)
        const lateTodayRes = await client.query("SELECT COUNT(DISTINCT student_id) FROM present WHERE time_in::date = CURRENT_DATE AND time_in::time > '08:00:00'");
        const lateToday = parseInt(lateTodayRes.rows[0].count || 0);

        // 2. Chart Data (Last 7 days)
        // Uses generate_series to ensure we have days even if empty
        const chartQuery = `
            SELECT 
                to_char(d, 'Dy') as day,
                COALESCE(COUNT(p.present_id), 0) as count
            FROM generate_series(CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE, '1 day') d
            LEFT JOIN present p ON p.time_in::date = d::date
            GROUP BY d
            ORDER BY d
        `;
        const chartRes = await client.query(chartQuery);

        // 3. Recent Activity (Last 5 scans)
        const activityQuery = `
            SELECT 
                s.first_name || ' ' || s.last_name as title,
                'Checked in at ' || to_char(p.time_in, 'HH12:MI AM') as desc,
                to_char(p.time_in, 'HH12:MI AM') as time,
                'login' as icon,
                'text-[#146C2E]' as iconColor,
                'bg-[#C4EED0]' as bg
            FROM present p
            JOIN students s ON p.student_id = s.student_id
            ORDER BY p.time_in DESC
            LIMIT 5
        `;
        const activityRes = await client.query(activityQuery);

        res.json({
            stats: {
                totalStudents,
                presentToday,
                absentToday,
                lateToday
            },
            chartData: chartRes.rows,
            recentActivity: activityRes.rows
        });
    } catch (err) {
        debugLogWriteToFile(`[DASH] ERROR: ${err.message}`);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});


// [ANALYTICS]
// Detailed Analytics Endpoint
app.get('/api/dashboard/analytics', async (req, res) => {
    const { filter_type, filter_value } = req.query;
    const client = await pool.connect();
    try {
        // 1. Kiosk Performance (Scans by Staff/Kiosk Account)
        // Daily
        const kioskDailyQuery = `
            SELECT sa.name, COUNT(p.present_id) as scan_count
            FROM present p
            JOIN staff_accounts sa ON p.staff_id = sa.staff_id
            WHERE p.time_in::date = CURRENT_DATE
            GROUP BY sa.name
            ORDER BY scan_count DESC
        `;
        const kioskDailyRes = await client.query(kioskDailyQuery);

        // Weekly
        const kioskWeeklyQuery = `
            SELECT sa.name, COUNT(p.present_id) as scan_count
            FROM present p
            JOIN staff_accounts sa ON p.staff_id = sa.staff_id
            WHERE p.time_in >= CURRENT_DATE - INTERVAL '7 days'
            GROUP BY sa.name
            ORDER BY scan_count DESC
        `;
        const kioskWeeklyRes = await client.query(kioskWeeklyQuery);

        // 2. Classroom Leaderboard
        // First, get total students per section to calculate percentage
        const sectionTotalsQuery = `
            SELECT classroom_section, COUNT(*) as total_students
            FROM students
            WHERE status = 'Active' AND classroom_section IS NOT NULL
            GROUP BY classroom_section
        `;
        const sectionTotalsRes = await client.query(sectionTotalsQuery);
        const sectionTotals = {};
        sectionTotalsRes.rows.forEach(row => {
            sectionTotals[row.classroom_section] = parseInt(row.total_students);
        });

        // Helper to calculate leaderboard
        const getLeaderboard = async (interval, customFilter = null) => {
            let timeCondition;
            const params = [];
            if (customFilter) {
                if (customFilter.type === 'month') {
                    // To filter: YYYY-MM
                    timeCondition = `to_Char(p.time_in, 'YYYY-MM') = $1`;
                    params.push(customFilter.value);
                } else if (customFilter.type === 'week') {
                    // To filter: YYYY-Www
                    timeCondition = `to_Char(p.time_in, 'IYYY-"W"IW') = $1`;
                    params.push(customFilter.value);
                }
            } else {
                timeCondition = `p.time_in >= CURRENT_DATE - INTERVAL '${interval}'`;
            }
            const query = `
                SELECT s.classroom_section, COUNT(p.present_id) as present_count
                FROM present p
                JOIN students s ON p.student_id = s.student_id
                WHERE ${timeCondition}
                AND s.classroom_section IS NOT NULL
                GROUP BY s.classroom_section
            `;
            const res = await client.query(query, params);
            
            return res.rows.map(row => {
                const section = row.classroom_section;
                const present = parseInt(row.present_count);
                const totalStudents = sectionTotals[section] || 0;
                // Naive calculation: present count vs total students (not accounting for # of days)
                // This gives a raw "presence volume" metric which is safer for leaderboards than % if days vary
                return {
                    section,
                    present,
                    totalStudents
                };
            }).sort((a, b) => b.present - a.present);
        };

        let leaderboardWeek = [];
        let leaderboardMonth = [];

        if (filter_type && filter_value) {
            // If filtering, we populate the specific slot requested
            if (filter_type === 'week') {
                leaderboardWeek = await getLeaderboard(null, { type: 'week', value: filter_value });
            } else if (filter_type === 'month') {
                leaderboardMonth = await getLeaderboard(null, { type: 'month', value: filter_value });
            }
        } else {
            // Default behavior
            leaderboardWeek = await getLeaderboard('7 days');
            leaderboardMonth = await getLeaderboard('30 days');
        }

        res.json({
            kioskPerformance: {
                daily: kioskDailyRes.rows,
                weekly: kioskWeeklyRes.rows
            },
            leaderboard: {
                week: leaderboardWeek,
                month: leaderboardMonth
            }
        });

    } catch (err) {
        debugLogWriteToFile(`[ANALYTICS] ERROR: ${err.message}`);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// [MIGRATE]
// Database Migration Endpoint
app.post('/api/setup/migrate', async (req, res) => {
    debugLogWriteToFile(`[MIGRATE]: Starting database migration...`);
    const client = await pool.connect();
    try {
        const migrationPath = path.join(__dirname, 'database_migration.sql');
        if (!fs.existsSync(migrationPath)) {
             throw new Error("Migration file not found!");
        }
        const migrationSql = fs.readFileSync(migrationPath, 'utf8');
        
        await client.query(migrationSql);
        
        debugLogWriteToFile(`[MIGRATE]: Migration executed successfully.`);
        res.json({
            message: "Migration executed successfully."
        });
    } catch (err) {
        debugLogWriteToFile(`[MIGRATE] ERROR: ${err.message}`);
        res.status(500).json({
            error: `Migration failed: ${err.message}`
        });
    } finally {
        client.release();
    }
});

// [STD-STATS]
// Get student statistics
app.get('/api/students/stats/:student_id', async (req, res) => {
    const { student_id } = req.params;
    const client = await pool.connect();
    try {
        const presentRes = await client.query('SELECT COUNT(*) FROM present WHERE student_id = $1', [student_id]);
        const absentRes = await client.query('SELECT COUNT(*) FROM absent WHERE student_id = $1', [student_id]);
        const lateRes = await client.query("SELECT COUNT(*) FROM present WHERE student_id = $1 AND time_in::time > '08:00:00'", [student_id]);

        const present = parseInt(presentRes.rows[0].count || 0);
        const absent = parseInt(absentRes.rows[0].count || 0);
        const late = parseInt(lateRes.rows[0].count || 0);
        const total = present + absent;

        const rate = total > 0 ? ((present / total) * 100).toFixed(1) + '%' : 'No Data';

        res.json({ present, absent, late, total, rate });
    } catch (err) {
        debugLogWriteToFile(`[STUDENTS] STATS ERROR: ${err.message}`);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// [SECTIONS]
// Get all sections
app.get('/api/sections/list', async (req, res) => {
    const client = await pool.connect();
    try {
        const query = `
            SELECT 
                s.section_id as id,
                s.section_name as name,
                s.adviser_staff_id,
                sa.name as adviser_name,
                s.room_number as room,
                s.grade_level,
                s.strand,
                s.schedule_data,
                (SELECT COUNT(*)::int FROM students st WHERE st.classroom_section = s.section_name AND st.status = 'Active') as student_count
            FROM sections s
            LEFT JOIN staff_accounts sa ON s.adviser_staff_id = sa.staff_id
            ORDER BY s.section_name ASC
        `;
        const result = await client.query(query);
        // Map results to match frontend expectation
        const mapped = result.rows.map(row => ({
            id: row.id,
            name: row.name,
            adviser: row.adviser_name || 'Unassigned',
            adviser_id: row.adviser_staff_id,
            room: row.room,
            grade_level: row.grade_level,
            strand: row.strand,
            student_count: row.student_count,
            schedule: row.schedule_data || []
        }));
        res.json(mapped);
    } catch (err) {
        debugLogWriteToFile(`[SECTIONS] ERROR: ${err.message}`);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// Add/Update/Delete Section
app.post('/api/sections/add', async (req, res) => {
    const { name, adviser_id, room, grade_level, strand, schedule } = req.body;
    const client = await pool.connect();
    try {
        const query = `
            INSERT INTO sections (section_name, adviser_staff_id, room_number, grade_level, strand ,schedule_data)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING section_id
        `;
        await client.query(query, [name, adviser_id || null, room, grade_level || null , strand || null , JSON.stringify(schedule || [])]);
        res.json({ success: true });
    } catch (err) {
        debugLogWriteToFile(`[SECTIONS] ADD ERROR: ${err.message}`);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

app.put('/api/sections/update', async (req, res) => {
    const { id, name, adviser_id, room, grade_level, strand, schedule } = req.body;
    const client = await pool.connect();
    try {
        const query = `
            UPDATE sections
            SET section_name = $1, adviser_staff_id = $2, room_number = $3, grade_level = $4, strand = $5, schedule_data = $6
            WHERE section_id = $7
        `;
        await client.query(query, [name, adviser_id || null, room, grade_level || null, strand || null, JSON.stringify(schedule || []), id]);
        res.json({ success: true });
    } catch (err) {
        debugLogWriteToFile(`[SECTIONS] UPDATE ERROR: ${err.message}`);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

app.delete('/api/sections/delete', async (req, res) => {
    const { id } = req.body;
    const client = await pool.connect();
    try {
        await client.query('DELETE FROM sections WHERE section_id = $1', [id]);
        res.json({ success: true });
    } catch (err) {
        debugLogWriteToFile(`[SECTIONS] DELETE ERROR: ${err.message}`);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});


// [STAFF]
// Get all staff
app.get('/api/staff/list', async (req, res) => {
    const client = await pool.connect();
    try {
        const query = `
            SELECT 
                id, 
                staff_id, 
                name, 
                email_address as email, 
                staff_type as type, 
                CASE WHEN active = 1 THEN 'Active' ELSE 'Inactive' END as status, 
                profile_image_path as profile_image 
            FROM staff_accounts 
            ORDER BY name ASC
        `;
        const result = await client.query(query);
        res.json(result.rows);
    } catch (err) {
        debugLogWriteToFile(`[STAFF] ERROR: ${err.message}`);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// Add staff
app.post('/api/staff/add', async (req, res) => {
    const { staff_id, name, email, type, status, profile_image, username, password } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        let imagePath = null;
        if (profile_image && profile_image.startsWith('data:image')) {
             const base64Data = profile_image.replace(/^data:image\/\w+;base64,/, "");
             const buffer = Buffer.from(base64Data, 'base64');
             const fileName = `staff_${staff_id}_${Date.now()}.png`;
             const filePath = path.join(__dirname, 'runtime/shared/images/staff_profiles', fileName);
             fs.writeFileSync(filePath, buffer);
             imagePath = `/assets/images/staff_profiles/${fileName}`;
        }

        const active = status === 'Active' ? 1 : 0;

        const query = `
            INSERT INTO staff_accounts (staff_id, name, email_address, staff_type, active, profile_image_path)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id
        `;
        await client.query(query, [staff_id, name, email, type, active, imagePath]);

        // Create login credentials if provided
        if (username && password) {
            const hashedPassword = await bcrypt.hash(password, 10);
            const loginQuery = `
                INSERT INTO staff_login (staff_id, username, password)
                VALUES ($1, $2, $3)
            `;
            await client.query(loginQuery, [staff_id, username, hashedPassword]);
        }


        await client.query('COMMIT');
        res.json({ success: true });
    } catch (err) {
        await client.query('ROLLBACK');
        debugLogWriteToFile(`[STAFF] ADD ERROR: ${err.message}`);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// Check username availability
app.post('/api/staff/check-username', async (req, res) => {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: 'Username required' });
    
    const client = await pool.connect();
    try {
        const result = await client.query('SELECT COUNT(*) FROM staff_login WHERE username = $1', [username]);
        const count = parseInt(result.rows[0].count);
        res.json({ available: count === 0 });
    } catch (err) {
        debugLogWriteToFile(`[STAFF] CHECK USERNAME ERROR: ${err.message}`);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// Update staff
app.put('/api/staff/update', async (req, res) => {
    const { id, staff_id, name, email, type, status, profile_image } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        let imagePath = profile_image; 
        if (profile_image && profile_image.startsWith('data:image')) {
             const base64Data = profile_image.replace(/^data:image\/\w+;base64,/, "");
             const buffer = Buffer.from(base64Data, 'base64');
             const fileName = `staff_${staff_id}_${Date.now()}.png`;
             const filePath = path.join(__dirname, 'runtime/shared/images/staff_profiles', fileName);
             fs.writeFileSync(filePath, buffer);
             imagePath = `/assets/images/staff_profiles/${fileName}`;
        }

        const active = status === 'Active' ? 1 : 0;

        const query = `
            UPDATE staff_accounts 
            SET staff_id = $1, name = $2, email_address = $3, staff_type = $4, active = $5, profile_image_path = $6
            WHERE id = $7
        `;
        await client.query(query, [staff_id, name, email, type, active, imagePath, id]);
        await client.query('COMMIT');
        res.json({ success: true });
    } catch (err) {
        await client.query('ROLLBACK');
        debugLogWriteToFile(`[STAFF] UPDATE ERROR: ${err.message}`);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// Delete staff
app.delete('/api/staff/delete', async (req, res) => {
    const { id } = req.body;
    const client = await pool.connect();
    try {
        await client.query('DELETE FROM staff_accounts WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (err) {
        debugLogWriteToFile(`[STAFF] DELETE ERROR: ${err.message}`);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});
