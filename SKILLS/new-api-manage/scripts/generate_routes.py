#!/usr/bin/env python3
"""Generate a route index from QuantumNous/new-api router/api-router.go.

This script is intentionally "best-effort" and aims to be stable across minor
formatting changes in api-router.go.

It does NOT require a Go parser; it scans for common Gin patterns:
  - <var> := <parent>.Group("/path")
  - <var>.Use(middleware.UserAuth()/AdminAuth()/RootAuth()/TokenAuthReadOnly()/TryUserAuth()/TokenOrUserAuth())
  - <var>.GET/POST/PUT/PATCH/DELETE("/path", ... controller.Handler)

Output:
  - Markdown table (default)
  - JSON array
"""

from __future__ import annotations

import argparse
import json
import re
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Dict, List, Optional, Tuple


@dataclass
class Group:
    name: str
    parent: str
    prefix: str
    auth: str = "public"  # public|try_user|token_readonly|token_or_user|user|admin|root


@dataclass
class Route:
    method: str
    path: str
    auth: str
    handler: str
    owner: str
    middlewares: List[str]


AUTH_PRIORITY = {
    "public": 0,
    "try_user": 1,
    "token_readonly": 2,
    "token_or_user": 3,
    "user": 4,
    "admin": 5,
    "root": 6,
}


def max_auth(a: str, b: str) -> str:
    return a if AUTH_PRIORITY.get(a, 0) >= AUTH_PRIORITY.get(b, 0) else b


def detect_auth_from_text(text: str) -> str:
    auth = "public"
    if "middleware.RootAuth()" in text:
        auth = max_auth(auth, "root")
    if "middleware.AdminAuth()" in text:
        auth = max_auth(auth, "admin")
    if "middleware.UserAuth()" in text:
        auth = max_auth(auth, "user")
    if "middleware.TokenAuthReadOnly()" in text:
        auth = max_auth(auth, "token_readonly")
    if "middleware.TokenOrUserAuth()" in text:
        auth = max_auth(auth, "token_or_user")
    if "middleware.TryUserAuth()" in text:
        auth = max_auth(auth, "try_user")
    return auth


def join_paths(a: str, b: str) -> str:
    if a == "":
        return b
    if b == "":
        return a
    if a.endswith("/") and b.startswith("/"):
        return a[:-1] + b
    if (not a.endswith("/")) and (not b.startswith("/")):
        return a + "/" + b
    return a + b


def resolve_prefix(groups: Dict[str, Group], owner: str) -> Tuple[str, str]:
    prefix = ""
    auth = "public"
    cur = owner
    seen = set()
    # Walk up to the root
    while cur in groups and cur not in seen:
        seen.add(cur)
        g = groups[cur]
        prefix = join_paths(g.prefix, prefix) if prefix else g.prefix
        auth = max_auth(auth, g.auth)
        cur = g.parent
    return prefix, auth


def parse_router(router_file: Path) -> List[Route]:
    content = router_file.read_text(encoding="utf-8", errors="replace").splitlines()

    # group definitions
    group_re = re.compile(r'^(?P<var>\w+)\s*:=\s*(?P<parent>\w+)\.Group\("(?P<prefix>[^"]*)"')
    use_re = re.compile(r'^(?P<var>\w+)\.Use\((?P<args>.*)\)')

    # route definitions
    route_re = re.compile(
        r'^(?P<var>\w+)\.(?P<method>GET|POST|PUT|PATCH|DELETE)\("(?P<path>[^"]*)"(?P<rest>.*)$'
    )

    groups: Dict[str, Group] = {}
    routes: List[Route] = []

    for line in content:
        stripped = line.strip()
        if not stripped or stripped.startswith("//"):
            continue

        m = group_re.match(stripped)
        if m:
            var = m.group("var")
            parent = m.group("parent")
            prefix = m.group("prefix")
            groups[var] = Group(name=var, parent=parent, prefix=prefix)
            continue

        m = use_re.match(stripped)
        if m:
            var = m.group("var")
            args = m.group("args")
            auth = detect_auth_from_text(args)
            if var in groups:
                groups[var].auth = max_auth(groups[var].auth, auth)
            else:
                # Sometimes Use() is called on a var we didn't capture via Group().
                # Keep it anyway.
                groups[var] = Group(name=var, parent="", prefix="", auth=auth)
            continue

        m = route_re.match(stripped)
        if m:
            owner = m.group("var")
            method = m.group("method")
            path = m.group("path")
            rest = m.group("rest")
            handler_match = re.findall(r"controller\.\w+", stripped)
            handler = handler_match[-1] if handler_match else ""
            mw = re.findall(r"middleware\.\w+\(\)", stripped)
            route_auth = detect_auth_from_text(stripped)
            prefix, group_auth = resolve_prefix(groups, owner)
            full_path = join_paths(prefix, path)
            auth = max_auth(group_auth, route_auth)
            routes.append(
                Route(
                    method=method,
                    path=full_path,
                    auth=auth,
                    handler=handler,
                    owner=owner,
                    middlewares=mw,
                )
            )
            continue

    # Sort by path then method for deterministic output
    routes.sort(key=lambda r: (r.path, r.method))
    return routes


def render_md(routes: List[Route]) -> str:
    lines = []
    lines.append("| Method | Path | Auth | Handler |")
    lines.append("|---|---|---|---|")
    for r in routes:
        lines.append(
            "| {method} | `{path}` | `{auth}` | `{handler}` |".format(
                method=r.method,
                path=r.path,
                auth=r.auth,
                handler=r.handler or "-",
            )
        )
    return "\n".join(lines) + "\n"


def main() -> int:
    ap = argparse.ArgumentParser(description="Generate route index from new-api api-router.go")
    ap.add_argument(
        "--code-dir",
        default=None,
        help="Path to new-api repository root (default: use NEW_API_CODE_DIR env if set)",
    )
    ap.add_argument(
        "--router-file",
        default=None,
        help='Path to api-router.go (default: <code-dir>/router/api-router.go)',
    )
    ap.add_argument("--format", choices=["md", "json"], default="md")
    ap.add_argument("--out", default=None, help="Write output to file (default: stdout)")
    args = ap.parse_args()

    code_dir = args.code_dir
    if code_dir is None:
        import os

        code_dir = os.environ.get("NEW_API_CODE_DIR")

    if args.router_file:
        router_file = Path(args.router_file)
    else:
        if not code_dir:
            raise SystemExit("--code-dir (or NEW_API_CODE_DIR) is required when --router-file is not provided")
        router_file = Path(code_dir) / "router" / "api-router.go"

    if not router_file.exists():
        raise SystemExit(f"router file not found: {router_file}")

    routes = parse_router(router_file)

    if args.format == "json":
        out_text = json.dumps([asdict(r) for r in routes], ensure_ascii=False, indent=2) + "\n"
    else:
        out_text = render_md(routes)

    if args.out:
        out_path = Path(args.out)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(out_text, encoding="utf-8")
    else:
        print(out_text, end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
