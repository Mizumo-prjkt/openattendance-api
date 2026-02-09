-- OpenAttendance PostgreSQL Schema

-- 1. Benchmark Test
CREATE TABLE IF NOT EXISTS benchmark_test (
    id SERIAL PRIMARY KEY,
    col_text1 TEXT,
    col_text2 TEXT,
    col_int1 INTEGER,
    col_int2 INTEGER,
    col_real1 REAL,
    col_real2 REAL,
    col_blob1 BYTEA,
    col_date1 DATE,
    col_bool1 BOOLEAN
);

-- 2. Students
CREATE TABLE IF NOT EXISTS students (
    id SERIAL PRIMARY KEY,
    last_name TEXT,
    first_name TEXT NOT NULL,
    middle_name TEXT,
    phone_number TEXT,
    address TEXT,
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    emergency_contact_relationship TEXT CHECK (emergency_contact_relationship IN ('parent', 'guardian')),
    student_id TEXT NOT NULL UNIQUE,
    qr_code_token TEXT UNIQUE,
    profile_image_path TEXT,
    classroom_section TEXT,
    status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
    gender TEXT CHECK (gender IN('Male', 'Female', 'Other'))
);

-- 3. Configurations
CREATE TABLE IF NOT EXISTS configurations (
    config_id SERIAL PRIMARY KEY,
    school_name TEXT NOT NULL,
    school_type TEXT CHECK (school_type IN ('public', 'private', 'charter', 'international')),
    school_id TEXT,
    address TEXT,
    logo_directory TEXT,
    organization_hotline TEXT,
    country_code TEXT NOT NULL,
    created_config_date TEXT -- Consider changing to TIMESTAMP or DATE if this is not just a label
);

-- 4. Staff Accounts (Created before others to satisfy FK constraints)
CREATE TABLE IF NOT EXISTS staff_accounts (
    id SERIAL PRIMARY KEY,
    staff_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    phone_number TEXT,
    email_address TEXT UNIQUE,
    staff_type TEXT NOT NULL CHECK (staff_type IN ('student_council', 'teacher', 'security')),
    teacher_type TEXT,
    adviser_unit TEXT,
    profile_image_path TEXT,
    active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1))
);

-- 5. Excused
CREATE TABLE IF NOT EXISTS excused (
    excused_id SERIAL PRIMARY KEY,
    student_id TEXT NOT NULL,
    requester_staff_id TEXT NOT NULL,
    processor_id TEXT,
    processor_type TEXT CHECK (processor_type IN ('staff', 'admin')),
    reason TEXT NOT NULL,
    request_datetime TIMESTAMP NOT NULL,
    verdict_datetime TIMESTAMP,
    result TEXT NOT NULL CHECK (result IN ('pending', 'excused', 'rejected')) DEFAULT 'pending',
    FOREIGN KEY (student_id) REFERENCES students(student_id),
    FOREIGN KEY (requester_staff_id) REFERENCES staff_accounts(staff_id)
);

-- 6. Present
CREATE TABLE IF NOT EXISTS present (
    present_id SERIAL PRIMARY KEY,
    student_id TEXT NOT NULL,
    staff_id TEXT NOT NULL,
    time_in TIMESTAMP NOT NULL,
    time_out TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(student_id),
    FOREIGN KEY (staff_id) REFERENCES staff_accounts(staff_id)
);

-- 7. Absent
CREATE TABLE IF NOT EXISTS absent (
    absent_id SERIAL PRIMARY KEY,
    student_id TEXT NOT NULL,
    staff_id TEXT NOT NULL,
    reason TEXT,
    absent_datetime TIMESTAMP NOT NULL,
    FOREIGN KEY (student_id) REFERENCES students(student_id),
    FOREIGN KEY (staff_id) REFERENCES staff_accounts(staff_id)
);

-- 8. Staff Login Credentials
CREATE TABLE IF NOT EXISTS staff_login (
    login_id SERIAL PRIMARY KEY,
    staff_id TEXT NOT NULL UNIQUE,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    FOREIGN KEY (staff_id) REFERENCES staff_accounts(staff_id) ON DELETE CASCADE
);

-- 9. Events
CREATE TABLE IF NOT EXISTS events (
    event_id SERIAL PRIMARY KEY,
    event_name TEXT NOT NULL,
    event_description TEXT,
    location TEXT,
    start_datetime TIMESTAMP NOT NULL,
    end_datetime TIMESTAMP NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('planned', 'ongoing', 'completed', 'cancelled')) DEFAULT 'planned',
    created_by_staff_id TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by_staff_id) REFERENCES staff_accounts(staff_id)
);

-- 10. Event Attendees
CREATE TABLE IF NOT EXISTS event_attendees (
    event_attendee_id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL,
    student_id TEXT NOT NULL,
    check_in_time TIMESTAMP NOT NULL,
    check_out_time TIMESTAMP,
    checked_in_by_staff_id TEXT NOT NULL,
    FOREIGN KEY (event_id) REFERENCES events(event_id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students(student_id),
    FOREIGN KEY (checked_in_by_staff_id) REFERENCES staff_accounts(staff_id),
    UNIQUE (event_id, student_id)
);

-- 11. Granular Daily Attendance Logs
CREATE TABLE IF NOT EXISTS daily_attendance_logs (
    log_id SERIAL PRIMARY KEY,
    student_id TEXT NOT NULL,
    staff_id TEXT NOT NULL,
    log_date DATE NOT NULL,
    log_slot TEXT NOT NULL CHECK (log_slot IN ('morning_in', 'morning_out', 'afternoon_in', 'afternoon_out', 'evening_in', 'evening_out')),
    log_time TIME NOT NULL,
    log_datetime TIMESTAMP NOT NULL,
    UNIQUE(student_id, log_date, log_slot),
    FOREIGN KEY (student_id) REFERENCES students(student_id),
    FOREIGN KEY (staff_id) REFERENCES staff_accounts(staff_id)
);

-- 12. System Logs
CREATE TABLE IF NOT EXISTS system_logs (
    log_id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    level TEXT NOT NULL CHECK (level IN ('INFO', 'DEBUG', 'WARN', 'ERROR', 'FATAL')),
    message TEXT NOT NULL,
    source TEXT,
    details TEXT
);

-- 13. SMS Provider Settings
CREATE TABLE IF NOT EXISTS sms_provider_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    provider_type TEXT CHECK (provider_type IN ('api', 'usb')),
    provider_name TEXT NOT NULL,
    api_url TEXT,
    api_key TEXT,
    sender_name TEXT,
    tty_path TEXT,
    baud_rate INTEGER,
    message_template TEXT,
    curl_config_json JSONB,
    sms_enabled BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 14. Sections (Classes)
CREATE TABLE IF NOT EXISTS sections (
    section_id SERIAL PRIMARY KEY,
    section_name TEXT NOT NULL UNIQUE,
    adviser_staff_id TEXT,
    room_number TEXT,
    schedule_data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (adviser_staff_id) REFERENCES staff_accounts(staff_id)
);

-- 15. SMS Logs
CREATE TABLE IF NOT EXISTS sms_logs (
    sms_id SERIAL PRIMARY KEY,
    recipient_number TEXT NOT NULL,
    recipient_name TEXT,
    related_student_id TEXT,
    message_body TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'pending')),
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    error_message TEXT,
    FOREIGN KEY (related_student_id) REFERENCES students(student_id)
);