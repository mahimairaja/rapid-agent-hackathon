import os
import re

def check_imports():
    src_dir = 'src'
    import_pattern = re.compile(r'import\s+.*?\s+from\s+[\'"]([^\'"]+)[\'"]')
    
    for root, _, files in os.walk(src_dir):
        for file in files:
            if not file.endswith(('.ts', '.tsx')):
                continue
            
            filepath = os.path.join(root, file)
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
                
            for match in import_pattern.finditer(content):
                import_path = match.group(1)
                
                if not import_path.startswith('.'):
                    continue
                    
                # Resolve relative path
                resolved_dir = os.path.normpath(os.path.join(root, os.path.dirname(import_path)))
                basename = os.path.basename(import_path)
                
                # Check if resolved_dir exists
                if not os.path.isdir(resolved_dir):
                    continue
                    
                # Get actual files in directory
                actual_files = os.listdir(resolved_dir)
                
                # Strip extensions from actual files for comparison
                actual_files_no_ext = {os.path.splitext(f)[0]: f for f in actual_files}
                
                # Check if imported basename matches exactly (case-sensitive)
                # Note: imports usually don't have extensions in TS/Vite
                if basename not in actual_files_no_ext:
                    # Maybe it's a directory import (e.g. ./components)
                    if basename in actual_files and os.path.isdir(os.path.join(resolved_dir, basename)):
                        continue
                        
                    # Let's do a case-insensitive check to see if it matches something
                    lower_actual = {k.lower(): k for k in actual_files_no_ext.keys()}
                    if basename.lower() in lower_actual:
                        actual_name = lower_actual[basename.lower()]
                        print(f"CASE MISMATCH in {filepath}: imported '{basename}', but actual file is '{actual_name}'")

check_imports()
