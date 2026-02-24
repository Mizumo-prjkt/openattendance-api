import json
import os

class StudentLimitExceeded(Exception):
    """Exception raised when student count exceeds template limits."""
    pass

def validate_student_count(file_path, force_split=False):
    """
    Validates that the provided JSON file does not contain more than 
    30 male or 30 female students. Raises StudentLimitExceeded if it exceeds 
    limits AND force_split=False. If force_split is True, just prints a warning.
    """
    if not os.path.exists(file_path):
        return  # Let the processor handle missing file scenarios
        
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except Exception:
        return  # Let the processor handle JSON decode errors

    students = data.get("students", [])
    if not isinstance(students, list):
        return
        
    male_count = 0
    female_count = 0

    for s in students:
        if not isinstance(s, dict):
            continue
        gender = s.get("gender", "M").upper()
        if gender in ("M", "MALE"):
            male_count += 1
        elif gender in ("F", "FEMALE"):
            female_count += 1

    if male_count > 30 or female_count > 30:
        if force_split:
            print(f"[WARNING] Student limits exceeded ({male_count} M / {female_count} F). Auto-splitting enabled via --force-yes.")
            return

        msg = f"""
========================================================================
[GUARDRAIL ALERT] STUDENT LIMIT EXCEEDED
========================================================================

The provided JSON file contains {male_count} male(s) and {female_count} female(s).

The standard DepEd SF2 Excel template ONLY accommodates:
- Max 30 Male students
- Max 30 Female students

ACTION REQUIRED:
1. Double check: Ensure you haven't accidentally mislabeled or misplaced a student's gender.
2. If your class genuinely exceeds 30 males or 30 females, you can automatically
   split the students into multiple Excel spreadsheets by passing the 
   --force-yes flag. 
   
   Run: python3 main.py --json <your_file.json> --force-yes

ABORTING processing to prevent template corruption and data loss.
========================================================================"""
        raise StudentLimitExceeded(msg)
