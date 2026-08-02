import requests
try:
    res = requests.get("https://image.pollinations.ai/prompt/robot", headers={"User-Agent": "Mozilla/5.0"}, timeout=10)
    print("STATUS:", res.status_code)
    print("CONTENT-TYPE:", res.headers.get("content-type"))
    print("SIZE:", len(res.content))
except Exception as e:
    print("ERROR:", e)
