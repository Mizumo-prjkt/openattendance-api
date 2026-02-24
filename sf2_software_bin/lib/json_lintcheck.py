import json
import os

def check_json(file_path):
    """
    Lints a JSON file for the SF2 Attendance App.
    Checks syntax, missing keys, and student limits.
    """
    print(f"Linting JSON file: {file_path}")
    
    if not os.path.exists(file_path):
        print(f"[-] ERROR: File not found: {file_path}")
        return False

    # 1. Syntax Check
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        print("[+] SUCCESS: JSON syntax is valid.")
    except json.JSONDecodeError as e:
        print(f"[-] ERROR: Invalid JSON syntax: {e}")
        return False
    except Exception as e:
        print(f"[-] ERROR: Failed to read file: {e}")
        return False

    # 2. Schema Check
    required_keys = ["school_info", "students"]
    is_valid = True
    for key in required_keys:
        if key not in data:
            print(f"[-] ERROR: Missing required root key: '{key}'")
            is_valid = False
            
    if not is_valid:
        return False
        
    print("[+] SUCCESS: Root schema required keys are present.")

    # 3. Student Count Check
    students = data.get("students", [])
    if not isinstance(students, list):
        print("[-] ERROR: 'students' must be an array (list).")
        return False
        
    male_count = 0
    female_count = 0

    for idx, s in enumerate(students):
        if not isinstance(s, dict):
            print(f"[-] ERROR: Student at index {idx} is not an object.")
            is_valid = False
            continue
            
        if "name" not in s:
            print(f"[-] ERROR: Student at index {idx} is missing a 'name'.")
            is_valid = False
            
        gender = s.get("gender", "M").upper()
        if gender in ("M", "MALE"):
            male_count += 1
        elif gender in ("F", "FEMALE"):
            female_count += 1
        else:
            print(f"[-] WARNING: Unrecognized gender '{gender}' for student '{s.get('name', 'Unknown')}'")

    if not is_valid:
        return False

    # Check Limits and emit Warning instead of Error
    if male_count > 30 or female_count > 30:
        print(f"[!] WARNING: Student limit exceeded ({male_count} M / {female_count} F).")
        print("    Max limit is 30 per gender. The application will auto-split data into multiple files if --force-yes is used.")
    else:
        print(f"[+] SUCCESS: Student counts are within limits ({male_count} M / {female_count} F).")
        
    print("\nLinting Complete: No blocking errors found (Warnings may be present).")
    return True
