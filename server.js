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
const os = require('os');
const checkDiskSpace = require('check-disk-space').default;
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer'); // Added missing requirement based on code usage
const QRCode = require('qrcode');
const archiver = require('archiver');
const NTP = require('ntp-time');
const Holidays = require('date-holidays');
let ZteModem;
try {
    ZteModem = require('@zigasebenik/zte-sms');
} catch (e) {
    console.log("[SMS] Optional dependency @zigasebenik/zte-sms not found.");
}

// Initial
let debugMode = false;
let logFilePath;
let argEnv = process.argv.slice(2);
app.use(bodyParser.json({
    limit: '50mb'
})); // I am trying to force payload to go max 50mb than standard 100kb
app.use(bodyParser.urlencoded({
    extended: true,
    limit: '50mb'
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

// Serve static assets for profile pictures and logos
// For profile images, school logos etc. stored in runtime
app.use('/assets/images', express.static(path.join(__dirname, 'runtime/shared/images')));
// For setup-specific logos (from initial setup)
app.use('/assets/images/logos', express.static(path.join(__dirname, 'setup/assets/images/logos')));



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
console.error = function (message) {
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
console.warn = function (message) {
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

// [TIMEZONE-CONFIG]
// Mapping Country Codes to Timezones for fallback validation
const CountryTimezones = {
    'PH': 'Asia/Manila',
    'US': 'America/New_York',
    'JP': 'Asia/Tokyo',
    'SG': 'Asia/Singapore',
    'AU': 'Australia/Sydney',
    'GB': 'Europe/London',
    'CN': 'Asia/Shanghai',
    'KR': 'Asia/Seoul',
    'IN': 'Asia/Kolkata',
    'CA': 'America/Toronto',
    'AE': 'Asia/Dubai',
    'SA': 'Asia/Riyadh',
    'QA': 'Asia/Riyadh',
    'FR': 'Europe/Paris',
    'DE': 'Europe/Berlin',
    'RU': 'Europe/Moscow',
    'BR': 'America/Sao_Paulo',
    'MX': 'America/Mexico_City',
    'ZA': 'Africa/Johannesburg',
    'NG': 'Africa/Lagos',
    'EG': 'Africa/Cairo',
    'TH': 'Asia/Bangkok',
    'ID': 'Asia/Jakarta',
    'VN': 'Asia/Ho_Chi_Minh',
    'MY': 'Asia/Kuala_Lumpur',
    'NZ': 'Pacific/Auckland',
    'UTC': 'UTC'
};


// Then, we grab time from NTP server!
// M: on second thought, we should let client do the configure
// const ntpClient = new NTP.Client('pool.ntp.org', 123, { timeout: 3000 });
// We set the time difference between Server NTP time and Local Time.
let globalTimeOffset = parseInt(process.env.NTP_OFFSET) || 0; // We in ms btw
let timeSource = 'Local System Time';
// Then we async the time
async function syncTimeWithNTP(retryCount = 0) {
    let countryCode = 'UTC';
    let ntpAddress = 'pool.ntp.org';
    const maxRetries = 5;
    const retryCooldown = 5000;

    try {
        // Fetch configured NTP server and Country Code
        if (typeof pool !== 'undefined') {
            const client = await pool.connect();
            try {
                const res = await client.query('SELECT ntp_server, country_code FROM configurations LIMIT 1');
                if (res.rows.length > 0) {
                    if (res.rows[0].ntp_server) ntpAddress = res.rows[0].ntp_server;
                    if (res.rows[0].country_code) countryCode = res.rows[0].country_code;
                }
            } catch (dbErr) {
                console.warn(`[NTP]: DB Config fetch failed: ${dbErr.message}`);
            } finally {
                client.release();
            }
        }

        const ntpClient = new NTP.Client(ntpAddress, 123, { timeout: 3000 });
        const time = await ntpClient.syncTime();

        if (!time || !time.time) throw new Error("Invalid NTP response");

        // Calculate offset: NTP and Local Time
        const now = new Date();
        const newOffset = time.time.getTime() - now.getTime();
        if (isNaN(newOffset)) throw new Error("Calculated offset is NaN");
        globalTimeOffset = newOffset;

        timeSource = 'NTP Server';
        console.log(`[NTP]: Time Syncronization Complete!`);
        console.log(`[NTP] SERVER TIME: ${now.toLocaleTimeString()}`);
        console.log(`[NTP] Real Time: ${time.time.toLocaleTimeString()} (via ${ntpAddress})`);
        console.log(`[NTP] Offset:      ${globalTimeOffset}ms`);

        debugLogWriteToFile(`[NTP]: Server Time syncronization complete using ${ntpAddress}`);
        debugLogWriteToFile(`[NTP]: Offset Applied: ${globalTimeOffset}ms`);

    } catch (err) {
        if (retryCount < maxRetries) {
            console.warn(`[NTP]: Sync failed: ${err.message}. Retrying in ${retryCooldown / 1000}s... (${retryCount + 1}/${maxRetries})`);
            setTimeout(() => syncTimeWithNTP(retryCount + 1), retryCooldown);
            return;
        }

        timeSource = 'Local System Time (Fallback)';
        if (isNaN(globalTimeOffset)) globalTimeOffset = 0; // Safety reset
        console.warn(`[NTP]: Syncronization Failed: ${err.message}. Using System Time Instead`);
        debugLogWriteToFile(`[NTP]: Timesync fail: ${err.message}`);
        // Fallback: Validate Local time against Country Code Timezone
        validateLocalTimeWithCountry(countryCode);
    }
}

function validateLocalTimeWithCountry(countryCode) {
    try {
        const targetZone = CountryTimezones[countryCode] || 'UTC';
        const now = new Date();

        // Get formatted time strings to compare hours (simple validation)
        const options = { timeZone: targetZone, hour: 'numeric', hour12: false };
        const targetHour = new Intl.DateTimeFormat('en-US', options).format(now);

        const localOptions = { hour: 'numeric', hour12: false };
        const localHour = new Intl.DateTimeFormat('en-US', localOptions).format(now);

        if (targetHour !== localHour) {
            const msg = `[TIME]: WARNING! System time (Hour: ${localHour}) does not match expected time for ${countryCode}/${targetZone} (Hour: ${targetHour}).`;
            console.warn(msg);
            debugLogWriteToFile(msg);
        } else {
            debugLogWriteToFile(`[TIME]: System time validated against ${countryCode} (${targetZone}).`);
        }
    } catch (validationErr) {
        console.error(`[TIME]: Validation Error: ${validationErr.message}`);
    }
}

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

// Helper: Compare SemVer-like versions
function compareVersions(v1, v2) {
    const p1 = v1.split('.').map(Number);
    const p2 = v2.split('.').map(Number);
    for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
        const n1 = p1[i] || 0;
        const n2 = p2[i] || 0;
        if (n1 > n2) return 1;
        if (n1 < n2) return -1;
    }
    return 0;
}


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
            // Set initial version if present in the schema file
            const versionMatch = schemaSql.match(/--\s*Version:\s*(\d+(\.\d+)*)/i);
            if (versionMatch) {
                await pool.query(`UPDATE configurations SET db_version = '${versionMatch[1]}'`);
            }
            console.log(`Database Created and initialized successfully`);
            debugLogWriteToFile(`[POSTGRES]: DB created and initialized successfully...`);
        } else {
            // Since Commit 12db02342be5c4a500603ec8b81bcda7c7d8042c and
            // 13899e29faee8ca5c0652375a4fdcac13c2f6256 have caused some problems (bruh)
            // This will serve as a failsafe...
            const checkColumn = await pool.query(`
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name = 'sections' AND column_name = 'grade_level'
            `);

            const checkEvents = await pool.query(`
                SELECT table_name
                FROM information_schema.tables
                WHERE table_name = 'events'
            `);

            const checkEventCol = await pool.query(`
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name = 'events' AND column_name = 'attendee_count'
            `);

            const checkEventEndCol = await pool.query(`
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name = 'events' AND column_name = 'end_datetime'
            `);

            const checkEventTypeCol = await pool.query(`
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name = 'events' AND column_name = 'event_type'
            `);

            const checkCreatedByCol = await pool.query(`
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name = 'events' AND column_name = 'created_by_staff_id'
            `);

            const checkEventStaffTable = await pool.query(`
                SELECT table_name
                FROM information_schema.tables
                WHERE table_name = 'event_staff'
            `);

            const checkEventAttendanceTable = await pool.query(`
                SELECT table_name
                FROM information_schema.tables
                WHERE table_name = 'event_attendance'
            `);

            const checkEventHashCol = await pool.query(`
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name = 'events' AND column_name = 'event_hash'
            `);

            const checkEventNotesTable = await pool.query(`
                SELECT table_name
                FROM information_schema.tables
                WHERE table_name = 'event_notes'
            `);

            const checkConfigPrincipal = await pool.query(`
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name = 'configurations' AND column_name = 'principal_name'
            `);

            const checkConfigVersion = await pool.query(`
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name = 'configurations' AND column_name = 'db_version'
            `)


            // We start nl this arg lmao, i dont like vscrolling this thing
            if (checkColumn.rows.length === 0 ||
                checkEvents.rows.length === 0 ||
                checkEventCol.rows.length === 0 ||
                checkEventEndCol.rows.length === 0 ||
                checkEventTypeCol.rows.length === 0 ||
                checkCreatedByCol.rows.length === 0 ||
                checkEventStaffTable.rows.length === 0 ||
                checkEventAttendanceTable.rows.length === 0 ||
                checkEventHashCol.rows.length === 0 ||
                checkEventNotesTable.rows.length === 0 ||
                checkEventHashCol.rows.length === 0 ||
                checkConfigPrincipal.rows.length === 0 ||
                checkConfigVersion.rows.length === 0) {
                console.log('Detected outdated schema... Applying migration proceedures');
                debugLogWriteToFile(`[POSTGRES]: Detected outdated schema... Applying migration proceedures`);
                const migrationPath = path.join(__dirname, 'database_migration.sql');
                if (fs.existsSync(migrationPath)) {
                    const migrationSql = fs.readFileSync(migrationPath, 'utf-8');
                    await pool.query(migrationSql);
                    console.log('Database migration applied successfully.');
                    debugLogWriteToFile('[POSTGRES]: Database migration applied successfully.');
                }

                if (checkConfigVersion.rows.length === 0) {
                    await pool.query(`ALTER TABLE configurations ADD COLUMN IF NOT EXISTS db_version TEXT DEFAULT '0.0.0'`);
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

                // 5. Fix Events created_by_staff_id constraint (Make it nullable to prevent crashes)
                const checkCreatedBy = await hotfixClient.query(`
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_name = 'events' AND column_name = 'created_by_staff_id'
                `);
                if (checkCreatedBy.rows.length > 0) {
                    await hotfixClient.query("ALTER TABLE events ALTER COLUMN created_by_staff_id DROP NOT NULL");
                }

                // 6. Fix Sections adviser_staff_id constraint (ON DELETE SET NULL)
                await hotfixClient.query("ALTER TABLE sections DROP CONSTRAINT IF EXISTS sections_adviser_staff_id_fkey");
                await hotfixClient.query(`
                    ALTER TABLE sections 
                    ADD CONSTRAINT sections_adviser_staff_id_fkey 
                    FOREIGN KEY (adviser_staff_id) 
                    REFERENCES staff_accounts(staff_id) 
                    ON DELETE SET NULL
                `);

                // Just manual curl -X POST "http://localhost:10002/api/setup/migrate"
                // or any port set by vite port or env set.
                // Because using this area is really making the codebase dirty as hell, and now
                // this source code is hell
                // // 7. Run this code to alter table configurations on the spot
                // await hotfixClient.query(`ALTER TABLE configurations ADD COLUMN IF NOT EXISTS principal_name TEXT;`);
                // await hotfixClient.query(`ALTER TABLE configurations ADD COLUMN IF NOT EXISTS principal_title TEXT DEFAULT 'School Principal';`);
                // await hotfixClient.query(`ALTER TABLE configurations ADD COLUMN IF NOT EXISTS school_year TEXT DEFAULT '2024-2025';`);

                // 8. Ensure 'location' column exists in 'present' and 'event_attendance' tables
                await hotfixClient.query("ALTER TABLE present ADD COLUMN IF NOT EXISTS location TEXT");
                await hotfixClient.query("ALTER TABLE event_attendance ADD COLUMN IF NOT EXISTS location TEXT");

                // 9. We ensure that 'ntp_server' column exists in 'configurations'
                await hotfixClient.query("ALTER TABLE configurations ADD COLUMN IF NOT EXISTS ntp_server TEXT DEFAULT 'pool.ntp.org'");

                // 10. Ensure 'time_out' column exists in 'present' and 'event_attendance' tables
                await hotfixClient.query("ALTER TABLE present ADD COLUMN IF NOT EXISTS time_out TIMESTAMP");
                await hotfixClient.query("ALTER TABLE event_attendance ADD COLUMN IF NOT EXISTS time_out TIMESTAMP");

                // 11. Ensure attendance configuration columns exist
                await hotfixClient.query("ALTER TABLE configurations ADD COLUMN IF NOT EXISTS time_in_start TIME DEFAULT '06:00:00'");
                await hotfixClient.query("ALTER TABLE configurations ADD COLUMN IF NOT EXISTS time_late_threshold TIME DEFAULT '08:00:00'");
                await hotfixClient.query("ALTER TABLE configurations ADD COLUMN IF NOT EXISTS time_out_target TIME DEFAULT '16:00:00'");

                // 12. Security Recovery Migration
                await hotfixClient.query("ALTER TABLE staff_login ADD COLUMN IF NOT EXISTS security_question TEXT");
                await hotfixClient.query("ALTER TABLE staff_login ADD COLUMN IF NOT EXISTS security_answer TEXT");
                await hotfixClient.query("ALTER TABLE staff_login ADD COLUMN IF NOT EXISTS recovery_code TEXT");

                // 13. Auto-Absent Support (Nullable staff_id)
                await hotfixClient.query("ALTER TABLE absent ALTER COLUMN staff_id DROP NOT NULL");

                // 14. Holiday & Schedule Configuration
                await hotfixClient.query("ALTER TABLE configurations ADD COLUMN IF NOT EXISTS fixed_weekday_schedule BOOLEAN DEFAULT TRUE");
                await hotfixClient.query("ALTER TABLE sections ADD COLUMN IF NOT EXISTS allowed_days TEXT");

                // 15. Calendar Tables
                await hotfixClient.query(`
                    CREATE TABLE IF NOT EXISTS calendar_config (
                        id SERIAL PRIMARY KEY,
                        country TEXT DEFAULT 'PH',
                        state TEXT,
                        region TEXT
                    )
                `);

                // Ensure default calendar config
                const calConfigCheck = await hotfixClient.query('SELECT 1 FROM calendar_config LIMIT 1');
                if (calConfigCheck.rows.length === 0) {
                    await hotfixClient.query("INSERT INTO calendar_config (country) VALUES ('PH')");
                }

                await hotfixClient.query(`
                    CREATE TABLE IF NOT EXISTS calendar_custom_holidays (
                        id SERIAL PRIMARY KEY,
                        name TEXT NOT NULL,
                        date TEXT NOT NULL,
                        type TEXT DEFAULT 'event'
                    )
                `);

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


// [EVENT ATTENDANCE]
// Get attendance for an event
app.get('/api/events/attendance/:event_id', async (req, res) => {
    const { event_id } = req.params;
    const client = await pool.connect();
    try {
        const query = `
            SELECT 
                ea.id, 
                ea.event_id, 
                ea.student_id, 
                ea.time_in, 
                ea.location,
                s.first_name, 
                s.last_name,
                s.classroom_section as section,
                s.profile_image_path as profile_image
            FROM event_attendance ea
            JOIN students s ON ea.student_id = s.student_id
            WHERE ea.event_id = $1
            ORDER BY ea.time_in DESC
        `;
        const result = await client.query(query, [event_id]);
        res.json(result.rows);
    } catch (err) {
        debugLogWriteToFile(`[EVENT ATTENDANCE] GET ERROR: ${err.message}`);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// Manually add attendance record
app.post('/api/events/attendance/add', async (req, res) => {
    const { event_id, student_id, location, time_in } = req.body;
    const client = await pool.connect();
    try {
        const query = `INSERT INTO event_attendance (event_id, student_id, location, time_in) VALUES ($1, $2, $3, $4)`;
        await client.query(query, [event_id, student_id, location || 'Manual', time_in || new Date()]);
        res.json({ success: true });
    } catch (err) {
        debugLogWriteToFile(`[EVENT ATTENDANCE] ADD ERROR: ${err.message}`);
        res.status(500).json({ error: err.message });
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

// [EVENT ATTENDANCE]
// Get attendance for an event
app.get('/api/events/attendance/:event_id', async (req, res) => {
    const { event_id } = req.params;
    const client = await pool.connect();
    try {
        const query = `
            SELECT 
                ea.id, 
                ea.event_id, 
                ea.student_id, 
                ea.time_in, 
                ea.location,
                s.first_name, 
                s.last_name,
                s.classroom_section as section,
                s.profile_image_path as profile_image
            FROM event_attendance ea
            JOIN students s ON ea.student_id = s.student_id
            WHERE ea.event_id = $1
            ORDER BY ea.time_in DESC
        `;
        const result = await client.query(query, [event_id]);
        res.json(result.rows);
    } catch (err) {
        debugLogWriteToFile(`[EVENT ATTENDANCE] GET ERROR: ${err.message}`);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// Manually add attendance record
app.post('/api/events/attendance/add', async (req, res) => {
    const { event_id, student_id, location, time_in } = req.body;
    const client = await pool.connect();
    try {
        const query = `INSERT INTO event_attendance (event_id, student_id, location, time_in) VALUES ($1, $2, $3, $4)`;
        await client.query(query, [event_id, student_id, location || 'Manual', time_in || new Date()]);
        res.json({ success: true });
    } catch (err) {
        debugLogWriteToFile(`[EVENT ATTENDANCE] ADD ERROR: ${err.message}`);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});


// [EVENT STAFF]
// Get staff assigned to event
app.get('/api/events/staff/:event_id', async (req, res) => {
    const { event_id } = req.params;
    const client = await pool.connect();
    try {
        const query = `
            SELECT es.id, es.event_id, es.staff_id, es.role, es.assigned_at, sa.name, sa.email_address, sa.profile_image_path as profile_image
            FROM event_staff es
            JOIN staff_accounts sa ON es.staff_id = sa.staff_id
            WHERE es.event_id = $1
            ORDER BY sa.name ASC
        `;
        const result = await client.query(query, [event_id]);
        res.json(result.rows);
    } catch (err) {
        debugLogWriteToFile(`[EVENT STAFF] GET ERROR: ${err.message}`);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// Add staff to event
app.post('/api/events/staff/add', async (req, res) => {
    const { event_id, staff_id, role } = req.body;
    const client = await pool.connect();
    try {
        await client.query('INSERT INTO event_staff (event_id, staff_id, role) VALUES ($1, $2, $3)', [event_id, staff_id, role || 'Staff']);
        res.json({ success: true });
    } catch (err) {
        debugLogWriteToFile(`[EVENT STAFF] ADD ERROR: ${err.message}`);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// Remove staff from event
app.delete('/api/events/staff/delete', async (req, res) => {
    const { event_id, staff_id } = req.body;
    const client = await pool.connect();
    try {
        await client.query('DELETE FROM event_staff WHERE event_id = $1 AND staff_id = $2', [event_id, staff_id]);
        res.json({ success: true });
    } catch (err) {
        debugLogWriteToFile(`[EVENT STAFF] DELETE ERROR: ${err.message}`);
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
        await client.query(query, [s_student_id, s_first_name, s_last_name, s_section, s_status, sanitizedGender, imagePath, s_ec_name, s_ec_phone, s_ec_rel, qr_code_token]);
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
    // const query = 'SELECT * FROM staff_login WHERE username = $1';
    const query = `
        SELECT sl.*, sa.name, sa.staff_type
        FROM staff_login sl
        LEFT JOIN staff_accounts sa ON sl.staff_id = sa.staff_id
        WHERE sl.username = $1
    `;
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
                    message: 'Admin credentials are valid',
                    staff_id: admin.staff_id,
                    name: admin.name,
                    role: admin.staff_type
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
    const logo_directory = req.file ? `/assets/images/logos/${req.file.filename}` : null;

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

        const params = [school_name, school_type || null, address || null, logo_directory, organization_hotline || null, country_code]

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
            status: actualTables.includes(table) ? 'exists' : 'missing'
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

        // Get Late Treshold!
        const configRes = await client.query("SELECT time_late_threshold FROM configurations LIMIT 1");
        const lateThreshold = configRes.rows[0]?.time_late_threshold || '08:00:00';

        const lateTodayRes = await client.query("SELECT COUNT(DISTINCT student_id) FROM present WHERE time_in::date = CURRENT_DATE AND time_in::time > $1", [lateThreshold]);
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

        // Version check
        const versionMatch = migrationSql.match(/--\s*Version:\s*(\d+(\.\d+)*)/i);
        const newVersion = versionMatch ? versionMatch[1] : null;

        if (newVersion) {

            // First we check if the column exists to avoid crash on old DBs
            const checkCol = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'configurations' and column_name = 'db_version'`);

            let currentVersion = '0.0.0';
            if (checkCol.rows.length > 0) {
                const configRes = await client.query('SELECT db_version FROM configurations LIMIT 1');
                currentVersion = configRes.rows[0]?.db_version || '0.0.0';
            }

            if (compareVersions(newVersion, currentVersion) <= 0) {
                throw new Error(`Migration version: (${newVersion}) is not greater than current database version. Any downgrades or re-runs are not allowed.`);
            }
        }

        await client.query(migrationSql);

        if (newVersion) {
            await client.query(`ALTER TABLE configurations ADD COLUMN IF NOT EXISTS db_version TEXT DEFAULT '0.0.0'`);
            await client.query(`UPDATE configurations SET db_version = $1`, [newVersion]);
        }


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

        const configRes = await client.query("SELECT time_late_threshold FROM configurations LIMIT 1");
        const lateThreshold = configRes.rows[0]?.time_late_threshold || '08:00:00';
        const lateRes = await client.query("SELECT COUNT(*) FROM present WHERE student_id = $1 AND time_in::time > $2", [student_id, lateThreshold]);


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
                s.allowed_days,
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
            schedule: row.schedule_data || [],
            allowed_days: row.allowed_days || ''
        }));
        res.json(mapped);
    } catch (err) {
        debugLogWriteToFile(`[SECTIONS] ERROR: ${err.message}`);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// Get Section Stats (Heatmap Data)
app.get('/api/sections/stats/:section_id', async (req, res) => {
    const { section_id } = req.params;
    const client = await pool.connect();
    try {
        const secRes = await client.query('SELECT section_name FROM sections WHERE section_id = $1', [section_id]);
        if (secRes.rows.length === 0) return res.status(404).json({ error: 'Section not found' });
        const sectionName = secRes.rows[0].section_name;

        const query = `
            SELECT 
                to_char(p.time_in, 'YYYY-MM-DD') as date,
                COUNT(DISTINCT p.student_id)::int as count
            FROM present p
            JOIN students s ON p.student_id = s.student_id
            WHERE s.classroom_section = $1
            AND p.time_in > CURRENT_DATE - INTERVAL '1 year'
            GROUP BY to_char(p.time_in, 'YYYY-MM-DD')
        `;
        const result = await client.query(query, [sectionName]);
        res.json(result.rows);
    } catch (err) {
        debugLogWriteToFile(`[SECTIONS] STATS ERROR: ${err.message}`);
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
            INSERT INTO sections (section_name, adviser_staff_id, room_number, grade_level, strand, schedule_data, allowed_days)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING section_id
        `;
        await client.query(query, [name, adviser_id || null, room, grade_level || null, strand || null, JSON.stringify(schedule || []), req.body.allowed_days || null]);
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
            SET section_name = $1, adviser_staff_id = $2, room_number = $3, grade_level = $4, strand = $5, schedule_data = $6, allowed_days = $7
            WHERE section_id = $8
        `;
        await client.query(query, [name, adviser_id || null, room, grade_level || null, strand || null, JSON.stringify(schedule || []), req.body.allowed_days || null, id]);
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

// Change password
app.put('/api/staff/change-password', async (req, res) => {
    const { staff_id, new_password } = req.body;
    if (!staff_id || !new_password) return res.status(400).json({ error: 'Missing parameters' });

    const client = await pool.connect();
    try {
        const hashedPassword = await bcrypt.hash(new_password, 10);
        const result = await client.query('UPDATE staff_login SET password = $1 WHERE staff_id = $2', [hashedPassword, staff_id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'Staff login record not found' });
        res.json({ success: true });
    } catch (err) {
        debugLogWriteToFile(`[STAFF] PASSWORD UPDATE ERROR: ${err.message}`);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});


// [EVENTS]
// Get all events
app.get('/api/events/list', async (req, res) => {
    const client = await pool.connect();
    try {
        const query = `
            SELECT 
                event_id as id,
                event_name as name,
                event_type as type,
                location,
                start_datetime as start,
                end_datetime as end,
                status,
                attendee_count,
                event_hash,
                secure_mode
            FROM events 
            ORDER BY start_datetime DESC
        `;
        const result = await client.query(query);
        res.json(result.rows);
    } catch (err) {
        debugLogWriteToFile(`[EVENTS] ERROR: ${err.message}`);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// Add event
app.post('/api/events/add', async (req, res) => {
    const { name, type, location, start, end, status, created_by, event_hash, secure_mode } = req.body;
    const client = await pool.connect();
    try {
        const query = `
            INSERT INTO events (event_name, event_type, location, start_datetime, end_datetime, status, created_by_staff_id, event_hash, secure_mode)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING event_id
        `;
        await client.query(query, [name, type, location, start, end, status || 'planned', created_by || null, event_hash || null, secure_mode || false]);
        res.json({ success: true });
    } catch (err) {
        debugLogWriteToFile(`[EVENTS] ADD ERROR: ${err.message}`);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// Update event
app.put('/api/events/update', async (req, res) => {
    const { id, name, type, location, start, end, status, event_hash, secure_mode } = req.body;
    const client = await pool.connect();
    try {
        const query = `
            UPDATE events
            SET event_name = $1, event_type = $2, location = $3, start_datetime = $4, end_datetime = $5, status = $6, event_hash = $7, secure_mode = $8
            WHERE event_id = $9
        `;
        await client.query(query, [name, type, location, start, end, status, event_hash, secure_mode, id]);
        res.json({ success: true });
    } catch (err) {
        debugLogWriteToFile(`[EVENTS] UPDATE ERROR: ${err.message}`);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// Delete event
app.delete('/api/events/delete', async (req, res) => {
    const { id } = req.body;
    const client = await pool.connect();
    try {
        await client.query('DELETE FROM events WHERE event_id = $1', [id]);
        res.json({ success: true });
    } catch (err) {
        debugLogWriteToFile(`[EVENTS] DELETE ERROR: ${err.message}`);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// [EVENT NOTES]
// Get notes for an event
app.get('/api/events/notes/:event_id', async (req, res) => {
    const { event_id } = req.params;
    const client = await pool.connect();
    try {
        const query = `
            SELECT en.note_id, en.event_id, en.staff_id, en.note_content, en.created_at, sa.name as staff_name
            FROM event_notes en
            LEFT JOIN staff_accounts sa ON en.staff_id = sa.staff_id
            WHERE en.event_id = $1
            ORDER BY en.created_at DESC
        `;
        const result = await client.query(query, [event_id]);
        res.json(result.rows);
    } catch (err) {
        debugLogWriteToFile(`[EVENT NOTES] GET ERROR: ${err.message}`);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// Add note to event
app.post('/api/events/notes/add', async (req, res) => {
    const { event_id, staff_id, content } = req.body;
    const client = await pool.connect();
    try {
        const query = `INSERT INTO event_notes (event_id, staff_id, note_content) VALUES ($1, $2, $3)`;
        await client.query(query, [event_id, staff_id, content]);
        res.json({ success: true });
    } catch (err) {
        debugLogWriteToFile(`[EVENT NOTES] ADD ERROR: ${err.message}`);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// Delete note
app.delete('/api/events/notes/delete', async (req, res) => {
    const { note_id } = req.body;
    const client = await pool.connect();
    try {
        await client.query('DELETE FROM event_notes WHERE note_id = $1', [note_id]);
        res.json({ success: true });
    } catch (err) {
        debugLogWriteToFile(`[EVENT NOTES] DELETE ERROR: ${err.message}`);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});


// Remove attendance record
app.delete('/api/events/attendance/delete', async (req, res) => {
    const { id } = req.body;
    const client = await pool.connect();
    try {
        await client.query('DELETE FROM event_attendance WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (err) {
        debugLogWriteToFile(`[EVENT ATTENDANCE] DELETE ERROR: ${err.message}`);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});


// Export Event Tickets (ZIP of QR Codes)
app.get('/api/events/export-tickets/:event_id', async (req, res) => {
    const { event_id } = req.params;
    const client = await pool.connect();

    try {
        // 1. Get Event Details
        const eventRes = await client.query('SELECT event_name, event_hash, secure_mode FROM events WHERE event_id = $1', [event_id]);
        if (eventRes.rows.length === 0) return res.status(404).json({ error: 'Event not found' });
        const event = eventRes.rows[0];

        // 1.5 Get School Year
        const configRes = await client.query('SELECT school_year FROM configurations LIMIT 1');
        const schoolYear = configRes.rows[0]?.school_year || '';

        // 2. Get Active Students
        const studentsRes = await client.query("SELECT student_id, first_name, last_name FROM students WHERE status = 'Active'");
        const students = studentsRes.rows;

        // 3. Setup Zip Stream
        const filename = `tickets_${event.event_name.replace(/\s+/g, '-')}.zip`;
        res.attachment(filename);
        const archive = archiver('zip', { zlib: { level: 9 } });

        archive.on('error', (err) => { throw err; });
        archive.pipe(res);

        // 4. Generate QRs
        for (const student of students) {
            let qrData;
            if (event.secure_mode) {
                // Secure Format: HASH|STUDENT_ID|SCHOOL_YEAR
                qrData = `${event.event_hash}|${student.student_id}|${schoolYear}`;
            } else {
                // Standard: STUDENT_ID
                qrData = student.student_id;
            }

            const buffer = await QRCode.toBuffer(qrData, { width: 300, margin: 2 });
            const studentName = `${student.first_name}-${student.last_name}`.replace(/\s+/g, '-');
            const eventName = event.event_name.replace(/\s+/g, '-');
            const imgFilename = `event_${eventName}_${studentName}.png`;

            archive.append(buffer, { name: imgFilename });
        }

        await archive.finalize();
    } catch (err) {
        debugLogWriteToFile(`[EVENTS] EXPORT TICKETS ERROR: ${err.message}`);
        if (!res.headersSent) res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// Export Section Tickets (ZIP of QR Codes)
app.get('/api/sections/export-tickets/:section_id', async (req, res) => {
    const { section_id } = req.params;
    const client = await pool.connect();
    try {
        // 1. Get Section Name
        const secRes = await client.query('SELECT section_name FROM sections WHERE section_id = $1', [section_id]);
        if (secRes.rows.length === 0) return res.status(404).json({ error: 'Section not found' });
        const sectionName = secRes.rows[0].section_name;

        // 1.5 Get School Year
        const configRes = await client.query('SELECT school_year FROM configurations LIMIT 1');
        const schoolYear = configRes.rows[0]?.school_year || '';

        // 2. Get Students
        const studentsRes = await client.query("SELECT student_id, first_name, last_name FROM students WHERE classroom_section = $1 AND status = 'Active'", [sectionName]);
        const students = studentsRes.rows;

        // 3. Zip
        const filename = `tickets_${sectionName.replace(/\s+/g, '-')}.zip`;
        res.attachment(filename);
        const archive = archiver('zip', { zlib: { level: 9 } });
        archive.on('error', (err) => { throw err; });
        archive.pipe(res);

        for (const student of students) {
            const qrData = schoolYear ? `${student.student_id}|${schoolYear}` : student.student_id;
            const buffer = await QRCode.toBuffer(qrData, { width: 300, margin: 2 });
            const studentName = `${student.first_name}-${student.last_name}`.replace(/\s+/g, '-');
            const imgFilename = `${studentName}.png`;
            archive.append(buffer, { name: imgFilename });
        }
        await archive.finalize();
    } catch (err) {
        debugLogWriteToFile(`[SECTIONS] EXPORT TICKETS ERROR: ${err.message}`);
        if (!res.headersSent) res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// [REPORTS]
// Get daily attendance report
app.get('/api/reports/daily', async (req, res) => {
    const { start_date, end_date } = req.query;
    const client = await pool.connect();
    try {
        // Default to prev 30 days if not provided
        const end = end_date || new Date().toISOString().split('T')[0];
        const start = start_date || new Date(Date.now() - 30 * 24 * 60 * 1000).toISOString().split('T')[0];

        const configRes = await client.query("SELECT time_late_threshold FROM configurations LIMIT 1");
        const lateThreshold = configRes.rows[0]?.time_late_threshold || '08:00:00';

        const query = `
            SELECT
                to_char(d, 'YYYY-MM-DD') as date,
                (SELECT COUNT(*) FROM students WHERE status = 'Active') as total,
                COALESCE(COUNT(DISTINCT p.student_id), 0)::int as present,
                (SELECT COUNT(*) FROM absent a WHERE a.absent_datetime::date = d::date)::int as absent,
                COALESCE(COUNT(DISTINCT CASE WHEN p.time_in::time > $3 THEN p.student_id END), 0)::int as late
            FROM generate_series($1::date, $2::date, '1 day') d
            LEFT JOIN present p ON p.time_in::date = d::date
            GROUP BY d
            ORDER BY d DESC
        `;

        const result = await client.query(query, [start, end, lateThreshold]);
        res.json(result.rows);
    } catch (err) {
        debugLogWriteToFile(`[REPORTS]: Daily Report Error: ${err.message}`)
        console.log(`[REPORT]: Fatal error on the Daily report: ${err.message}`);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});


// [EXPORT]
// Get Export Permissions and Sections
app.get('/api/export/permissions', async (req, res) => {
    const { staff_id } = req.query;
    if (!staff_id) return res.status(400).json({ error: 'Staff ID required' });

    const client = await pool.connect();
    try {
        // 1. Get Staff Role
        const staffRes = await client.query('SELECT staff_type FROM staff_accounts WHERE staff_id = $1', [staff_id]);
        if (staffRes.rows.length === 0) return res.status(404).json({ error: 'Staff not found' });

        const role = staffRes.rows[0].staff_type;
        let sections = [];

        // 2. Get Sections based on role
        if (role === 'teacher') {
            // Only advised sections
            const secRes = await client.query('SELECT section_id as id, section_name as name FROM sections WHERE adviser_staff_id = $1 ORDER BY section_name', [staff_id]);
            sections = secRes.rows;
        } else {
            // Admin/Staff/Security/StudentCouncil - All sections
            const secRes = await client.query('SELECT section_id as id, section_name as name FROM sections ORDER BY section_name');
            sections = secRes.rows;
        }

        res.json({ role, sections });
    } catch (err) {
        debugLogWriteToFile(`[EXPORT] PERMISSIONS ERROR: ${err.message}`);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// Generate Export Report
app.get('/api/export/generate', async (req, res) => {
    const { section_id, month, format } = req.query; // month in YYYY-MM
    if (!section_id || !month) return res.status(400).json({ error: 'Missing parameters' });

    const client = await pool.connect();
    try {
        // 1. Get Config & Section Details
        const configRes = await client.query('SELECT school_name, school_id, school_year FROM configurations LIMIT 1');
        const config = configRes.rows[0] || {};

        const secRes = await client.query('SELECT section_name, grade_level FROM sections WHERE section_id = $1', [section_id]);
        if (secRes.rows.length === 0) return res.status(404).json({ error: 'Section not found' });
        const section = secRes.rows[0];
        const sectionName = section.section_name;

        // 2. Get Students in Section
        const studentsRes = await client.query(`
            SELECT student_id, last_name, first_name, gender 
            FROM students 
            WHERE classroom_section = $1 AND status = 'Active'
            ORDER BY gender, last_name
        `, [sectionName]);
        const students = studentsRes.rows;

        // 3. Get Attendance for Month
        const startOfMonth = `${month}-01`;
        const endOfMonth = new Date(new Date(month).getFullYear(), new Date(month).getMonth() + 1, 0).toISOString().split('T')[0];

        const attendanceRes = await client.query(`
            SELECT student_id, to_char(time_in, 'YYYY-MM-DD') as date
            FROM present 
            WHERE time_in >= $1::date AND time_in <= $2::date
        `, [startOfMonth, endOfMonth]);

        const attendanceMap = {};
        attendanceRes.rows.forEach(row => {
            if (!attendanceMap[row.student_id]) attendanceMap[row.student_id] = new Set();
            attendanceMap[row.student_id].add(row.date);
        });

        // 4. Generate CSV
        // Get all days in month
        const daysInMonth = [];
        const date = new Date(startOfMonth);
        const lastDate = new Date(endOfMonth);
        while (date <= lastDate) {
            daysInMonth.push(date.toISOString().split('T')[0]);
            date.setDate(date.getDate() + 1);
        }

        let csvContent = '';
        csvContent += `School Name:,"${config.school_name || ''}",School ID:,"${config.school_id || ''}"\n`;
        csvContent += `School Year:,"${config.school_year || ''}",Month:,"${month}"\n`;
        csvContent += `Grade & Section:,"${section.grade_level ? 'Grade ' + section.grade_level + ' - ' : ''}${sectionName}"\n\n`;

        csvContent += `Student ID,Last Name,First Name,Gender,${daysInMonth.join(',')},Total Present\n`;

        students.forEach(student => {
            const row = [
                student.student_id,
                `"${student.last_name}"`,
                `"${student.first_name}"`,
                student.gender
            ];

            let presentCount = 0;
            daysInMonth.forEach(day => {
                if (attendanceMap[student.student_id] && attendanceMap[student.student_id].has(day)) {
                    row.push('P');
                    presentCount++;
                } else {
                    row.push('A');
                }
            });

            row.push(presentCount);
            csvContent += row.join(',') + '\n';
        });

        const filename = `Attendance_${sectionName.replace(/\s+/g, '_')}_${month}.csv`;

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(csvContent);

    } catch (err) {
        debugLogWriteToFile(`[EXPORT] GENERATE ERROR: ${err.message}`);
        if (!res.headersSent) res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// [SMS SYSTEM]
// Get SMS Settings
app.get('/api/sms/settings', async (req, res) => {
    const client = await pool.connect();
    try {
        // Ensure table exists
        await client.query(`
            CREATE TABLE IF NOT EXISTS sms_provider_settings (
                id SERIAL PRIMARY KEY,
                provider_type TEXT DEFAULT 'api',
                sms_enabled BOOLEAN DEFAULT false,
                api_url TEXT,
                api_key TEXT,
                tty_path TEXT,
                baud_rate INTEGER,
                message_template TEXT,
                curl_config_json TEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Hotfix: Add columns for ZTE/Modem IP if they don't exist
        await client.query(`ALTER TABLE sms_provider_settings ADD COLUMN IF NOT EXISTS modem_ip TEXT`);
        await client.query(`ALTER TABLE sms_provider_settings ADD COLUMN IF NOT EXISTS modem_password TEXT`);

        const result = await client.query('SELECT * FROM sms_provider_settings ORDER BY id DESC LIMIT 1');
        res.json(result.rows[0] || {});
    } catch (err) {
        debugLogWriteToFile(`[SMS] GET SETTINGS ERROR: ${err.message}`);
        console.log(`[SMS] SMS Configuration Fetch Failed: ${err.message}`)
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// Save SMS Settings
app.post('/api/sms/settings', async (req, res) => {
    const { provider_type, sms_enabled, api_url, api_key, tty_path, baud_rate, message_template, curl_config_json, modem_ip, modem_password } = req.body;
    const client = await pool.connect();
    try {
        await client.query(`
            INSERT INTO sms_provider_settings (provider_type, sms_enabled, api_url, api_key, tty_path, baud_rate, message_template, curl_config_json, modem_ip, modem_password)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [provider_type, sms_enabled, api_url, api_key, tty_path, baud_rate, message_template, curl_config_json, modem_ip, modem_password]);
        res.json({ success: true });
    } catch (err) {
        debugLogWriteToFile(`[SMS] SAVE SETTINGS ERROR: ${err.message}`);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// Get SMS Logs
app.get('/api/sms/logs', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS sms_logs (
                sms_id SERIAL PRIMARY KEY,
                recipient_number TEXT,
                recipient_name TEXT,
                related_student_id TEXT,
                message_body TEXT,
                status TEXT,
                sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                error_message TEXT
            )
        `);
        const result = await client.query('SELECT * FROM sms_logs ORDER BY sent_at DESC LIMIT 100');
        res.json(result.rows);
    } catch (err) {
        debugLogWriteToFile(`[SMS] GET LOGS ERROR: ${err.message}`);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// Send SMS (Test)
app.post('/api/sms/send', async (req, res) => {
    const { recipient_number, message_body } = req.body;
    const client = await pool.connect();
    try {
        // Fetch settings to determine how to send
        const settingsRes = await client.query('SELECT * FROM sms_provider_settings ORDER BY id DESC LIMIT 1');
        const settings = settingsRes.rows[0];

        if (settings && settings.sms_enabled) {
            if (settings.provider_type === 'zte') {
                if (!ZteModem) throw new Error("ZTE-SMS library is not installed on the server.");
                const myModem = new ZteModem({
                    modemIP: settings.modem_ip || '192.168.0.1',
                    modemPassword: settings.modem_password
                });
                await myModem.sendSms(recipient_number, message_body);
            }
        }

        await client.query("INSERT INTO sms_logs (recipient_number, message_body, status) VALUES ($1, $2, 'sent')", [recipient_number, message_body]);
        res.json({ success: true });
    } catch (err) {
        await client.query("INSERT INTO sms_logs (recipient_number, message_body, status, error_message) VALUES ($1, $2, 'failed', $3)", [recipient_number, message_body, err.message]);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// [ID CARDS]
// Get all users for ID generation
app.get('/api/id-cards/list', async (req, res) => {
    const client = await pool.connect();
    try {
        // Config
        const configRes = await client.query('SELECT school_name, principal_name, principal_title, school_year, logo_directory FROM configurations LIMIT 1');
        const config = configRes.rows[0] || {
            school_name: 'School',
            principal_name: 'Principal Name',
            principal_title: 'Principal',
            school_year: '2026-2027'
        };
        // Students
        const studentsQuery = `
            SELECT 
                student_id, first_name, last_name, classroom_section, 
                emergency_contact_name, emergency_contact_phone, emergency_contact_relationship,
                profile_image_path
            FROM students 
            WHERE status = 'Active'
            ORDER BY last_name ASC
        `;
        const studentsRes = await client.query(studentsQuery);

        // Staff
        const staffQuery = `
            SELECT 
                staff_id, name, staff_type, profile_image_path
            FROM staff_accounts 
            WHERE active = 1
            ORDER BY name ASC
        `;
        const staffRes = await client.query(staffQuery);

        const users = [];

        // Process Students
        studentsRes.rows.forEach(s => {
            users.push({
                id: `student-${s.student_id}`,
                type: 'student',
                name: `${s.first_name} ${s.last_name}`,
                idNumber: s.student_id,
                section: s.classroom_section || 'Unassigned',
                emergency: s.emergency_contact_name ? `${s.emergency_contact_name} (${s.emergency_contact_relationship || 'Contact'}) - ${s.emergency_contact_phone || ''}` : 'N/A',
                profile_image: s.profile_image_path
            });
        });

        // Process Staff
        staffRes.rows.forEach(s => {
            users.push({
                id: `staff-${s.staff_id}`,
                type: 'staff',
                name: s.name,
                idNumber: s.staff_id,
                role: s.staff_type.charAt(0).toUpperCase() + s.staff_type.slice(1).replace('_', ' '),
                emergency: 'N/A', // Staff DB doesn't have emergency contact yet
                profile_image: s.profile_image_path
            });
        });

        res.json({ users, config });
    } catch (err) {
        debugLogWriteToFile(`[ID CARDS] LIST ERROR: ${err.message}`);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// [CONF-GET]
// Get Configuration
app.get('/api/setup/configuration', async (req, res) => {
    const client = await pool.connect();
    try {
        const result = await client.query('SELECT * FROM configurations LIMIT 1');
        res.json(result.rows[0] || {});
    } catch (err) {
        debugLogWriteToFile(`[CONF] GET ERROR: ${err.message}`);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// [CONF-UPDATE]
// Update Configuration
app.put('/api/setup/configuration', upload, async (req, res) => {
    const { school_name, school_id, country_code, address, principal_name, principal_title, school_year, maintenance_mode, ntp_server, time_in_start, time_late_threshold, time_out_target, fixed_weekday_schedule } = req.body;

    const client = await pool.connect();
    try {
        // Check if config exists (Single Row Policy)
        const check = await client.query('SELECT config_id FROM configurations LIMIT 1');

        if (check.rows.length === 0) {
            // Insert (Only if table is empty)
            const logoPath = req.file ? `/assets/images/logos/${req.file.filename}` : null;
            await client.query(
                `INSERT INTO configurations (school_name, school_id, country_code, address, principal_name, principal_title, school_year, logo_directory, maintenance_mode, ntp_server, time_in_start, time_late_threshold, time_out_target, fixed_weekday_schedule)
                  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
                [school_name, school_id, country_code, address, principal_name, principal_title, school_year, logoPath, maintenance_mode === 'true', ntp_server || 'pool.ntp.org', time_in_start || '05:00:00', time_late_threshold || '08:00:00', time_out_target || '16:00:00', fixed_weekday_schedule === 'true']
            );
        } else {
            // Update existing row
            const id = check.rows[0].config_id;
            let query = `
                UPDATE configurations 
                SET school_name = COALESCE($1, school_name), school_id = COALESCE($2, school_id), country_code = COALESCE($3, country_code), address = COALESCE($4, address), principal_name = COALESCE($5, principal_name), principal_title = COALESCE($6, principal_title), school_year = COALESCE($7, school_year), ntp_server = COALESCE($8, ntp_server),
                time_in_start = COALESCE($9, time_in_start), time_late_threshold = COALESCE($10, time_late_threshold), time_out_target = COALESCE($11, time_out_target)
            `;
            const params = [
                school_name || null, school_id || null, country_code || null, address || null,
                principal_name || null, principal_title || null, school_year || null, ntp_server || null,
                time_in_start || null, time_late_threshold || null, time_out_target || null
            ];

            if (req.file) {
                query += `, logo_directory = $12, maintenance_mode = COALESCE($13, maintenance_mode), fixed_weekday_schedule = COALESCE($15, fixed_weekday_schedule) WHERE config_id = $14`;
                params.push(`/assets/images/logos/${req.file.filename}`, maintenance_mode !== undefined ? maintenance_mode === 'true' : null, id, fixed_weekday_schedule !== undefined ? fixed_weekday_schedule === 'true' : null);
            } else {
                query += `, maintenance_mode = COALESCE($12, maintenance_mode), fixed_weekday_schedule = COALESCE($14, fixed_weekday_schedule) WHERE config_id = $13`;
                params.push(maintenance_mode !== undefined ? maintenance_mode === 'true' : null, id, fixed_weekday_schedule !== undefined ? fixed_weekday_schedule === 'true' : null);
            }
            await client.query(query, params);
        }
        res.json({ success: true });
    } catch (err) {
        debugLogWriteToFile(`[CONF] UPDATE ERROR: ${err.message}`);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// [DATABASE]
// Backup Database
app.get('/api/database/backup', (req, res) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup_openattendance_${timestamp}.sql`;
    const filePath = path.join(backupsDir, filename);

    const dbUser = process.env.DB_USER || 'postgres';
    const dbHost = process.env.DB_HOST || 'localhost';
    const dbName = process.env.DB_NAME || 'openattendance';
    const dbPassword = process.env.DB_PASSWORD || 'password';
    const dbPort = process.env.DB_PORT || 5432;

    // Use PGPASSWORD env var to avoid password prompt
    const env = { ...process.env, PGPASSWORD: dbPassword };
    const command = `pg_dump -U ${dbUser} -h ${dbHost} -p ${dbPort} -F p ${dbName} > "${filePath}"`;

    debugLogWriteToFile(`[DATABASE] Starting backup to ${filePath}`);

    exec(command, { env }, (error, stdout, stderr) => {
        if (error) {
            debugLogWriteToFile(`[DATABASE] Backup Error: ${error.message}`);
            return res.status(500).json({ error: 'Backup generation failed', details: error.message });
        }

        res.download(filePath, filename, (err) => {
            if (err) debugLogWriteToFile(`[DATABASE] Download Error: ${err.message}`);
            else debugLogWriteToFile(`[DATABASE] Backup downloaded successfully`);
        });
    });
});

// Backup Database to Server (Local)
app.post('/api/database/backup-local', (req, res) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `server_backup_${timestamp}.sql`;
    const filePath = path.join(backupsDir, filename);

    const dbUser = process.env.DB_USER || 'postgres';
    const dbHost = process.env.DB_HOST || 'localhost';
    const dbName = process.env.DB_NAME || 'openattendance';
    const dbPassword = process.env.DB_PASSWORD || 'password';
    const dbPort = process.env.DB_PORT || 5432;

    // Use PGPASSWORD env var to avoid password prompt
    const env = { ...process.env, PGPASSWORD: dbPassword };
    const command = `pg_dump -U ${dbUser} -h ${dbHost} -p ${dbPort} -F p ${dbName} > "${filePath}"`;

    debugLogWriteToFile(`[DATABASE] Starting local server backup to ${filePath}`);

    exec(command, { env }, (error, stdout, stderr) => {
        if (error) {
            debugLogWriteToFile(`[DATABASE] Local Backup Error: ${error.message}`);
            return res.status(500).json({ error: 'Backup generation failed', details: error.message });
        }

        debugLogWriteToFile(`[DATABASE] Local Backup created successfully at ${filePath}`);
        res.json({ success: true, message: 'Backup saved to server storage.', path: filePath, filename: filename });
    });
});


// Restore Database
const backupStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, tmpDir);
    },
    filename: function (req, file, cb) {
        cb(null, 'restore-' + Date.now() + '.sql');
    }
});
const uploadBackup = multer({ storage: backupStorage }).single('backup_file');

app.post('/api/database/restore', uploadBackup, (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No backup file provided' });

    const filePath = req.file.path;
    const dbUser = process.env.DB_USER || 'postgres';
    const dbHost = process.env.DB_HOST || 'localhost';
    const dbName = process.env.DB_NAME || 'openattendance';
    const dbPassword = process.env.DB_PASSWORD || 'password';
    const dbPort = process.env.DB_PORT || 5432;

    // Use PGPASSWORD env var to avoid password prompt
    const env = { ...process.env, PGPASSWORD: dbPassword };
    // psql command to restore
    const command = `psql -U ${dbUser} -h ${dbHost} -p ${dbPort} -d ${dbName} -f "${filePath}"`;

    debugLogWriteToFile(`[DATABASE] Starting restore from ${filePath}`);

    exec(command, { env }, (error, stdout, stderr) => {
        // Cleanup file
        fs.unlink(filePath, () => { });

        if (error) {
            debugLogWriteToFile(`[DATABASE] Restore Error: ${error.message}`);
            return res.status(500).json({ error: 'Restore failed', details: error.message });
        }

        debugLogWriteToFile(`[DATABASE] Restore completed successfully`);
        res.json({ success: true, message: 'Database restored successfully' });
    });
});

// Get Database Stats
app.get('/api/database/stats', async (req, res) => {
    const client = await pool.connect();
    try {
        const query = `
            SELECT
                relname as table_name,
                n_live_tup as row_count,
                pg_size_pretty(pg_total_relation_size(relid)) as total_size
            FROM pg_stat_user_tables
            ORDER BY pg_total_relation_size(relid) DESC;
        `;
        const result = await client.query(query);

        const stats = result.rows.map(row => ({
            table: row.table_name,
            rows: parseInt(row.row_count || 0),
            size: row.total_size
        }));

        res.json(stats);
    } catch (err) {
        debugLogWriteToFile(`[DATABASE] STATS ERROR: ${err.message}`);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// [MAINTENANCE]
// Perform Database Maintenance Tasks
app.post('/api/database/maintenance/:task', async (req, res) => {
    const { task } = req.params;
    const client = await pool.connect();
    try {
        if (task === 'vacuum') {
            await client.query('VACUUM ANALYZE');
            debugLogWriteToFile(`[MAINTENANCE] VACUUM ANALYZE executed.`);
            res.json({ message: 'Vacuum & Analyze completed successfully.' });
        } else if (task === 'reindex') {
            const tables = await client.query(`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`);
            for (const row of tables.rows) {
                await client.query(`REINDEX TABLE "${row.tablename}"`);
            }
            debugLogWriteToFile(`[MAINTENANCE] REINDEX executed on public tables.`);
            res.json({ message: 'Database Reindex completed successfully.' });
        } else if (task === 'logs') {
            const logDir = path.join(__dirname, 'data', 'logs');
            if (fs.existsSync(logDir)) {
                const files = fs.readdirSync(logDir);
                for (const file of files) {
                    try {
                        fs.unlinkSync(path.join(logDir, file));
                    } catch (e) {
                        // Ignore errors (e.g. file in use)
                    }
                }
            }
            debugLogWriteToFile(`[MAINTENANCE] System logs truncated.`);
            res.json({ message: 'System logs cleared.' });
        } else {
            res.status(400).json({ error: 'Invalid maintenance task' });
        }
    } catch (err) {
        debugLogWriteToFile(`[MAINTENANCE] ERROR (${task}): ${err.message}`);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// [LICENSES]
// Get Open Source Licenses
app.get('/api/system/licenses', (req, res) => {
    try {
        const packagesMap = new Map();
        const unknownLicenses = [];

        const scanDir = (basePath, sourceLabel) => {
            const modulesPath = path.join(basePath, 'node_modules');
            if (!fs.existsSync(modulesPath)) return;

            const processPackage = (pkgPath) => {
                const jsonPath = path.join(pkgPath, 'package.json');
                if (fs.existsSync(jsonPath)) {
                    try {
                        const pkg = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
                        if (!pkg.name) return;

                        let license = pkg.license;
                        if (!license && pkg.licenses) {
                            // Handle array or object format
                            if (Array.isArray(pkg.licenses)) {
                                license = pkg.licenses.map(l => (typeof l === 'object' ? l.type : l)).join(' OR ');
                            } else if (typeof pkg.licenses === 'object') {
                                license = pkg.licenses.type;
                            }
                        }

                        const info = {
                            name: pkg.name,
                            version: pkg.version,
                            license: license || null,
                            repository: pkg.repository ? (pkg.repository.url || pkg.repository) : null,
                            source: sourceLabel
                        };

                        if (!info.license) {
                            // Check if we already have this package with a license from another source
                            if (!packagesMap.has(pkg.name)) {
                                unknownLicenses.push(info);
                            }
                        } else {
                            // Merge logic: If exists, update source to 'Shared', otherwise set
                            if (packagesMap.has(pkg.name)) {
                                const existing = packagesMap.get(pkg.name);
                                if (existing.source !== info.source) existing.source = 'Shared';
                            } else {
                                packagesMap.set(pkg.name, info);
                            }
                        }
                    } catch (e) { /* ignore read errors */ }
                }
            };

            const items = fs.readdirSync(modulesPath);
            for (const item of items) {
                if (item.startsWith('.')) continue;
                if (item.startsWith('@')) {
                    const scopePath = path.join(modulesPath, item);
                    if (fs.existsSync(scopePath) && fs.statSync(scopePath).isDirectory()) {
                        const scopedItems = fs.readdirSync(scopePath);
                        for (const scopedItem of scopedItems) {
                            processPackage(path.join(scopePath, scopedItem));
                        }
                    }
                } else {
                    processPackage(path.join(modulesPath, item));
                }
            }
        };

        // Helper to process license-checker JSON report
        // M: Ah fuu its misaligned.
        const processLicenseFile = (filePath, sourceLabel) => {
            if (fs.existsSync(filePath)) {
                try {
                    const raw = fs.readFileSync(filePath, 'utf8');
                    const data = JSON.parse(raw);
                    Object.keys(data).forEach(key => {
                        // key format: package@version
                        const lastAt = key.lastIndexOf('@');
                        const name = key.substring(0, lastAt);
                        const version = key.substring(lastAt + 1);
                        const item = data[key];

                        let license = item.licenses;
                        if (Array.isArray(license)) license = license.join(' OR ');

                        const info = {
                            name: name,
                            version: version,
                            license: license || 'Unknown',
                            repository: item.repository,
                            source: sourceLabel
                        };

                        if (packagesMap.has(name)) {
                            const existing = packagesMap.get(name);
                            if (existing.source !== info.source) existing.source = 'Shared';
                        } else {
                            packagesMap.set(name, info);
                        }
                    });
                    return true;
                } catch (e) {
                    debugLogWriteToFile(`[LICENSES] Error reading license file ${filePath}: ${e.message}`);
                    return false;
                }
            }
            return false;
        };

        // Frontend: Try to read generated report from various possible locations
        // Priority: Env Var -> Adjacent File (Prod) -> Dev Paths
        const possiblePaths = [
            process.env.FRONTEND_LICENSE_PATH,
            path.join(__dirname, 'ff-licenses.json'),
            // This two are redundancies
            path.join(__dirname, '../openattendance-frontend/public/licenses.json'),
            path.join(__dirname, '../openattendance-frontend/dist/licenses.json')
        ];

        for (const p of possiblePaths) {
            if (p && processLicenseFile(p, 'Frontend')) {
                break; // Stop once we find a valid file
            }
        }


        scanDir(__dirname, 'Backend');
        scanDir(path.join(__dirname, '../openattendance-frontend'), 'Frontend');

        res.json({
            licensed: Array.from(packagesMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
            unknown: unknownLicenses
        });
    } catch (err) {
        debugLogWriteToFile(`[LICENSES] ERROR: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// [BENCHMARK-COMPREHENSIVE]
// Comprehensive Database Performance Test
app.get('/api/benchmark/comprehensive', async (req, res) => {
    const client = await pool.connect();
    const results = {};

    try {
        // 0. Setup: Ensure Benchmark Tables Exist
        const check = await client.query("SELECT to_regclass('public.perf_test_single_idx')");
        if (!check.rows[0].to_regclass) {
            debugLogWriteToFile(`[BENCHMARK] Tables missing. Applying benchmark schema...`);
            const schemaPath = path.join(__dirname, 'database_benchmark_schema.sql');
            if (fs.existsSync(schemaPath)) {
                const sql = fs.readFileSync(schemaPath, 'utf8');
                await client.query(sql);
            } else {
                throw new Error('Benchmark schema file missing.');
            }
        }

        // 1. One by one index writing, reading, and changing
        {
            const start = Date.now();
            await client.query('TRUNCATE perf_test_single_idx');
            for (let i = 0; i < 100; i++) {
                await client.query('INSERT INTO perf_test_single_idx (data, indexed_col) VALUES ($1, $2)', ['test_data', i]);
                await client.query('SELECT * FROM perf_test_single_idx WHERE indexed_col = $1', [i]);
                await client.query('UPDATE perf_test_single_idx SET data = $1 WHERE id = $2', ['updated', i + 1]);
            }
            results.single_index_rw_100_ops = `${Date.now() - start}ms`;
        }

        // 2. Multiple asynchronous write, read, and delete
        {
            const start = Date.now();
            await client.query('TRUNCATE perf_test_multi_idx');
            const promises = [];
            // Write
            for (let i = 0; i < 200; i++) {
                promises.push(client.query('INSERT INTO perf_test_multi_idx (data, col1, col2, col3) VALUES ($1, $2, $3, $4)', ['async', i, i, 'text']));
            }
            await Promise.all(promises);
            // Read
            const readPromises = [];
            for (let i = 0; i < 200; i++) {
                readPromises.push(client.query('SELECT * FROM perf_test_multi_idx WHERE col1 = $1', [i]));
            }
            await Promise.all(readPromises);
            // Delete
            const delPromises = [];
            for (let i = 0; i < 200; i++) {
                delPromises.push(client.query('DELETE FROM perf_test_multi_idx WHERE col1 = $1', [i]));
            }
            await Promise.all(delPromises);

            results.async_multi_rw_delete_200_batch = `${Date.now() - start}ms`;
        }

        // 3. Random write and read on random tables
        {
            const start = Date.now();
            const tables = ['perf_test_random_1', 'perf_test_random_2', 'perf_test_random_3'];
            for (let i = 0; i < 150; i++) {
                const tbl = tables[Math.floor(Math.random() * tables.length)];
                await client.query(`INSERT INTO ${tbl} (val) VALUES ($1)`, ['random_val']);
                await client.query(`SELECT * FROM ${tbl} LIMIT 1`);
            }
            results.random_table_io_150_ops = `${Date.now() - start}ms`;
        }

        // 4. Index Speed Comparison (Single vs Multi Overhead)
        // Using data from previous steps logic, we run a fresh micro-test
        {
            const startSingle = Date.now();
            for (let i = 0; i < 100; i++) await client.query('INSERT INTO perf_test_single_idx (data, indexed_col) VALUES ($1, $2)', ['comp', i]);
            const timeSingle = Date.now() - startSingle;

            const startMulti = Date.now();
            for (let i = 0; i < 100; i++) await client.query('INSERT INTO perf_test_multi_idx (data, col1, col2, col3) VALUES ($1, $2, $3, $4)', ['comp', i, i, 't']);
            const timeMulti = Date.now() - startMulti;

            results.index_overhead_100_inserts = {
                single_index: `${timeSingle}ms`,
                multi_index: `${timeMulti}ms`
            };
        }

        // 5. Barrage of commands (I/O Stress)
        {
            const start = Date.now();
            const barrage = [];
            for (let i = 0; i < 1000; i++) {
                barrage.push(client.query('INSERT INTO perf_test_barrage (val) VALUES (NOW())'));
            }
            await Promise.all(barrage);
            results.barrage_io_1000_concurrent = `${Date.now() - start}ms`;
        }

        // 6. Size Growth & Table Growth
        {
            // Size Growth: 48KB to 4096KB (4MB)
            await client.query('TRUNCATE perf_test_size_growth');
            const startSize = Date.now();
            const payload = 'x'.repeat(4096); // 4KB payload
            // Insert 1024 rows to reach ~4MB
            for (let i = 0; i < 1024; i++) {
                await client.query('INSERT INTO perf_test_size_growth (payload) VALUES ($1)', [payload]);
            }
            const sizeRes = await client.query("SELECT pg_size_pretty(pg_total_relation_size('perf_test_size_growth')) as size");
            results.size_growth_4mb = {
                time: `${Date.now() - startSize}ms`,
                final_size: sizeRes.rows[0].size
            };
        }

        res.json({ success: true, benchmark: results });
    } catch (err) {
        debugLogWriteToFile(`[BENCHMARK] ERROR: ${err.message}`);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// [ATTENDANCE-SCAN]
// Kiosk Scan Endpoint
app.post('/api/attendance/scan', async (req, res) => {
    const { qr_code, mode, event_id, location, staff_id, type } = req.body;
    const client = await pool.connect();
    const scanType = type || 'in'; // Default to 'in' if not specified

    try {
        // 1. Identify Student
        // QR code might be in format <student-id>|<school year> or <hash>|<student-id>|<school year>
        let studentIdToSearch = qr_code;
        if (qr_code && qr_code.includes('|')) {
            const parts = qr_code.split('|');
            if (parts.length >= 3) {
                studentIdToSearch = parts[1]; // <hash>|<id>|<year>
            } else {
                studentIdToSearch = parts[0]; // <id>|<year>
            }
        }

        const studentRes = await client.query("SELECT student_id, first_name, last_name FROM students WHERE student_id = $1", [studentIdToSearch]);
        if (studentRes.rows.length === 0) {
            return res.status(404).json({ error: 'Student not found' });
        }
        const student = studentRes.rows[0];

        if (mode === 'event') {
            if (!event_id) return res.status(400).json({ error: 'Event ID required for event mode' });

            // Check if already scanned for this event
            // We get the latest record to determine state
            const check = await client.query("SELECT id, time_out FROM event_attendance WHERE event_id = $1 AND student_id = $2 ORDER BY time_in DESC LIMIT 1", [event_id, student.student_id]);

            if (scanType === 'in') {
                // If latest record exists and has NO time_out, they are currently checked in.
                if (check.rows.length > 0 && !check.rows[0].time_out) {
                    return res.status(409).json({ error: 'Already checked in for this event', student });
                }
                // Otherwise (no record OR previous record has time_out), allow new entry
                await client.query(
                    "INSERT INTO event_attendance (event_id, student_id, location, time_in) VALUES ($1, $2, $3, NOW())",
                    [event_id, student.student_id, location || 'Kiosk']
                );
            } else {
                // Time Out
                if (check.rows.length === 0) return res.status(404).json({ error: 'No check-in record found for this event', student });
                if (check.rows[0].time_out) return res.status(409).json({ error: 'Already checked out from this event', student });

                await client.query("UPDATE event_attendance SET time_out = NOW() WHERE id = $1", [check.rows[0].id]);
            }
        } else {
            // Normal Mode (Daily Attendance)
            const check = await client.query("SELECT present_id, time_out FROM present WHERE student_id = $1 AND time_in::date = CURRENT_DATE ORDER BY time_in DESC LIMIT 1", [student.student_id]);

            if (scanType === 'in') {
                if (check.rows.length > 0) {
                    // For daily attendance, we typically enforce one record per day, or at least warn.
                    // If they are already checked in (time_out is null), error.
                    // If they checked out (time_out is set), we could allow re-entry, but for now let's say "Already present today".
                    return res.status(409).json({ error: 'Already checked in today', student });
                }
                await client.query(
                    "INSERT INTO present (student_id, time_in, staff_id, location) VALUES ($1, NOW(), $2, $3)",
                    [student.student_id, staff_id || null, location || 'Kiosk']
                );
            } else {
                if (check.rows.length === 0) return res.status(404).json({ error: 'No check-in record found for today', student });
                if (check.rows[0].time_out) return res.status(409).json({ error: 'Already checked out today', student });

                await client.query("UPDATE present SET time_out = NOW() WHERE present_id = $1", [check.rows[0].present_id]);
            }
        }

        res.json({ success: true, student });
    } catch (err) {
        debugLogWriteToFile(`[ATTENDANCE] SCAN ERROR: ${err.message}`);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});


// [NTPSYNC]
// NTP Timesync
app.post('/api/ntp/syncnow', async (req, res) => {
    await syncTimeWithNTP();
    res.json({
        success: true,
        message: 'Time sync triggered.'
    })
})

// [TIME]
// Get System Time (NTP Corrected)
app.get('/api/system/time', (req, res) => {
    const now = Date.now();
    const safeOffset = (typeof globalTimeOffset === 'number' && !isNaN(globalTimeOffset)) ? globalTimeOffset : 0;
    const ntpTime = now + safeOffset;

    let isoTime;
    try {
        isoTime = new Date(ntpTime).toISOString();
    } catch (e) {
        isoTime = new Date().toISOString();
    }

    const serverTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    res.json({
        time: isoTime,
        timestamp: ntpTime,
        offset: safeOffset,
        source: timeSource,
        timezone: serverTimezone
    });
});

// [AUTO-ABSENT TRIGGER]
// Manual Trigger for Auto-Absent Check
app.post('/api/attendance/trigger-auto-absent', async (req, res) => {
    try {
        const count = await checkAutoAbsent();
        res.json({ success: true, marked_count: count });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// [AUTO-ABSENT]
// Check for students who haven't logged in by time_out_target
// Helper: Check if today is a holiday
async function isTodayHoliday(client, dateObj) {
    try {
        const year = dateObj.getFullYear();
        const dateStr = dateObj.toISOString().split('T')[0]; // YYYY-MM-DD

        // 1. Get Config
        const configRes = await client.query('SELECT * FROM calendar_config LIMIT 1');
        const config = configRes.rows[0] || { country: 'PH' };

        // 2. Check Public Holidays
        const hd = new Holidays(config.country, config.state, config.region);
        const isPublic = hd.isHoliday(dateObj); // Returns array or false/undefined

        if (isPublic) return true;

        // 3. Check Custom Holidays
        const customRes = await client.query('SELECT 1 FROM calendar_custom_holidays WHERE date = $1', [dateStr]);
        return customRes.rows.length > 0;

    } catch (err) {
        debugLogWriteToFile(`[HOLIDAY CHECK] Error: ${err.message}`);
        return false; // Fail safe: assume school is open? Or closed? Open seems safer to avoid missing attendance.
    }
}

// [AUTO-ABSENT]
// Check for students who haven't logged in by time_out_target
async function checkAutoAbsent() {
    if (typeof pool === 'undefined') return 0;
    const client = await pool.connect();
    let count = 0;
    try {
        // 1. Get Config
        const configRes = await client.query("SELECT time_out_target, fixed_weekday_schedule FROM configurations LIMIT 1");
        if (configRes.rows.length === 0) return 0;

        const config = configRes.rows[0];
        const timeOutTargetStr = config.time_out_target || '16:00:00';
        const fixedSchedule = config.fixed_weekday_schedule !== false; // Default true

        // 2. Get Current Time (NTP Corrected)
        const nowMs = Date.now() + (globalTimeOffset || 0);
        const now = new Date(nowMs);

        // 3. Parse Target Time
        const [targetHour, targetMinute] = timeOutTargetStr.split(':').map(Number);
        const targetTime = new Date(now);
        targetTime.setHours(targetHour, targetMinute, 0, 0);

        // 4. Compare & Execute
        if (now >= targetTime) {

            // 4.1 Check Holiday (Global)
            const isHoliday = await isTodayHoliday(client, now);
            if (isHoliday) {
                debugLogWriteToFile(`[AUTO-ABSENT] Skipped. Today is a holiday.`);
                return 0;
            }

            // 4.2 Check Weekend (Global Fixed Schedule)
            // Day: 0 (Sun) - 6 (Sat)
            const day = now.getDay();
            const isWeekend = (day === 0 || day === 6);

            let sectionFilter = ``;
            // If fixed schedule is ON, and it is weekend -> Skip ALL
            if (fixedSchedule && isWeekend) {
                debugLogWriteToFile(`[AUTO-ABSENT] Skipped. Weekend (Fixed Schedule).`);
                return 0;
            }

            // If fixed schedule is OFF, we need to check section specific schedules
            // We can't easily filter in one query unless we join sections.
            // Strategy: Select students to mark, but filter by allowed_days

            const query = `
                 WITH target_students AS (
                     SELECT s.student_id, s.classroom_section
                     FROM students s
                     WHERE s.status = 'Active'
                     AND NOT EXISTS (
                        SELECT 1 FROM present p 
                        WHERE p.student_id = s.student_id 
                        AND p.time_in::date = CURRENT_DATE
                     )
                     AND NOT EXISTS (
                        SELECT 1 FROM absent a
                        WHERE a.student_id = s.student_id 
                        AND a.absent_datetime::date = CURRENT_DATE
                     )
                 )
                 SELECT ts.student_id, sec.allowed_days
                 FROM target_students ts
                 LEFT JOIN sections sec ON ts.classroom_section = sec.section_name
             `;

            const candidates = await client.query(query);
            const studentsToMark = [];

            // Day mapping for allowed_days string (e.g. "Mon,Tue" or "1,2")
            const daysMap = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            const currentDayName = daysMap[day];

            for (const row of candidates.rows) {
                let shouldMark = true;

                // If using Fixed Schedule = TRUE (and we are here, so it is NOT weekend), allow all (mark absent)
                // If using Fixed Schedule = FALSE, we MUST check allowed_days.
                // If allowed_days is empty/null, assuming Default (Mon-Fri) or All Days? 
                // Let's assume if Fixed=False and allowed_days is NULL, it follows the global rule (which we already passed if not fixed?? No wait).

                // If Fixed=True: We are Mon-Fri. Mark.
                // If Fixed=False: 
                //    If allowed_days is set: Check if today is in it.
                //    If allowed_days is NOT set: Default to Mon-Fri??? Or All days? 
                //       Let's assume default is Mon-Fri if not specified.

                if (!fixedSchedule) {
                    if (row.allowed_days) {
                        // Check match. Supports "Mon, Wed" or "1, 3"
                        const allowed = row.allowed_days.split(',').map(d => d.trim());
                        const inListName = allowed.includes(currentDayName);
                        const inListIndex = allowed.includes(String(day));

                        if (!inListName && !inListIndex) {
                            shouldMark = false; // Today is NOT allowed for this section
                        }
                    } else {
                        // No specific schedule. Fallback to Mon-Fri (Standard)
                        if (isWeekend) shouldMark = false;
                    }
                } else {
                    // Fixed Schedule = True.
                    // We already returned 0 if it was weekend globally.
                    // So here it is Mon-Fri. Mark.
                }

                if (shouldMark) {
                    studentsToMark.push(row.student_id);
                }
            }

            if (studentsToMark.length > 0) {
                // Bulk Insert
                // Postgres doesn't have a simple array insert without unnest, but we can iterate or build a query.
                // For safety/speed, let's use UNNEST
                const insertQuery = `
                    INSERT INTO absent (student_id, absent_datetime, reason)
                    SELECT unnest($1::text[]), NOW(), 'Auto-Absent (No Show)'
                 `;

                const res = await client.query(insertQuery, [studentsToMark]);
                count = res.rowCount;
                debugLogWriteToFile(`[AUTO-ABSENT] Marked ${count} students as absent.`);
            }
        }
    } catch (err) {
        debugLogWriteToFile(`[AUTO-ABSENT] Error: ${err.message}`);
    } finally {
        client.release();
    }
    return count;
}
// Run check every minute
setInterval(checkAutoAbsent, 60000);

// [EVENT STATUS WATCHDOG TRIGGER]
app.post('/api/events/trigger-status-update', async (req, res) => {
    try {
        const count = await checkEventStatus();
        res.json({ success: true, updated_count: count });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// [EVENT STATUS WATCHDOG]
// Automatically update event status based on time
async function checkEventStatus() {
    if (typeof pool === 'undefined') return 0;
    const client = await pool.connect();
    let updates = 0;
    try {
        // Get Current Time (NTP Corrected)
        const nowMs = Date.now() + (globalTimeOffset || 0);
        const now = new Date(nowMs);

        // 1. Set to Ongoing
        // Events that are 'planned', start time has passed, and end time hasn't passed
        const ongoingRes = await client.query(`
            UPDATE events 
            SET status = 'ongoing' 
            WHERE status = 'planned' 
            AND start_datetime <= $1 
            AND end_datetime > $1
        `, [now]);

        if (ongoingRes.rowCount > 0) {
            debugLogWriteToFile(`[EVENT WATCHDOG] Set ${ongoingRes.rowCount} events to 'ongoing'.`);
            updates += ongoingRes.rowCount;
        }

        // 2. Set to Completed
        // Events that are 'planned' or 'ongoing', and end time has passed
        const completedRes = await client.query(`
            UPDATE events 
            SET status = 'completed' 
            WHERE status IN ('planned', 'ongoing') 
            AND end_datetime <= $1
        `, [now]);

        if (completedRes.rowCount > 0) {
            debugLogWriteToFile(`[EVENT WATCHDOG] Set ${completedRes.rowCount} events to 'completed'.`);
            updates += completedRes.rowCount;
        }

    } catch (err) {
        debugLogWriteToFile(`[EVENT WATCHDOG] Error: ${err.message}`);
    } finally {
        client.release();
    }
    return updates;
}
setInterval(checkEventStatus, 60000);

// [SECURITY-SETUP]
// Update Security Questions
app.put('/api/staff/security-setup', async (req, res) => {
    const { staff_id, question, answer } = req.body;
    if (!staff_id || !question || !answer) return res.status(400).json({ error: 'Missing parameters' });

    const client = await pool.connect();
    try {
        const hashedAnswer = await bcrypt.hash(answer, 10);
        await client.query('UPDATE staff_login SET security_question = $1, security_answer = $2 WHERE staff_id = $3', [question, hashedAnswer, staff_id]);
        res.json({ success: true });
    } catch (err) {
        debugLogWriteToFile(`[SECURITY] SETUP ERROR: ${err.message}`);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// Generate Recovery Code
app.post('/api/staff/recovery-code', async (req, res) => {
    const { staff_id } = req.body;
    if (!staff_id) return res.status(400).json({ error: 'Staff ID required' });

    const client = await pool.connect();
    try {
        // Generate 12-char code (XXXX-XXXX-XXXX)
        const code = crypto.randomBytes(6).toString('hex').toUpperCase().match(/.{1,4}/g).join('-');
        const hashedCode = await bcrypt.hash(code, 10);

        await client.query('UPDATE staff_login SET recovery_code = $1 WHERE staff_id = $2', [hashedCode, staff_id]);
        res.json({ success: true, code });
    } catch (err) {
        debugLogWriteToFile(`[SECURITY] RECOVERY CODE ERROR: ${err.message}`);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// [RECOVERY]
// Lookup Account for Recovery
app.post('/api/auth/recovery/lookup', async (req, res) => {
    const { identifier } = req.body;
    if (!identifier) return res.status(400).json({ error: 'Identifier required' });

    const client = await pool.connect();
    try {
        let staffId = null;

        // 1. Check Username (staff_login)
        const resUser = await client.query('SELECT staff_id FROM staff_login WHERE username = $1', [identifier]);
        if (resUser.rows.length > 0) staffId = resUser.rows[0].staff_id;

        // 2. Check Staff ID (staff_accounts)
        if (!staffId) {
            const resId = await client.query('SELECT staff_id FROM staff_accounts WHERE staff_id = $1', [identifier]);
            if (resId.rows.length > 0) staffId = resId.rows[0].staff_id;
        }

        // 3. Check Email (staff_accounts)
        if (!staffId) {
            const resEmail = await client.query('SELECT staff_id FROM staff_accounts WHERE email_address = $1', [identifier]);
            if (resEmail.rows.length > 0) staffId = resEmail.rows[0].staff_id;
        }

        if (!staffId) return res.status(404).json({ error: 'Account not found' });

        // Get Recovery Info
        const loginRes = await client.query('SELECT security_question, recovery_code FROM staff_login WHERE staff_id = $1', [staffId]);

        if (loginRes.rows.length === 0) {
            return res.status(404).json({ error: 'Login account not configured.' });
        }

        const row = loginRes.rows[0];
        const methods = [];
        if (row.security_question) methods.push('question');
        if (row.recovery_code) methods.push('code');

        res.json({
            found: true,
            staff_id: staffId,
            methods,
            question: row.security_question
        });

    } catch (err) {
        debugLogWriteToFile(`[RECOVERY] LOOKUP ERROR: ${err.message}`);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// Verify Recovery Code
app.post('/api/auth/recovery/verify-code', async (req, res) => {
    const { staff_id, code } = req.body;
    const client = await pool.connect();
    try {
        const res1 = await client.query('SELECT recovery_code FROM staff_login WHERE staff_id = $1', [staff_id]);
        if (res1.rows.length === 0) return res.status(404).json({ error: 'Account not found' });

        const storedHash = res1.rows[0].recovery_code;
        if (!storedHash) return res.status(400).json({ error: 'No recovery code set.' });

        const match = await bcrypt.compare(code, storedHash);
        if (!match) return res.status(401).json({ error: 'Invalid recovery code.' });

        res.json({ success: true });
    } catch (err) {
        debugLogWriteToFile(`[RECOVERY] VERIFY CODE ERROR: ${err.message}`);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// Verify Security Question
app.post('/api/auth/recovery/verify-question', async (req, res) => {
    const { staff_id, answer } = req.body;
    const client = await pool.connect();
    try {
        const res1 = await client.query('SELECT security_answer FROM staff_login WHERE staff_id = $1', [staff_id]);
        if (res1.rows.length === 0) return res.status(404).json({ error: 'Account not found' });

        const storedHash = res1.rows[0].security_answer;
        if (!storedHash) return res.status(400).json({ error: 'No security question set.' });

        const match = await bcrypt.compare(answer, storedHash);
        if (!match) return res.status(401).json({ error: 'Incorrect answer.' });

        res.json({ success: true });
    } catch (err) {
        debugLogWriteToFile(`[RECOVERY] VERIFY QUESTION ERROR: ${err.message}`);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});


// Reset via Recovery Code
app.post('/api/auth/recovery/reset-via-code', async (req, res) => {
    const { staff_id, code, new_password } = req.body;
    const client = await pool.connect();
    try {
        const res1 = await client.query('SELECT recovery_code FROM staff_login WHERE staff_id = $1', [staff_id]);
        if (res1.rows.length === 0) return res.status(404).json({ error: 'Account not found' });

        const storedHash = res1.rows[0].recovery_code;
        if (!storedHash) return res.status(400).json({ error: 'No recovery code set.' });

        const match = await bcrypt.compare(code, storedHash);
        if (!match) return res.status(401).json({ error: 'Invalid recovery code.' });

        const hashedPassword = await bcrypt.hash(new_password, 10);
        // Invalidate code after use
        await client.query('UPDATE staff_login SET password = $1, recovery_code = NULL WHERE staff_id = $2', [hashedPassword, staff_id]);

        res.json({ success: true });
    } catch (err) {
        debugLogWriteToFile(`[RECOVERY] RESET CODE ERROR: ${err.message}`);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// Reset via Security Question
app.post('/api/auth/recovery/reset-via-question', async (req, res) => {
    const { staff_id, answer, new_password } = req.body;
    const client = await pool.connect();
    try {
        const res1 = await client.query('SELECT security_answer FROM staff_login WHERE staff_id = $1', [staff_id]);
        if (res1.rows.length === 0) return res.status(404).json({ error: 'Account not found' });

        const storedHash = res1.rows[0].security_answer;
        if (!storedHash) return res.status(400).json({ error: 'No security question set.' });

        const match = await bcrypt.compare(answer, storedHash);
        if (!match) return res.status(401).json({ error: 'Incorrect answer.' });

        const hashedPassword = await bcrypt.hash(new_password, 10);
        await client.query('UPDATE staff_login SET password = $1 WHERE staff_id = $2', [hashedPassword, staff_id]);

        res.json({ success: true });
    } catch (err) {
        debugLogWriteToFile(`[RECOVERY] RESET QUESTION ERROR: ${err.message}`);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// [CALENDAR]
// Get Holidays (Public + Custom)
app.get('/api/calendar/holidays', async (req, res) => {
    const { year } = req.query;
    const targetYear = parseInt(year) || new Date().getFullYear();
    const client = await pool.connect();

    try {
        // 1. Get Config
        await client.query(`
            CREATE TABLE IF NOT EXISTS calendar_config (
                id SERIAL PRIMARY KEY,
                country TEXT DEFAULT 'PH',
                state TEXT,
                region TEXT
            )
        `);
        // Ensure one row exists
        let configRes = await client.query('SELECT * FROM calendar_config LIMIT 1');
        if (configRes.rows.length === 0) {
            await client.query("INSERT INTO calendar_config (country) VALUES ('PH')");
            configRes = await client.query('SELECT * FROM calendar_config LIMIT 1');
        }
        const config = configRes.rows[0];

        // 2. Get Public Holidays via date-holidays
        const hd = new Holidays(config.country, config.state, config.region);
        const publicHolidays = hd.getHolidays(targetYear).map(h => ({
            id: `pub-${h.date}`, // simple unique id
            name: h.name,
            date: h.date.split(' ')[0], // YYYY-MM-DD
            type: h.type, // public, bank, school, optional, observance
            source: 'public'
        }));

        // 3. Get Custom Holidays from DB
        await client.query(`
            CREATE TABLE IF NOT EXISTS calendar_custom_holidays (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                date TEXT NOT NULL,
                type TEXT DEFAULT 'event'
            )
        `);

        // Filter custom holidays by year (assuming date is YYYY-MM-DD string)
        const customRes = await client.query('SELECT * FROM calendar_custom_holidays WHERE date LIKE $1', [`${targetYear}-%`]);
        const customHolidays = customRes.rows.map(h => ({
            id: h.id,
            name: h.name,
            date: h.date,
            type: h.type,
            source: 'custom'
        }));

        // 4. Merge
        res.json([...publicHolidays, ...customHolidays]);

    } catch (err) {
        debugLogWriteToFile(`[CALENDAR] GET ERROR: ${err.message}`);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// Add Custom Holiday
app.post('/api/calendar/holidays/custom', async (req, res) => {
    const { name, date, type } = req.body;
    const client = await pool.connect();
    try {
        await client.query('INSERT INTO calendar_custom_holidays (name, date, type) VALUES ($1, $2, $3)', [name, date, type]);
        res.json({ success: true });
    } catch (err) {
        debugLogWriteToFile(`[CALENDAR] ADD CUSTOM ERROR: ${err.message}`);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// Delete Custom Holiday
app.delete('/api/calendar/holidays/custom', async (req, res) => {
    const { id } = req.body;
    const client = await pool.connect();
    try {
        await client.query('DELETE FROM calendar_custom_holidays WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (err) {
        debugLogWriteToFile(`[CALENDAR] DELETE CUSTOM ERROR: ${err.message}`);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// Get/Update Calendar Config
app.get('/api/calendar/config', async (req, res) => {
    const client = await pool.connect();
    try {
        const resDb = await client.query('SELECT * FROM calendar_config LIMIT 1');
        res.json(resDb.rows[0] || { country: 'PH' });
    } catch (err) { res.status(500).json({ error: err.message }); } finally { client.release(); }
});

app.post('/api/calendar/config', async (req, res) => {
    const { country, state, region } = req.body;
    const client = await pool.connect();
    try {
        await client.query('UPDATE calendar_config SET country = $1, state = $2, region = $3', [country, state, region]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); } finally { client.release(); }
});
