import os
import subprocess
import sys
import time

def run_command(cmd, check=True):
    print(f"[*] Running: {cmd}")
    result = subprocess.run(cmd, shell=True, executable='/bin/bash')
    if check and result.returncode != 0:
        print(f"[!] Command failed with exit code {result.returncode}: {cmd}")
        sys.exit(result.returncode)

def main():
    print("=== PostgreSQL Initial Setup ===")
    
    # 1. Install prerequisites depending on OS
    if os.path.exists('/usr/bin/apt-get'):
        run_command("sudo apt-get update", check=False)
        run_command("sudo DEBIAN_FRONTEND=noninteractive apt-get install -y postgresql postgresql-contrib", check=False)
    elif os.path.exists('/usr/bin/yum'):
        run_command("sudo yum install -y postgresql-server postgresql-contrib", check=False)
        run_command("sudo postgresql-setup initdb", check=False)
    
    # Install psycopg2-binary
    run_command(f"{sys.executable} -m pip install psycopg2-binary", check=False)
    
    # 2. Configure PostgreSQL for wildcard IP access (0.0.0.0)
    pg_conf_dir = ""
    res = subprocess.run("ls -d /etc/postgresql/*/main 2>/dev/null | sort -V | tail -n 1", shell=True, capture_output=True, text=True, executable='/bin/bash')
    if res.stdout.strip() and os.path.exists(res.stdout.strip()):
        pg_conf_dir = res.stdout.strip()
    elif os.path.exists('/var/lib/pgsql/data'):
        pg_conf_dir = '/var/lib/pgsql/data'
    elif os.path.exists('/var/lib/postgres/data'):
        pg_conf_dir = '/var/lib/postgres/data'
        
    if not pg_conf_dir:
        print("[-] Could not automatically find PostgreSQL configuration directory.")
    else:
        pg_conf = os.path.join(pg_conf_dir, "postgresql.conf")
        pg_hba = os.path.join(pg_conf_dir, "pg_hba.conf")
        
        if os.path.exists(pg_conf):
            print(f"[*] Configuring {pg_conf} to listen on all addresses...")
            # Remove any existing listen_addresses lines
            run_command(f"sudo sed -i \"/^[ \\t]*#*[ \\t]*listen_addresses[ \\t]*=/d\" {pg_conf}", check=False)
            # Append listen_addresses = '*'
            run_command(f"echo \"listen_addresses = '*'\" | sudo tee -a {pg_conf}", check=False)

        if os.path.exists(pg_hba):
            print(f"[*] Configuring {pg_hba} to allow all connections...")
            run_command(f"grep -q '0.0.0.0/0' {pg_hba} || echo 'host all all 0.0.0.0/0 md5' | sudo tee -a {pg_hba}", check=False)
            run_command(f"grep -q '::/0' {pg_hba} || echo 'host all all ::/0 md5' | sudo tee -a {pg_hba}", check=False)

    # 3. Restart Service
    print("[*] Restarting PostgreSQL service...")
    run_command("sudo systemctl restart postgresql || sudo service postgresql restart", check=False)
    
    # Give it a couple of seconds to start
    time.sleep(3)

    # 4. Setup postgres DB and Roles
    print("[*] Provisioning roles and database...")
    run_command("sudo -u postgres psql -c \"CREATE USER admin WITH PASSWORD '12345678' SUPERUSER;\"", check=False)
    run_command("sudo -u postgres psql -c \"ALTER USER admin WITH PASSWORD '12345678';\"", check=False)
    run_command("sudo -u postgres createdb openattendance -O admin", check=False)
    
    # 5. Hotpatch DB
    hotpatch_script = os.path.join(os.path.dirname(os.path.abspath(__file__)), "hotpatch_db.py")
    if os.path.exists(hotpatch_script):
        print(f"[*] Running database hotpatch: {hotpatch_script}")
        run_command(f"{sys.executable} '{hotpatch_script}'", check=True)
    else:
        print(f"[!] Warning: {hotpatch_script} not found. Could not apply hotpatch.")
    
    print("=== Setup Completed Successfully! ===")

if __name__ == '__main__':
    main()
