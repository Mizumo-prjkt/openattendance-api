# JSON Structure Guide for Automated Processing

This guide explains the expected JSON structure when using the automated JSON processing feature (`python3 main.py --json data.json`).

> [!WARNING]
> The automated processing mode **ONLY accepts a maximum of 30 male and 30 female students**. If you provide more, the excess students will be ignored or it may result in an error depending on the underlying Excel template limitations.

## Example JSON Structure

Here is a complete example of the expected JSON format:

```json
{
    "school_info": {
        "name": "Test High School",
        "id": "999999",
        "year": "2024-2025",
        "month": "January",
        "grade": "12",
        "section": "Diamond"
    },
    "students": [
        {
            "name": "Alpha, John",
            "gender": "M",
            "attendance": {
                "2025-01-06": "PRESENT",
                "2025-01-07": "ABSENT"
            }
        },
        {
            "name": "Beta, Jane",
            "gender": "F",
            "attendance": {
                "2025-01-06": "ABSENT",
                "2025-01-08": "PRESENT",
                "2025-01-09": "TARDY"
            }
        }
    ],
    "holidays": [
        "2025-01-01"
    ]
}
```

## Field Descriptions

### `school_info` (Object)
Contains metadata about the school, class, and the report period.
- `name` (String): The name of the school.
- `id` (String): The School ID.
- `year` (String): The school year (e.g., "2024-2025").
- `month` (String): The month the attendance report is for (e.g., "January", "February").
- `grade` (String): The grade level.
- `section` (String): The class section name.

### `students` (Array of Objects)
Contains the list of students and their attendance records. 
- **Constraint**: Maximum 30 objects where `gender` is `"M"` and maximum 30 objects where `gender` is `"F"`.
- Each object contains:
  - `name` (String): Student's full name, typically in "Last Name, First Name" format.
  - `gender` (String): `"M"` for Male, `"F"` for Female.
  - `attendance` (Object): A dictionary/map where the key is the date in `YYYY-MM-DD` format and the value is the status (`"PRESENT"`, `"ABSENT"`, etc.).

### `holidays` (Array of Strings)
Contains a list of dates that are flagged as holidays for the given month.
- Values must be date strings in `YYYY-MM-DD` format.
