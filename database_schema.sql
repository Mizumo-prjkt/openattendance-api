-- 1. ENUM Types for Status and Roles
-- Derived from staff.jsx, students.jsx, and events.jsx
CREATE TYPE user_status AS ENUM ('Active', 'Inactive');
CREATE TYPE staff_role AS ENUM ('teacher', 'security', 'student_council', 'admin');
CREATE TYPE student_status AS ENUM ('Active', 'Inactive', 'Dropped', 'Transferred');
CREATE TYPE event_status AS ENUM ('planned', 'ongoing', 'completed', 'cancelled');
CREATE TYPE attendance_type AS ENUM ('in', 'out');
CREATE TYPE attendance_status AS ENUM ('on_time', 'late', 'absent', 'excused');
CREATE TYPE sms_provider_type AS ENUM ('api', 'usb');

-- 2. System Settings & Configuration
-- Derived from settings.jsx (General, SMS, Security)
CREATE TABLE system_settings (
    id SERIAL PRIMARY KEY,
    school_name TEXT NOT NULL DEFAULT 'My School',
    school_id TEXT,
    country_code VARCHAR(5) DEFAULT 'PH',
    address TEXT,
    logo_path TEXT, -- Stores path to uploaded logo
    maintenance_mode BOOLEAN DEFAULT FALSE,
    debug_logging BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sms_configurations (
    id SERIAL PRIMARY KEY,
    is_enabled BOOLEAN DEFAULT FALSE,
    provider_type sms_provider_type DEFAULT 'api',
    
    -- API Provider Fields
    api_url TEXT,
    api_key TEXT,
    sender_name TEXT,
    
    -- USB Modem Fields
    tty_port TEXT, -- e.g., /dev/ttyUSB2
    baud_rate INTEGER DEFAULT 115200,
    
    -- Templates & Advanced
    message_template TEXT,
    curl_config JSONB, -- Stores the raw JSON for advanced CURL configurations
    
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Staff & Authentication
-- Derived from staff.jsx and login.jsx
CREATE TABLE staff (
    id SERIAL PRIMARY KEY,
    staff_id VARCHAR(50) UNIQUE NOT NULL, -- displayed as STAFF001
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email VARCHAR(255) UNIQUE,
    role staff_role NOT NULL DEFAULT 'teacher',
    status user_status DEFAULT 'Active',
    profile_image_path TEXT, -- Base64 or file path
    
    -- Authentication
    password_hash VARCHAR(255), -- For login.jsx
    last_login TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Classes / Sections
-- Derived from classes.jsx
CREATE TABLE classes (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL, -- e.g., "Grade 10 - A"
    room VARCHAR(50),
    adviser_id INTEGER REFERENCES staff(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Class Schedules
-- Derived from classes.jsx (Weekly Class Schedule table)
CREATE TABLE class_schedules (
    id SERIAL PRIMARY KEY,
    class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE,
    day_of_week VARCHAR(3) NOT NULL, -- Mon, Tue, Wed, etc.
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    subject TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Students
-- Derived from students.jsx
CREATE TABLE students (
    id SERIAL PRIMARY KEY,
    student_id VARCHAR(50) UNIQUE NOT NULL, -- e.g., STU-2024-001
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    class_id INTEGER REFERENCES classes(id) ON DELETE SET NULL, -- Links to 'section'
    status student_status DEFAULT 'Active',
    profile_image_path TEXT,
    
    -- Guardian Contact for SMS
    guardian_name TEXT,
    guardian_phone VARCHAR(20),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. Events
-- Derived from events.jsx
CREATE TABLE events (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    location TEXT,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP,
    status event_status DEFAULT 'planned',
    description TEXT,
    created_by INTEGER REFERENCES staff(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 8. Attendance Logs (Normal Daily)
-- Derived from attendance.jsx (Normal Mode)
CREATE TABLE attendance_logs (
    id SERIAL PRIMARY KEY,
    student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    type attendance_type NOT NULL, -- 'in' or 'out'
    status attendance_status DEFAULT 'on_time',
    scan_method VARCHAR(20) DEFAULT 'scanner', -- 'sensor' or 'camera'
    
    -- Partitioning key (optional but good for large data)
    log_date DATE DEFAULT CURRENT_DATE
);

-- 9. Event Attendance
-- Derived from attendance.jsx (Event Mode) & events.jsx (Manage Students tab)
CREATE TABLE event_attendance (
    id SERIAL PRIMARY KEY,
    event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
    student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
    check_in_time TIMESTAMP,
    check_out_time TIMESTAMP,
    status attendance_status DEFAULT 'present',
    
    UNIQUE(event_id, student_id)
);

-- 10. Event Staffing
-- Derived from events.jsx (Manage Staff tab)
CREATE TABLE event_staff (
    id SERIAL PRIMARY KEY,
    event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
    staff_id INTEGER REFERENCES staff(id) ON DELETE CASCADE,
    role TEXT, -- Specific role for the event (e.g., Supervisor)
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for Performance
CREATE INDEX idx_students_student_id ON students(student_id);
CREATE INDEX idx_staff_staff_id ON staff(staff_id);
CREATE INDEX idx_attendance_student_date ON attendance_logs(student_id, log_date);
CREATE INDEX idx_events_start_time ON events(start_time);