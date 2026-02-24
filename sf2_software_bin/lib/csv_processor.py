import csv
import os
import datetime
from . import processor

def process_csv_to_excel(csv_path, output_path=None):
    """
    Parses the specific CSV format for Attendance and generates an Excel report.
    """
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"CSV file not found: {csv_path}")

    with open(csv_path, 'r', encoding='utf-8-sig') as f:
        lines = [line.strip() for line in f.readlines()]

    # 1. Parse Metadata (Lines 1-3)
    # Expected: 
    # Line 1: School Name:,"Name",School ID:,"ID"
    # Line 2: School Year:,"Year",Month:,"Month"
    # Line 3: Grade & Section:,"Grade - Section"
    
    school_info = {}
    
    # Helper to clean quotes and whitespace
    def clean(val):
        return val.replace('"', '').strip()

    # Simple CSV reader for metadata lines to handle quoted strings easily
    reader = csv.reader(lines)
    all_rows = list(reader)
    
    # Line 1
    if len(all_rows) > 0:
        row1 = all_rows[0]
        # Assuming layout: [Label, Value, Label, Value]
        # Find "School Name:" index
        try:
            idx_name = row1.index("School Name:")
            school_info["school_name"] = row1[idx_name + 1]
        except ValueError:
            school_info["school_name"] = "Unknown"
            
        try:
            idx_id = row1.index("School ID:")
            school_info["school_id"] = row1[idx_id + 1]
        except ValueError:
            school_info["school_id"] = ""

    # Line 2
    if len(all_rows) > 1:
        row2 = all_rows[1]
        try:
            idx_sy = row2.index("School Year:")
            school_info["school_year"] = row2[idx_sy + 1]
        except ValueError:
            school_info["school_year"] = ""
            
        try:
            idx_mo = row2.index("Month:")
            school_info["month"] = row2[idx_mo + 1]
            # If Month is "2026-02", convert to "February"
            try:
                dt_mo = datetime.datetime.strptime(school_info["month"], "%Y-%m")
                school_info["month"] = dt_mo.strftime("%B")
            except:
                pass # Keep as is if not YYYY-MM
        except ValueError:
            school_info["month"] = ""

    # Line 3
    if len(all_rows) > 2:
        row3 = all_rows[2]
        try:
            idx_gs = row3.index("Grade & Section:")
            gs_val = row3[idx_gs + 1]
            # Parse "Grade 10 - Agimat"
            if "-" in gs_val:
                parts = gs_val.split("-", 1)
                school_info["grade"] = parts[0].replace("Grade", "").strip()
                school_info["section"] = parts[1].strip()
            else:
                school_info["grade"] = gs_val
                school_info["section"] = ""
        except ValueError:
            school_info["grade"] = ""
            school_info["section"] = ""

    # 2. Find Header Row (Line 5 usually, starts with "Student ID")
    header_row_idx = -1
    for i, row in enumerate(all_rows):
        if row and row[0] == "Student ID":
            header_row_idx = i
            break
            
    if header_row_idx == -1:
        raise ValueError("Could not find header row starting with 'Student ID'")

    header = all_rows[header_row_idx]
    
    # Identify Date Columns (YYYY-MM-DD)
    date_cols = []
    for i, col in enumerate(header):
        try:
            # Check format YYYY-MM-DD
            datetime.datetime.strptime(col, "%Y-%m-%d")
            date_cols.append(i)
        except ValueError:
            continue
            
    if not date_cols:
        raise ValueError("No date columns (YYYY-MM-DD) found in header.")

    # 3. Process Students
    students_male = []
    students_female = []
    
    start_date_idx = date_cols[0]
    end_date_idx = date_cols[-1]
    
    # Store dates for the processor
    dates_list = [header[i] for i in date_cols]
    
    for row in all_rows[header_row_idx + 1:]:
        if not row or len(row) < 2:
            continue
            
        # Structure: ID, Last, First, Gender, Dates...
        # Indices might vary if CSV matches header exactly
        try:
            idx_last = header.index("Last Name")
            idx_first = header.index("First Name")
            idx_gender = header.index("Gender")
        except ValueError:
             # Fallback indices if headers missing?
             # Assuming standard: 0=ID, 1=Last, 2=First, 3=Gender
             idx_last = 1
             idx_first = 2
             idx_gender = 3
             
        name = f"{row[idx_last]}, {row[idx_first]}"
        gender = row[idx_gender].strip().upper()
        
        attendance = {}
        for col_idx in date_cols:
            if col_idx < len(row):
                val = row[col_idx].strip().upper()
                date_str = header[col_idx]
                
                if val == "P":
                    attendance[date_str] = "PRESENT"
                elif val == "A":
                    attendance[date_str] = "ABSENT"
                # Ignore others
        
        student_obj = {
            "name": name,
            "attendance": attendance
        }
        
        if gender == "MALE" or gender == "M":
            students_male.append(student_obj)
        elif gender == "FEMALE" or gender == "F":
            students_female.append(student_obj)
            
    # Sort
    students_male.sort(key=lambda x: x["name"])
    students_female.sort(key=lambda x: x["name"])

    # Prepare Data
    composer_data = {
        "school_name": school_info.get("school_name", ""),
        "school_id": school_info.get("school_id", ""),
        "school_year": school_info.get("school_year", ""),
        "month": school_info.get("month", ""),
        "grade": school_info.get("grade", ""),
        "section": school_info.get("section", ""),
        "dates": dates_list,
        "holidays": set(), # CSV doesn't specify holidays, assume none or manual?
        "students_male": students_male,
        "students_female": students_female
    }

    # Output Path
    if not output_path:
        default_name = f"Attendance_{composer_data['month']}_{composer_data['section']}.xlsx"
        default_name = default_name.replace(" ", "_")
        output_path = os.path.join(os.path.dirname(csv_path), default_name)
    
    # Check duplicate
    if os.path.exists(output_path):
         timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
         base, ext = os.path.splitext(output_path)
         output_path = f"{base}_{timestamp}{ext}"

    # Template
    template = os.path.join(os.getcwd(), "sf2-template", "SF2Template.xlsx")
    
    print(f"Generating report for {composer_data['school_name']}...")
    processor.save_to_excel(composer_data, template, output_path)
    print(f"Successfully saved to: {output_path}")
    return output_path
