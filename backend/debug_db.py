import sqlite3

try:
    conn = sqlite3.connect("chat.db")
    cursor = conn.cursor()
    cursor.execute("SELECT content FROM admin_feeds")
    rows = cursor.fetchall()
    print(f"Total admin feeds: {len(rows)}")
    for i, row in enumerate(rows):
        content = row[0]
        print(f"--- Feed {i} ---")
        print(content[:200] + "..." if len(content) > 200 else content)
    conn.close()
except Exception as e:
    print("Error reading db:", e)
