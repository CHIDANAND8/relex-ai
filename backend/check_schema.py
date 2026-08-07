import sqlite3

try:
    conn = sqlite3.connect("platform.db")
    cursor = conn.cursor()
    cursor.execute("PRAGMA table_info(admin_feeds);")
    columns = cursor.fetchall()
    with open("table_check_output.txt", "w") as f:
        for c in columns:
            f.write(str(c) + "\n")
    conn.close()
except Exception as e:
    with open("table_check_output.txt", "w") as f:
        f.write(str(e))
