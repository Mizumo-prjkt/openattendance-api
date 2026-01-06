--  This is a mapping of the database schema for the application.

CREATE TABLE IF NOT EXISTS benchmark_test (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    col_text1 TEXT,
    col_text2 TEXT,
    col_int1 INTEGER,
    col_int2 INTEGER,
    col_real1 REAL,
    col_real2 REAL,
    col_blob1 BLOB,
    col_date1 DATE,
    col_bool1 BOOLEAN
);

CREATE TABLE IF NOT EXISTS students (
   id INTEGER PRIMARY KEY AUTOINCREMENT, -- database index
   last_name TEXT,                       -- optional
   first_name TEXT NOT NULL,             -- required
   middle_name TEXT,                     -- optional
   phone_number TEXT,                    -- optional
   address TEXT,                         -- optional
   emergency_contact_name TEXT,          -- optional
   emergency_contact_phone TEXT,         -- optional
   emergency_contact_relationship TEXT CHECK (
       emergency_contact_relationship IN ('parent', 'guardian')
   ),                                    -- optional, locked to parent/guardian
   student_id TEXT NOT NULL UNIQUE,      -- required, must be unique
   profile_image_path TEXT,              -- optional, path to student's profile image
   classroom_section TEXT                -- optional, e.g., "Grade 10 - Section B"
);


CREATE TABLE IF NOT EXISTS configurations (
   config_id INTEGER PRIMARY KEY AUTOINCREMENT, -- internal index
   school_name TEXT NOT NULL,                   -- required
   school_type TEXT CHECK (
       school_type IN ('public', 'private', 'charter', 'international')
   ),                                           -- optional but constrained
   address TEXT,                                -- optional
   logo_directory TEXT,                         -- optional, path to logo file
   organization_hotline TEXT,                   -- optional
   country_code TEXT NOT NULL,                   -- required, e.g. 'PH', 'US'
   created_config_date TEXT
);

-- Excused table
CREATE TABLE IF NOT EXISTS excused (
    excused_id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id TEXT NOT NULL,
    requester_staff_id TEXT NOT NULL,      -- Who initiated the request (staff_id)
    processor_id TEXT,                     -- Who approved/rejected it (staff_id or admin_id)
    processor_type TEXT CHECK (processor_type IN ('staff', 'admin')), -- Type of processor
    reason TEXT NOT NULL,
    request_datetime DATETIME NOT NULL,
    verdict_datetime DATETIME,
    result TEXT NOT NULL CHECK (result IN ('pending', 'excused', 'rejected')) DEFAULT 'pending',
    FOREIGN KEY (student_id) REFERENCES students(student_id),
    FOREIGN KEY (requester_staff_id) REFERENCES staff_accounts(staff_id)
    -- Note: We can't use a direct FOREIGN KEY for processor_id due to its dual nature.
);

-- Present table
CREATE TABLE IF NOT EXISTS present (
    present_id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id TEXT NOT NULL,
    staff_id TEXT NOT NULL, -- who logged the attendance
    time_in DATETIME NOT NULL,
    time_out DATETIME,
    FOREIGN KEY (student_id) REFERENCES students(student_id),
    FOREIGN KEY (staff_id) REFERENCES staff_accounts(staff_id)
);

-- Absent table
CREATE TABLE IF NOT EXISTS absent (
    absent_id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id TEXT NOT NULL,
    staff_id TEXT NOT NULL, -- who recorded the absence
    reason TEXT,
    absent_datetime DATETIME NOT NULL,
    FOREIGN KEY (student_id) REFERENCES students(student_id),
    FOREIGN KEY (staff_id) REFERENCES staff_accounts(staff_id)
);


CREATE TABLE IF NOT EXISTS staff_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    staff_id TEXT NOT NULL UNIQUE, -- unique identifier for staff
    name TEXT NOT NULL,
    phone_number TEXT,
    email_address TEXT UNIQUE,
    staff_type TEXT NOT NULL CHECK (
        staff_type IN ('student_council', 'teacher', 'security')
    ),
    teacher_type TEXT, -- only relevant if staff_type = 'teacher'
    adviser_unit TEXT, -- can be NULL
    profile_image_path TEXT, -- path to the staff's profile image
    active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1))
);

-- Staff Login Credentials Table
CREATE TABLE IF NOT EXISTS staff_login (
    login_id INTEGER PRIMARY KEY AUTOINCREMENT,
    staff_id TEXT NOT NULL UNIQUE,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    FOREIGN KEY (staff_id) REFERENCES staff_accounts(staff_id) ON DELETE CASCADE
);

-- Events related

CREATE TABLE IF NOT EXISTS events (
    event_id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_name TEXT NOT NULL,
    event_description TEXT,
    location TEXT,
    start_datetime DATETIME NOT NULL,
    end_datetime DATETIME NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('planned', 'ongoing', 'completed', 'cancelled')) DEFAULT 'planned',
    created_by_staff_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by_staff_id) REFERENCES staff_accounts(staff_id)
);

-- Events attendee
CREATE TABLE IF NOT EXISTS event_attendees (
    event_attendee_id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    student_id TEXT NOT NULL,
    check_in_time DATETIME NOT NULL,
    check_out_time DATETIME,
    checked_in_by_staff_id TEXT NOT NULL,
    FOREIGN KEY (event_id) REFERENCES events(event_id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students(student_id),
    FOREIGN KEY (checked_in_by_staff_id) REFERENCES staff_accounts(staff_id),
    UNIQUE (event_id, student_id)
);

-- Granular Daily Attendance Logs
-- This table is designed to replace the simple 'present' and 'absent' tables over time.
CREATE TABLE IF NOT EXISTS daily_attendance_logs (
    log_id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id TEXT NOT NULL,
    staff_id TEXT NOT NULL,
    log_date DATE NOT NULL,
    log_slot TEXT NOT NULL CHECK (log_slot IN ('morning_in', 'morning_out', 'afternoon_in', 'afternoon_out', 'evening_in', 'evening_out')),
    log_time TIME NOT NULL,
    log_datetime DATETIME NOT NULL,
    UNIQUE(student_id, log_date, log_slot),
    FOREIGN KEY (student_id) REFERENCES students(student_id),
    FOREIGN KEY (staff_id) REFERENCES staff_accounts(staff_id)
);

-- System Logs table
CREATE TABLE IF NOT EXISTS system_logs (
    log_id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    level TEXT NOT NULL CHECK (level IN ('INFO', 'DEBUG', 'WARN', 'ERROR', 'FATAL')),
    message TEXT NOT NULL,
    source TEXT, -- e.g., 'setup', 'runtime', 'api-login'
    details TEXT -- For stack traces or JSON context
);

-- SMS Provider Settings
CREATE TABLE IF NOT EXISTS sms_provider_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1), -- Ensures only one row can exist
    provider_name TEXT NOT NULL,           -- e.g., 'semaphore'
    sender_name TEXT,                      -- The name that appears as the sender
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);