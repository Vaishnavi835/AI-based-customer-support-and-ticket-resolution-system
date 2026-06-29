"""
check_all.py  —  Full backend API health check
Run: .\\venv\\Scripts\\python.exe check_all.py
"""
import urllib.request, urllib.parse, json, sys

BASE = "http://127.0.0.1:8000"
results = []

def req(method, path, body=None, headers=None, token=None):
    h = {"Content-Type": "application/json"}
    if headers:
        h.update(headers)
    if token:
        h["Authorization"] = "Bearer " + token
    data = body.encode() if isinstance(body, str) else None
    try:
        r = urllib.request.urlopen(
            urllib.request.Request(BASE + path, data=data, headers=h, method=method),
            timeout=12,
        )
        return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read())
        except Exception:
            return e.code, {}
    except Exception as ex:
        return 0, str(ex)


def add(label, status, detail):
    results.append((label, status, detail))


# 1. Health
s, b = req("GET", "/health")
add("GET /health", s, "ok" if s == 200 else str(b))

# 2. Root
s, b = req("GET", "/")
add("GET /", s, "ok" if s == 200 else str(b))

# 3. Login correct
TOKEN = None
form = "username=admin%40support.com&password=Admin%40123"
try:
    r = urllib.request.urlopen(
        urllib.request.Request(
            BASE + "/auth/login",
            data=form.encode(),
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            method="POST",
        ),
        timeout=12,
    )
    login_data = json.loads(r.read())
    TOKEN = login_data.get("access_token")
    role = login_data.get("role", "?")
    add("POST /auth/login (correct)", 200, "ok, role: " + role)
except urllib.error.HTTPError as e:
    add("POST /auth/login (correct)", e.code, str(e.read()[:80]))
except Exception as ex:
    add("POST /auth/login (correct)", 0, str(ex))

# 4. Login wrong password
form_bad = "username=admin%40support.com&password=wrongpassword"
try:
    urllib.request.urlopen(
        urllib.request.Request(
            BASE + "/auth/login",
            data=form_bad.encode(),
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            method="POST",
        ),
        timeout=12,
    )
    add("POST /auth/login (wrong pw)", 200, "BUG: should return 401!")
except urllib.error.HTTPError as e:
    add("POST /auth/login (wrong pw)", e.code, "ok, returns 401 correctly" if e.code == 401 else "UNEXPECTED: " + str(e.code))
except Exception as ex:
    add("POST /auth/login (wrong pw)", 0, str(ex))

# 5. /auth/me authenticated
s, b = req("GET", "/auth/me", token=TOKEN)
name = b.get("name", str(b)) if isinstance(b, dict) else str(b)
add("GET /auth/me (with token)", s, "ok, " + name if s == 200 else str(b))

# 6. /auth/me unauthenticated
s, b = req("GET", "/auth/me")
add("GET /auth/me (no token)", s, "ok, returns 401 correctly" if s == 401 else "UNEXPECTED: " + str(s))

# 7. GET /tickets/
s, b = req("GET", "/tickets/", token=TOKEN)
count = len(b) if isinstance(b, list) else "?"
add("GET /tickets/", s, "ok, " + str(count) + " tickets" if s == 200 else str(b)[:60])

# 8. GET /users/
s, b = req("GET", "/users/", token=TOKEN)
count = len(b) if isinstance(b, list) else "?"
add("GET /users/", s, "ok, " + str(count) + " users" if s == 200 else str(b)[:60])

# 9. GET /rag/knowledge
s, b = req("GET", "/rag/knowledge", token=TOKEN)
count = len(b) if isinstance(b, list) else "?"
add("GET /rag/knowledge", s, "ok, " + str(count) + " docs" if s == 200 else str(b)[:60])

# 10. GET /notifications/
s, b = req("GET", "/notifications/", token=TOKEN)
count = len(b) if isinstance(b, list) else "?"
add("GET /notifications/", s, "ok, " + str(count) + " items" if s == 200 else str(b)[:60])

# 11. GET /auth/sessions
s, b = req("GET", "/auth/sessions", token=TOKEN)
count = len(b) if isinstance(b, list) else "?"
add("GET /auth/sessions", s, "ok, " + str(count) + " sessions" if s == 200 else str(b)[:60])

# 12. GET /escalation/
s, b = req("GET", "/escalation/", token=TOKEN)
count = len(b) if isinstance(b, list) else "?"
add("GET /escalation/", s, "ok, " + str(count) + " items" if s == 200 else str(b)[:60])


def is_pass(label, status):
    if "wrong pw" in label and status == 401:
        return True
    if "no token" in label and status == 401:
        return True
    return str(status).startswith("2")


print()
print("=" * 72)
print("  {:<38} {:<8} {}".format("ENDPOINT", "STATUS", "RESULT"))
print("=" * 72)
for label, status, detail in results:
    passed = is_pass(label, status)
    icon = "PASS" if passed else "FAIL"
    print("  {}  {:<36} {:<8} {}".format(icon, label, str(status), str(detail)[:36]))
print("=" * 72)

failures = [(l, s, d) for l, s, d in results if not is_pass(l, s)]
print("  {}/{} checks passed".format(len(results) - len(failures), len(results)))
if failures:
    print()
    print("  FAILURES:")
    for l, s, d in failures:
        print("    [{}] {}: {}".format(s, l, d))
else:
    print("  All checks passed!")
print("=" * 72)
