"""Smoke-check the static site: serve it, then assert every page, asset and
nav link actually resolves and the journal data still parses.

    python scripts/check_site.py

Catches the things that break silently in a no-build static site: a renamed
image, a stylesheet that moved, a nav entry pointing at a directory that
isn't there, malformed posts.json.
"""
import http.server
import json
import os
import re
import socketserver
import sys
import threading
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGES = ["/", "/projects/", "/about/", "/kingdom/", "/stores/", "/abalone/", "/abalone/learn.html", "/mtg/"]

failures = []


def check(condition, message):
    if not condition:
        failures.append(message)


def get(base, path):
    with urllib.request.urlopen(base + path, timeout=10) as res:
        return res.status, res.read().decode("utf-8", "replace")


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def serve():
    handler = lambda *a, **kw: QuietHandler(*a, directory=ROOT, **kw)
    httpd = socketserver.TCPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd, f"http://127.0.0.1:{httpd.server_address[1]}"


def main():
    httpd, base = serve()
    try:
        # Every nav destination in the shared header must exist.
        _, header = get(base, "/header.html")
        for href in re.findall(r'href="([^"]+)"', header):
            if href.startswith(("http", "#")):
                continue
            path = "/" if href == "." else "/" + href.lstrip("./")
            status, _ = get(base, path)
            check(status == 200, f"header link {href!r} -> {path} returned {status}")

        # Every page loads, and so does every local asset it references.
        for page in PAGES:
            status, html = get(base, page)
            check(status == 200, f"{page} returned {status}")
            base_dir = page if page.endswith("/") else page.rsplit("/", 1)[0] + "/"
            assets = re.findall(r'(?:src|href)="((?!http|#|mailto)[^"]+)"', html)
            for asset in assets:
                target = asset if asset.startswith("/") else os.path.normpath(base_dir + asset).replace("\\", "/")
                try:
                    status, _ = get(base, target)
                except Exception as e:  # 404 raises
                    failures.append(f"{page} references missing asset {asset} ({e})")
                    continue
                check(status == 200, f"{page} asset {asset} returned {status}")

        # The journal renders straight from this file; a bad record is a blank page.
        _, raw = get(base, "/about/posts.json")
        posts = json.loads(raw)
        check(len(posts) > 0, "posts.json is empty")
        for post in posts:
            for field in ("title", "date", "text", "layout"):
                check(bool(post.get(field)), f"post {post.get('title')!r} is missing {field}")
            if post.get("image"):
                status, _ = get(base, "/about/" + post["image"])
                check(status == 200, f"post {post['title']!r} image {post['image']} returned {status}")
            check(
                re.search(r"\b\d{4}\b", post["date"]) is not None,
                f"post {post['title']!r} date {post['date']!r} has no year for the timeline marker",
            )

        # The store map shows this date; without it the map claims no provenance.
        _, meta = get(base, "/stores/data/meta.json")
        check("fetched" in json.loads(meta), "stores/data/meta.json has no 'fetched' date")
    finally:
        httpd.shutdown()

    for failure in failures:
        print("FAIL:", failure)
    print(f"\n{len(failures)} failure(s)")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
