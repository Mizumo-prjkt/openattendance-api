import json
import os

def load_data(filepath):
    """
    Parses the given file and returns a list of records.
    Supported formats: .json, .csv (mocked)
    """
    if not os.path.exists(filepath):
        raise FileNotFoundError(f"File not found: {filepath}")

    ext = os.path.splitext(filepath)[1].lower()
    
    if ext == '.json':
        try:
            with open(filepath, 'r') as f:
                return json.load(f)
        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid JSON file: {e}")
            
    elif ext == '.csv':
        # Mock CSV parsing for now
        print(f"Mock parsing CSV file: {filepath}")
        return [
            {"name": "Student A", "status": "Present", "date": "2023-10-01"},
            {"name": "Student B", "status": "Absent", "date": "2023-10-01"},
            {"name": "Student C", "status": "Late", "date": "2023-10-01"}
        ]
    else:
        raise ValueError(f"Unsupported file format: {ext}")

def validate_data(data):
    """
    Checks if data has required fields.
    Returns (bool, str): (IsValid, Message)
    """
    if not isinstance(data, list):
        return False, "Data is not a list."
        
    required_keys = ["name", "status"]
    errors = []
    
    for idx, record in enumerate(data):
        missing = [key for key in required_keys if key not in record]
        if missing:
            errors.append(f"Row {idx+1}: Missing {', '.join(missing)}")
            
    if errors:
        return False, "\n".join(errors[:5]) + ("\n..." if len(errors) > 5 else "")
    
    return True, "Data is valid."

def format_data(data):
    """
    Standardizes data formats (e.g., capitalize status).
    Returns new list of data.
    """
    new_data = []
    for record in data:
        new_record = record.copy()
        if "status" in new_record:
            new_record["status"] = new_record["status"].title()
        if "name" in new_record:
            new_record["name"] = new_record["name"].title()
        new_data.append(new_record)
    return new_data

def save_data(data, filepath):
    """
    Saves data to JSON or CSV.
    """
    ext = os.path.splitext(filepath)[1].lower()
    if ext == '.json':
        with open(filepath, 'w') as f:
            json.dump(data, f, indent=4)
    elif ext == '.csv':
        import csv
        if not data:
            with open(filepath, 'w') as f: 
                pass # Empty file
            return
            
        keys = data[0].keys()
        with open(filepath, 'w', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=keys)
            writer.writeheader()
            writer.writerows(data)
    else:
        raise ValueError(f"Unsupported save format: {ext}")
