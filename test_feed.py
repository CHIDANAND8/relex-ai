import requests
import os

with open("test_upload.txt", "w") as f:
    f.write("This is a test document.")

url = "http://localhost:8000/admin/feed-document"
files = {"file": open("test_upload.txt", "rb")}
data = {
    "title": "Test Doc",
    "target_user": "ALL",
    "created_by": "admin"
}

try:
    response = requests.post(url, files=files, data=data)
    print("STATUS:", response.status_code)
    print("RESPONSE:", response.text)
except Exception as e:
    print("REQUEST FAILED:", e)
