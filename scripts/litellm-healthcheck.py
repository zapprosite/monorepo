import urllib.request, urllib.error, sys

req = urllib.request.Request("http://localhost:4000/health")
try:
    urllib.request.urlopen(req)
except urllib.error.HTTPError as e:
    sys.exit(0) if e.code == 401 else sys.exit(1)
