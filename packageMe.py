import os
import tarfile
from datetime import datetime

def is_ignored(path, patterns):
    if path == ".gitignore":
        return False
        
    path_parts = path.split(os.sep)
    
    for pattern in patterns:
        if pattern.startswith("*."):
            if path.endswith(pattern[1:]):
                return True
        elif "/" in pattern:
            # If pattern is a path-like string (e.g. database/backups)
            norm_pattern = pattern.replace("/", os.sep)
            if path == norm_pattern or path.startswith(norm_pattern + os.sep) or (norm_pattern in path):
                return True
        else:
            # Basic folder or file match (e.g. node_modules, .env)
            if pattern in path_parts:
                return True
                
    return False

def package_project():
    # Base ignores: git config, python caches, output archives, virtual env, and this script
    ignore_patterns = [".git", "__pycache__", "*.tar.gz", "packageMe.py", "venv"]
    
    # Read patterns from .gitignore
    if os.path.exists(".gitignore"):
        with open(".gitignore", "r") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#"):
                    ignore_patterns.append(line)
                    
    # Generate timestamped archive name
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    tar_filename = f"openattendance_backup_{timestamp}.tar.gz"
    
    print(f"Creating archive: {tar_filename}")
    
    added_files = 0
    with tarfile.open(tar_filename, "w:gz") as tar:
        for root, dirs, files in os.walk("."):
            rel_root = os.path.relpath(root, ".")
            if rel_root == ".":
                rel_root = ""
                
            # Filter directories in-place to avoid traversing ignored paths
            filtered_dirs = []
            for d in dirs:
                dir_path = os.path.join(rel_root, d) if rel_root else d
                if not is_ignored(dir_path, ignore_patterns):
                    filtered_dirs.append(d)
                else:
                    print(f"Skipping ignored directory: {dir_path}")
            dirs[:] = filtered_dirs
            
            # Add the directory itself (non-recursive) to ensure empty ones are archived
            if rel_root:
                tar.add(rel_root, recursive=False)
            
            for file in files:
                rel_path = os.path.join(rel_root, file) if rel_root else file
                
                # Special rule: explicitly include .gitignore
                if rel_path == ".gitignore" or not is_ignored(rel_path, ignore_patterns):
                    print(f"Adding: {rel_path}")
                    tar.add(rel_path)
                    added_files += 1
                    
    print(f"Archiving complete! Added {added_files} files to {tar_filename}")

if __name__ == "__main__":
    package_project()
