"""The Kubernetes manifests (deployment/k8s) agree with the API and the dashboard.

No cluster runs in CI, so routing is checked by emulating ingress-nginx: once
an Ingress for a host uses regex (the API's rewrite does), every path of that
host is a case-insensitive regex anchored at the start, tried longest first;
the first match wins.
"""
import re
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

K8S = ROOT / "deployment" / "k8s"
HOST = "netwatch.yourdomain.com"
DOCS = [d for f in sorted(K8S.glob("*.yaml"))
        for d in yaml.safe_load_all(f.read_text(encoding="utf-8")) if d]


def of_kind(kind):
    return [d for d in DOCS if d["kind"] == kind]


def named(kind, name):
    return next(d for d in of_kind(kind) if d["metadata"]["name"] == name)


def _routes():
    routes = []
    for ing in of_kind("Ingress"):
        ann = ing["metadata"].get("annotations", {})
        for rule in ing["spec"]["rules"]:
            if rule["host"] != HOST:
                continue
            for p in rule["http"]["paths"]:
                routes.append({"ingress": ing["metadata"]["name"], "path": p["path"],
                               "service": p["backend"]["service"]["name"],
                               "rewrite": ann.get("nginx.ingress.kubernetes.io/rewrite-target"),
                               "allow": ann.get("nginx.ingress.kubernetes.io/whitelist-source-range")})
    return sorted(routes, key=lambda r: len(r["path"]), reverse=True)


ROUTES = _routes()


def route(path):
    """(route, path the backend receives) for a request path."""
    for r in ROUTES:
        m = re.match(r["path"], path, re.IGNORECASE)
        if m:
            upstream = m.expand(r["rewrite"].replace("$", "\\")) if r["rewrite"] else path
            return r, upstream
    raise AssertionError(f"no route for {path}")


def dashboard_pages():
    pages = []
    for f in (ROOT / "dashboard" / "app").rglob("page.tsx"):
        parts = f.relative_to(ROOT / "dashboard" / "app").parent.parts
        pages.append("/" + "/".join("alt_1" if p.startswith("[") else p for p in parts))
    return pages


def api_paths():
    """Every HTTP path the API serves (its OpenAPI schema; the WebSocket is
    checked on its own)."""
    from api.main import app
    return sorted({re.sub(r"\{[^}]+\}", "alt_1", p) for p in app.openapi()["paths"]})


def test_every_dashboard_page_reaches_the_dashboard():
    """The ingress sent /alerts, /models and /evaluation to the API, so those
    pages could not be opened."""
    pages = dashboard_pages()
    assert {"/", "/alerts", "/alerts/alt_1", "/models", "/evaluation"} <= set(pages)
    for page in pages:
        r, upstream = route(page)
        assert r["service"] == "netwatch-dashboard-service", f"{page} goes to {r['service']}"
        assert upstream == page


def test_the_api_is_under_api_with_the_prefix_removed():
    for path in api_paths():
        if path == "/metrics":
            continue
        r, upstream = route("/api" + path)
        assert r["service"] == "netwatch-api-service" and r["allow"] is None, path
        assert upstream == path, f"/api{path} reaches the API as {upstream}"
    # the dashboard's alert stream: its API URL + /ws/alerts (dashboard/lib/socket.ts)
    assert route("/api/ws/alerts")[1] == "/ws/alerts"


def test_prometheus_metrics_stay_off_the_public_site():
    r, _ = route("/api/metrics")
    assert r["allow"] == "127.0.0.1/32"
    for path in ("/api/metrics/model", "/api/metrics/drift", "/api/METRICS/model"):
        r, upstream = route(path)
        assert r["allow"] is None and upstream == path[4:]


def test_the_api_runs_as_one_pod_replaced_on_deploy():
    """State in the process and SQLite on a ReadWriteOnce volume: 2-8 replicas
    behind an autoscaler each saw part of the traffic, and could not all mount
    the volume."""
    api = named("Deployment", "netwatch-api")
    assert api["spec"]["replicas"] == 1
    assert api["spec"]["strategy"]["type"] == "Recreate"
    targets = {h["spec"]["scaleTargetRef"]["name"] for h in of_kind("HorizontalPodAutoscaler")}
    assert "netwatch-api" not in targets


def test_models_come_from_the_image_and_volumes_exist():
    """An empty volume mounted over /app/models hid the models in the image:
    every /score answered 503."""
    api = named("Deployment", "netwatch-api")["spec"]["template"]["spec"]
    mounts = [m["mountPath"] for c in api["containers"] for m in c.get("volumeMounts", [])]
    assert not [m for m in mounts if m == "/app" or m.startswith("/app/")]
    claims = {c["metadata"]["name"]: c for c in of_kind("PersistentVolumeClaim")}
    for v in api.get("volumes", []):
        assert v["persistentVolumeClaim"]["claimName"] in claims
    assert all(c["spec"]["accessModes"] == ["ReadWriteOnce"] for c in claims.values())


def test_the_dashboard_api_address_is_a_build_argument():
    """Next.js fixes NEXT_PUBLIC_API_URL at build time: the value the dashboard
    pods were given did nothing, and named a host the ingress never served."""
    for cm in of_kind("ConfigMap"):
        assert not [k for k in cm.get("data", {}) if k.startswith("NEXT_PUBLIC_")]
    for dep in of_kind("Deployment"):
        for c in dep["spec"]["template"]["spec"]["containers"]:
            assert not [e for e in c.get("env", []) if e["name"].startswith("NEXT_PUBLIC_")]
    gh = (ROOT / "deployment/ci-cd/release-pipeline.yml").read_text(encoding="utf-8")
    gl = (ROOT / "deployment/ci-cd/gitlab-ci.yml").read_text(encoding="utf-8")
    assert "NEXT_PUBLIC_API_URL=${{ vars.PUBLIC_URL }}/api" in gh
    assert '--build-arg NEXT_PUBLIC_API_URL="$PUBLIC_URL/api"' in gl


def test_the_configmap_holds_only_settings_the_api_reads():
    code = "".join(p.read_text(encoding="utf-8") for p in (ROOT / "api").rglob("*.py"))
    for key in named("ConfigMap", "netwatch-config")["data"]:
        assert re.search(rf"""environ(?:\.get)?\(\s*["']{key}["']|environ\[["']{key}["']\]""", code), key


def test_no_snippet_annotations():
    """ingress-nginx rejects them by default since v1.9, and with them the whole
    Ingress."""
    for ing in of_kind("Ingress"):
        assert not [a for a in ing["metadata"].get("annotations", {}) if a.endswith("-snippet")]


def test_security_headers_match_the_compose_deployment():
    conf = (ROOT / "deployment/nginx/security-headers.conf").read_text(encoding="utf-8")
    nginx = dict(re.findall(r'^\s*add_header\s+(\S+)\s+"(.*)"\s+always;', conf, re.MULTILINE))
    assert nginx and named("ConfigMap", "netwatch-security-headers")["data"] == nginx


def test_ingress_services_and_deployments_connect():
    services = {s["metadata"]["name"]: s for s in of_kind("Service")}
    for r in ROUTES:
        assert r["service"] in services
    for ing in of_kind("Ingress"):
        for rule in ing["spec"]["rules"]:
            for p in rule["http"]["paths"]:
                svc = services[p["backend"]["service"]["name"]]
                assert p["backend"]["service"]["port"]["number"] in {x["port"] for x in svc["spec"]["ports"]}
    for svc in services.values():
        pods = [d for d in of_kind("Deployment")
                if svc["spec"]["selector"].items() <= d["spec"]["template"]["metadata"]["labels"].items()]
        assert len(pods) == 1, svc["metadata"]["name"]
        ports = {p["containerPort"] for c in pods[0]["spec"]["template"]["spec"]["containers"]
                 for p in c["ports"]}
        assert {p["targetPort"] for p in svc["spec"]["ports"]} <= ports


def test_ci_templates_set_images_that_exist():
    containers = {(d["metadata"]["name"], c["name"]) for d in of_kind("Deployment")
                  for c in d["spec"]["template"]["spec"]["containers"]}
    for f in ("release-pipeline.yml", "gitlab-ci.yml"):
        text = (ROOT / "deployment/ci-cd" / f).read_text(encoding="utf-8")
        found = re.findall(r"kubectl set image deployment/([\w-]+) ([\w-]+)=", text)
        assert found and set(found) <= containers, f
