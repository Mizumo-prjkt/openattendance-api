import os
import sys
import subprocess
import shutil
import time

def run_command(command, ignore_errors=False):
    print(f"Running: {command}")
    try:
        subprocess.run(command, shell=True, check=True)
    except subprocess.CalledProcessError as e:
        print(f"Error executing command: {command}")
        if not ignore_errors:
            sys.exit(1)

def setup_postgres():
    print("--- Installing PostgreSQL ---")
    
    if shutil.which("apt-get"):
        print("Detected Debian/Ubuntu-based system.")
        run_command("sudo apt-get update")
        run_command("sudo apt-get install -y postgresql postgresql-contrib")
        
        print("--- Starting and enabling PostgreSQL service ---")
        run_command("sudo systemctl enable --now postgresql")
        
        pg_conf_hint_1 = "/etc/postgresql/<version>/main/postgresql.conf"
        pg_conf_hint_2 = "/etc/postgresql/<version>/main/pg_hba.conf"
    elif shutil.which("pacman"):
        print("Detected Arch-based system.")
        run_command("sudo pacman -S --noconfirm postgresql")
        
        print("--- Initializing PostgreSQL database cluster ---")
        if not os.path.exists("/var/lib/postgres/data/PG_VERSION"):
            run_command("sudo -u postgres initdb -D /var/lib/postgres/data")
        else:
            print("PostgreSQL data directory already initialized.")

        print("--- Starting and enabling PostgreSQL service ---")
        run_command("sudo systemctl enable --now postgresql")
        
        pg_conf_hint_1 = "/var/lib/postgres/data/postgresql.conf"
        pg_conf_hint_2 = "/var/lib/postgres/data/pg_hba.conf"
    else:
        print("Unsupported package manager. Please install PostgreSQL manually.")
        sys.exit(1)

    print("--- Configuring PostgreSQL Database & User ---")
    # Giving it a few seconds to start up before connecting
    time.sleep(3)

    # ignore_errors=True is passed because the user or database might already exist
    run_command("sudo -u postgres psql -c \"CREATE USER admin WITH PASSWORD '12345678';\"", ignore_errors=True)
    run_command("sudo -u postgres psql -c \"CREATE DATABASE openattendance OWNER admin;\"", ignore_errors=True)

    print("Note: since your DB_HOST is set to 192.168.3.44 you might need to:")
    print(f"1. Set listen_addresses = '*' in {pg_conf_hint_1}")
    print(f"2. Add 'host all all 192.168.3.0/24 md5' (or similar) to {pg_conf_hint_2}")
    print("3. Restart postgresql (`sudo systemctl restart postgresql`)")

def generate_env_file():
    print("--- Generating .env file ---")
    env_content = """# PostgreSQL
# DATABASE_URL=postgres://admin:12345678@192.168.3.44:5432/openattendance
DB_USER="admin"
DB_PASSWORD="12345678"
DB_HOST="192.168.3.44"
DB_PORT="5432"
DB_NAME="openattendance"
PORT="10002"
# MAKE SURE THAT TIME OFFSET IS MS
NTP_OFFSET="0" 
SF2_SERVICE_URL="http://192.168.3.44:5001/gen-sf2"
"""
    env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
    with open(env_path, "w") as f:
        f.write(env_content)
    print(f".env file generated successfully at {env_path}")

def test_database_connection():
    print("\n--- Testing Database Connection and Write Capabilities ---")
    print("Attempting to connect with user 'admin' to database 'openattendance' via local loopback...")
    
    # We use PGPASSWORD to provide the password to psql non-interactively
    os.environ["PGPASSWORD"] = "12345678"
    
    test_query = "CREATE TABLE IF NOT EXISTS connection_test (id serial PRIMARY KEY, message VARCHAR(255)); " \
                 "INSERT INTO connection_test (message) VALUES ('Write test successful!'); " \
                 "SELECT * FROM connection_test; " \
                 "DROP TABLE connection_test;"
    
    command = f"psql -U admin -h 127.0.0.1 -d openattendance -c \"{test_query}\""
    
    try:
        # Standard output and error are captured so we can display them gracefully
        result = subprocess.run(command, shell=True, check=True, capture_output=True, text=True)
        print("SUCCESS! Database is fully reachable and writable with the 'admin' credentials:")
        print(result.stdout.strip())
    except subprocess.CalledProcessError as e:
        print("\nDatabase Test Failed. This is normal immediately after installation, because default PostgreSQL configurations (pg_hba.conf) tend to block local password connections.")
        print("Once you apply the `pg_hba.conf` and `postgresql.conf` changes printed above and restart the service, this credentials test will work!")
        print(f"Error Details:\n{e.stderr.strip()}")
        
    # Clean up environment variable
    if "PGPASSWORD" in os.environ:
        del os.environ["PGPASSWORD"]

if __name__ == "__main__":
    setup_postgres()
    generate_env_file()
    test_database_connection()
    print("--- Setup Complete ---")
