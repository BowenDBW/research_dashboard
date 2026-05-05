import os
import subprocess
import sys
def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    scripts = [
        "refresh_sql.py",
        "import_venues.py",
        "insert_test_data.py"
    ]

    for script in scripts:
        script_path = os.path.join(base_dir, script)
        print(f"Running {script}...")
        result = subprocess.run([sys.executable, script_path])
        if result.returncode != 0:
            print(f"Error running {script}. Exiting.")
            sys.exit(result.returncode)

    print("All scripts executed successfully.")

if __name__ == "__main__":
    main()
