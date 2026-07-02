#!/usr/bin/env python3
import os
import glob
import subprocess
import sys

def main():
    # Load all json files
    genesis_files = sorted(glob.glob("public/bibles/telugu/OT/Genesis/*.json"))
    mark_files = sorted(glob.glob("public/bibles/telugu/NT/Mark/*.json"))
    john_files = sorted(glob.glob("public/bibles/telugu/NT/John/*.json"))
    
    all_files = genesis_files + mark_files + john_files
    total = len(all_files)
    
    print(f"=== STARTING REALIGNMENT PASS FOR {total} CHAPTERS ===")
    
    for idx, filepath in enumerate(all_files, 1):
        print(f"[{idx}/{total}] Processing {filepath}...")
        try:
            # Execute realign_segments.py as a subprocess
            res = subprocess.run(
                [sys.executable, "scripts/realign_segments.py", filepath],
                capture_output=True,
                text=True,
                check=True
            )
            print(f"  Done: {filepath}")
        except subprocess.CalledProcessError as e:
            print(f"  ERROR processing {filepath}: {e.stderr}")
            
    print("=== ALL CHAPTERS REALIGNED SUCCESSFULLY ===")

if __name__ == "__main__":
    main()
