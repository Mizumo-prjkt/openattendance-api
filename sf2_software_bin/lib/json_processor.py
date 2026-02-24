import json
import os
import datetime
from . import processor

def load_json(file_path):
    """
    Loads and validates the JSON file.
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"JSON file not found: {file_path}")
        
    try:
        with open(file_path, 'r') as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON format: {e}")
        
    # Basic Validation
    required_keys = ["school_info", "students"]
    for key in required_keys:
        if key not in data:
            raise ValueError(f"Missing required key in JSON: {key}")
            
    return data

def process_json_to_excel(json_path, output_path=None, force_split=False):
    """
    Reads JSON, processes data, and saves to Excel using processor.save_to_excel.
    """
    data = load_json(json_path)
    
    school_info = data.get("school_info", {})
    students = data.get("students", [])
    holidays = set(data.get("holidays", []))
    
    # helper for keys
    # JSON keys might differ slightly from processor expectations, let's map them.
    # processor expects: school_name, school_id, school_year, month, grade, section
    
    # valid fields in school_info
    required_info = ["school_name", "school_id", "school_year", "month", "grade", "section"]
    composer_data = {}
    
    for key in required_info:
        if key not in school_info:
             # Try simple mapping if user used shorter keys? 
             # For now enforce strict keys or map specific ones if needed.
             # schema in plan used "name", "id", "year". mapping them:
             mapping = {"school_name": "name", "school_id": "id", "school_year": "year"}
             alt_key = mapping.get(key)
             if alt_key and alt_key in school_info:
                 composer_data[key] = school_info[alt_key]
             else:
                 # Default to empty or raise error? Let's raise for now to be safe.
                 # Actually, let's just warn or use empty string to avoid crashing hard on minor things.
                 composer_data[key] = ""
        else:
            composer_data[key] = school_info[key]

    # Calculate Dates
    try:
        dates = processor.get_weekdays_in_month(
            composer_data["school_year"], composer_data["month"]
        )
        composer_data["dates"] = dates
    except Exception as e:
        raise ValueError(f"Date Calculation Error: {str(e)}")

    composer_data["holidays"] = holidays

    # Process Students
    students_male = []
    students_female = []
    
    for s in students:
        s_name = s.get("name", "Unknown")
        s_gender = s.get("gender", "M").upper()
        s_att = s.get("attendance", {})
        
        student_obj = {
            "name": s_name,
            "attendance": s_att
        }
        
        if s_gender == "M" or s_gender == "MALE":
            students_male.append(student_obj)
        else:
            students_female.append(student_obj)
            
    # Sort
    students_male.sort(key=lambda x: x["name"])
    students_female.sort(key=lambda x: x["name"])

    # Splitting Logic
    def chunk_list(lst, n):
        for i in range(0, len(lst), n):
            yield lst[i:i + n]

    male_chunks = list(chunk_list(students_male, 30)) if students_male else [[]]
    female_chunks = list(chunk_list(students_female, 30)) if students_female else [[]]

    num_parts = max(len(male_chunks), len(female_chunks))
    
    # If not force_split but somehow limits were high (should be caught by guardrails)
    if not force_split and num_parts > 1:
        # Fallback security if guardrails bypassed
        male_chunks = [students_male[:30]]
        female_chunks = [students_female[:30]]
        num_parts = 1

    generated_paths = []
    
    for i in range(num_parts):
        part_males = male_chunks[i] if i < len(male_chunks) else []
        part_females = female_chunks[i] if i < len(female_chunks) else []
        
        part_data = composer_data.copy()
        part_data["students_male"] = part_males
        part_data["students_female"] = part_females
        
        # Determine output path for this part
        current_output_path = output_path
        if not current_output_path:
            # Generate default
            suffix = f"_pt{i+1}" if num_parts > 1 else ""
            default_name = f"Attendance_{composer_data['month']}_{composer_data['section']}{suffix}.xlsx"
            default_name = default_name.replace(" ", "_")
            current_output_path = os.path.join(os.path.dirname(json_path), default_name)
        else:
            if num_parts > 1:
                base, ext = os.path.splitext(current_output_path)
                current_output_path = f"{base}_pt{i+1}{ext}"
                
        # Check duplicate
        if os.path.exists(current_output_path):
             timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
             base, ext = os.path.splitext(current_output_path)
             current_output_path = f"{base}_{timestamp}{ext}"

        # Template
        # Assuming template is in current working directory/sf2-template/
        template = os.path.join(os.getcwd(), "sf2-template", "SF2Template.xlsx")
        
        print(f"Generating report part {i+1}/{num_parts} for {composer_data['school_name']}...")
        processor.save_to_excel(part_data, template, current_output_path)
        print(f"Successfully saved to: {current_output_path}")
        generated_paths.append(current_output_path)
        
    return generated_paths
