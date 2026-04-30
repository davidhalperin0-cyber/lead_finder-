"""
Lead Finder — שרת FastAPI להרצת pipeline מ-Python ושמירה ב-Supabase.
Production:
  - GET /health  (ללא auth) בדיקת חיות + ENV בסיסי
  - /api/*       (JWT חובה)
"""
# reload trigger: 2026-04-29 nominatim bbox
from __future__ import annotations

import csv
import io
import os
import sys
from pathlib import Path
from typing import Any, Optional

import jwt
import requests
from openpyxl import Workbook
from fastapi import BackgroundTasks, Depends, FastAPI, Header, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from supabase import Client, create_client

# מקור הלוגיקה: תיקיית הפרויקט (הורה של api/)
ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from find_leads import (  # noqa: E402
    NoBusinessesFound,
    _load_env_file,
    lead_to_supabase_payload,
    run_pipeline,
)

_load_env_file()
# גם api/.env (הסודות אצל רוב המשתמשים כאן, לא בשורש הפרויקט)
try:
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).resolve().parent / ".env", override=True)
except ImportError:
    pass

app = FastAPI(title="Lead Finder API", version="1.0.0")

_cors = os.environ.get("CORS_ORIGINS", "").strip()
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _cors.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _sb() -> Client:
    url = os.environ.get("SUPABASE_URL", "").strip()
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if not url or not key:
        raise HTTPException(500, "חסר SUPABASE_URL או SUPABASE_SERVICE_ROLE_KEY (שרת בלבד)")
    return create_client(url, key)

def _storage_bucket() -> str:
    return (os.environ.get("SUPABASE_SCREENSHOTS_BUCKET") or "screenshots").strip()


def verify_user(authorization: Optional[str] = Header(None)) -> str:
    """Verify a Supabase user JWT by asking Supabase itself.

    This is the simplest, most reliable approach: instead of fetching JWKS and
    verifying signatures locally (which gets complicated with ES256/HS256/asymmetric
    keys), we just ask Supabase's /auth/v1/user endpoint with the token.
    If Supabase says it's valid - it's valid.
    """
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "נדרש Authorization: Bearer <access_token>")
    token = authorization.split(" ", 1)[1].strip()

    url = os.environ.get("SUPABASE_URL", "").strip().rstrip("/")
    if not url:
        raise HTTPException(500, "חסר SUPABASE_URL בשרת")

    api_key = (
        os.environ.get("SUPABASE_ANON_KEY")
        or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        or ""
    ).strip()
    if not api_key:
        raise HTTPException(500, "חסר SUPABASE_ANON_KEY או SUPABASE_SERVICE_ROLE_KEY בשרת")

    try:
        r = requests.get(
            f"{url}/auth/v1/user",
            headers={
                "Authorization": f"Bearer {token}",
                "apikey": api_key,
            },
            timeout=8,
        )
    except Exception as e:
        print(f"[AUTH] Network error contacting Supabase: {e}", flush=True)
        raise HTTPException(503, f"שגיאת רשת באימות מול Supabase: {e}")

    if r.status_code != 200:
        body_preview = (r.text or "")[:200]
        print(f"[AUTH] Supabase rejected token: {r.status_code} {body_preview}", flush=True)
        raise HTTPException(401, f"טוקן לא תקין (Supabase: {r.status_code})")

    try:
        user = r.json()
        user_id = user.get("id")
        if not user_id:
            raise ValueError("missing id in response")
    except Exception as e:
        print(f"[AUTH] Bad response from Supabase: {e}", flush=True)
        raise HTTPException(500, f"תגובה לא תקינה מ-Supabase: {e}")

    print(f"[AUTH] OK user={user_id}", flush=True)
    return str(user_id)


@app.get("/health")
def health_root():
    """Load balancer health check (no auth)."""
    ok = True
    missing = []
    for k in ("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_JWT_SECRET"):
        if not (os.environ.get(k) or "").strip():
            ok = False
            missing.append(k)
    # CORS is required for browser usage in prod
    if not (os.environ.get("CORS_ORIGINS") or "").strip():
        ok = False
        missing.append("CORS_ORIGINS")
    return {"ok": ok, "missing": missing}


class SearchBody(BaseModel):
    city: str = Field(..., min_length=1)
    business_type: str = Field(..., min_length=1)
    limit: int = Field(15, ge=1, le=80)
    use_ai: bool = True
    workers: int = Field(4, ge=1, le=10)
    screenshots: bool = False
    description: str = Field("", max_length=2000)
    only_without_website: bool = False


def _run_search_job(job_id: str, user_id: str, body: SearchBody) -> None:
    sb = _sb()
    try:
        sb.table("search_jobs").update(
            {
                "status": "running",
                "progress_current": 0,
                "progress_total": 0,
                "found_count": 0,
                "analyzed_count": 0,
                "saved_count": 0,
                "error_count": 0,
                "error_message": None,
            }
        ).eq("id", job_id).execute()

        def on_prog(i: int, n: int, lead) -> None:
            sb.table("search_jobs").update(
                {
                    "progress_current": i,
                    "progress_total": n,
                    "found_count": n,
                    "analyzed_count": i,
                }
            ).eq("id", job_id).execute()

        # שולפת דומיינים של לידים קיימים של המשתמש כדי למנוע כפילויות
        exclude_domains: set[str] = set()
        try:
            existing = sb.table("leads").select("website,final_url,site_key").eq("user_id", user_id).limit(5000).execute()
            from urllib.parse import urlparse as _urlparse
            for lr in (existing.data or []):
                for col in ("final_url", "website"):
                    u = (lr.get(col) or "").strip()
                    if not u:
                        continue
                    try:
                        d = _urlparse(u if "://" in u else f"http://{u}").netloc.lower()
                        if d.startswith("www."):
                            d = d[4:]
                        if d:
                            exclude_domains.add(d)
                    except Exception:
                        pass
                sk = (lr.get("site_key") or "").strip()
                if sk:
                    exclude_domains.add(sk)
            print(f"[SEARCH] excluding {len(exclude_domains)} existing domains from this user", flush=True)
        except Exception as e:
            print(f"[SEARCH] failed to load existing domains: {e}", flush=True)

        res = run_pipeline(
            city=body.city.strip(),
            business_type=body.business_type.strip(),
            limit=body.limit,
            workers=body.workers,
            export_html=False,
            use_ai=body.use_ai,
            screenshots=body.screenshots,
            on_progress=on_prog,
            quiet=True,
            skip_export=True,
            description=(body.description or "").strip(),
            exclude_domains=exclude_domains,
            only_without_website=body.only_without_website,
        )
        leads = res["leads"]
        payloads = []
        err_count = 0
        for L in leads:
            if getattr(L, "error", None):
                err_count += 1
            site_key = getattr(L, "site_key", "") or ""
            final_url = getattr(L, "final_url", "") or ""
            no_website = bool(getattr(L, "no_website", False))
            # מותר ללא final_url רק אם זה ליד "ללא אתר"
            if not site_key:
                continue
            if not final_url and not no_website:
                continue
            payloads.append(lead_to_supabase_payload(L, user_id=user_id, job_id=job_id))

        # upload screenshots (optional)
        bucket = _storage_bucket()
        def upload_if_any(p: dict) -> dict:
            path = (p.get("screenshot_path") or "").strip()
            if not path:
                return p
            fp = Path(path)
            if not fp.is_file():
                return p
            try:
                key = f"{user_id}/{job_id}/{fp.name}"
                content = fp.read_bytes()
                sb.storage.from_(bucket).upload(
                    key,
                    content,
                    {"content-type": "image/png", "upsert": "true"},
                )
                pub = sb.storage.from_(bucket).get_public_url(key)
                p["screenshot_url"] = pub
            except Exception:
                pass
            return p

        saved = 0
        batch = 60
        for i in range(0, len(payloads), batch):
            chunk = [upload_if_any(x) for x in payloads[i : i + batch]]
            sb.table("leads").upsert(chunk, on_conflict="user_id,site_key").execute()
            saved += len(chunk)
            sb.table("search_jobs").update({"saved_count": saved, "error_count": err_count}).eq("id", job_id).execute()
        sb.table("search_jobs").update(
            {
                "status": "completed",
                "progress_current": len(leads),
                "progress_total": len(leads),
                "found_count": len(leads),
                "analyzed_count": len(leads),
                "saved_count": saved,
                "error_count": err_count,
                "result_summary": res["stats"],
                "error_message": None,
            }
        ).eq("id", job_id).execute()
    except NoBusinessesFound as e:
        sb.table("search_jobs").update(
            {"status": "failed", "error_message": str(e)[:4000]}
        ).eq("id", job_id).execute()
    except Exception as e:
        sb.table("search_jobs").update(
            {"status": "failed", "error_message": str(e)[:4000]}
        ).eq("id", job_id).execute()


@app.get("/api/health")
def health():
    _ = _sb()
    return {
        "ok": True,
        "has_supabase": bool(os.environ.get("SUPABASE_URL")) and bool(os.environ.get("SUPABASE_SERVICE_ROLE_KEY")),
        "has_jwt_secret": bool(os.environ.get("SUPABASE_JWT_SECRET")),
    }


@app.post("/api/search-leads")
def start_search(
    body: SearchBody,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(verify_user),
):
    sb = _sb()
    row = {
        "user_id": user_id,
        "city": body.city.strip(),
        "business_type": body.business_type.strip(),
        "limit_n": body.limit,
        "use_ai": body.use_ai,
        "workers": body.workers,
        "screenshots": body.screenshots,
        "export_html": False,
        "status": "queued",
        "found_count": 0,
        "analyzed_count": 0,
        "saved_count": 0,
        "error_count": 0,
    }
    ins = sb.table("search_jobs").insert(row).execute()
    data = getattr(ins, "data", None) or []
    if not data:
        raise HTTPException(500, "לא נוצר job")
    job_id = data[0]["id"]
    background_tasks.add_task(_run_search_job, job_id, user_id, body)
    return {"job_id": job_id, "status": "queued"}


@app.get("/api/jobs/{job_id}")
def get_job(job_id: str, user_id: str = Depends(verify_user)):
    sb = _sb()
    r = sb.table("search_jobs").select("*").eq("id", job_id).eq("user_id", user_id).limit(1).execute()
    rows = getattr(r, "data", None) or []
    if not rows:
        raise HTTPException(404, "לא נמצא")
    return rows[0]


def _filtered_leads_query(sb: Client, user_id: str, **filters):
    q = sb.table("leads").select("*").eq("user_id", user_id)
    if filters.get("city"):
        q = q.ilike("search_city", f"%{filters['city']}%")
    if filters.get("business_type"):
        q = q.ilike("search_business_type", f"%{filters['business_type']}%")
    if filters.get("min_score") is not None:
        q = q.gte("score", int(filters["min_score"]))
    if filters.get("status"):
        q = q.eq("status", filters["status"])
    if filters.get("priority"):
        q = q.eq("priority_level", filters["priority"])
    return q.order("score", desc=True)


@app.get("/api/leads")
def list_leads(
    user_id: str = Depends(verify_user),
    city: Optional[str] = None,
    business_type: Optional[str] = None,
    min_score: Optional[int] = None,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    has_phone: Optional[bool] = None,
    has_whatsapp: Optional[bool] = None,
    limit: int = Query(200, le=500),
):
    sb = _sb()
    fetch_n = min(500, limit * 5 if (has_phone or has_whatsapp) else limit)
    q = _filtered_leads_query(
        sb,
        user_id,
        city=city,
        business_type=business_type,
        min_score=min_score,
        status=status,
        priority=priority,
    )
    r = q.limit(fetch_n).execute()
    rows = getattr(r, "data", None) or []
    if has_phone:
        rows = [x for x in rows if (x.get("phone") or "").strip()]
    if has_whatsapp:
        rows = [x for x in rows if (x.get("whatsapp") or "").strip()]
    return rows[:limit]


@app.get("/api/leads/{lead_id}")
def get_lead(lead_id: str, user_id: str = Depends(verify_user)):
    sb = _sb()
    r = (
        sb.table("leads")
        .select("*")
        .eq("id", lead_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    rows = getattr(r, "data", None) or []
    if not rows:
        raise HTTPException(404, "לא נמצא")
    return rows[0]


class LeadPatch(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None
    follow_up_date: Optional[str] = None


@app.patch("/api/leads/{lead_id}")
def patch_lead(lead_id: str, body: LeadPatch, user_id: str = Depends(verify_user)):
    sb = _sb()
    existing = (
        sb.table("leads")
        .select("id")
        .eq("id", lead_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    if not (getattr(existing, "data", None) or []):
        raise HTTPException(404, "לא נמצא")
    upd: dict[str, Any] = {}
    if body.status is not None:
        upd["status"] = body.status
    if body.notes is not None:
        upd["notes"] = body.notes
    if body.follow_up_date is not None:
        upd["follow_up_date"] = body.follow_up_date or None
    if not upd:
        return get_lead(lead_id, user_id)
    sb.table("leads").update(upd).eq("id", lead_id).eq("user_id", user_id).execute()
    return get_lead(lead_id, user_id)


@app.post("/api/leads/{lead_id}/quick-status")
def quick_status(lead_id: str, action: str = Query(...), user_id: str = Depends(verify_user)):
    if action == "contacted":
        return patch_lead(lead_id, LeadPatch(status="contacted"), user_id)
    if action == "hot":
        return patch_lead(lead_id, LeadPatch(status="interested"), user_id)
    raise HTTPException(400, "action לא חוקי — contacted או hot")


@app.get("/api/export/csv")
def export_csv(
    user_id: str = Depends(verify_user),
    city: Optional[str] = None,
    business_type: Optional[str] = None,
    min_score: Optional[int] = None,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    has_phone: Optional[bool] = None,
    has_whatsapp: Optional[bool] = None,
):
    sb = _sb()
    q = _filtered_leads_query(
        sb,
        user_id,
        city=city,
        business_type=business_type,
        min_score=min_score,
        status=status,
        priority=priority,
    )
    r = q.limit(2000).execute()
    rows = getattr(r, "data", None) or []
    if has_phone:
        rows = [x for x in rows if (x.get("phone") or "").strip()]
    if has_whatsapp:
        rows = [x for x in rows if (x.get("whatsapp") or "").strip()]
    if not rows:
        return Response("אין נתונים", media_type="text/plain; charset=utf-8")

    flat_keys = [
        "business_name",
        "final_url",
        "phone",
        "whatsapp",
        "score",
        "grade",
        "priority_level",
        "strongest_problem",
        "opening_line",
        "status",
        "notes",
        "follow_up_date",
        "search_city",
        "search_business_type",
    ]
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=flat_keys, extrasaction="ignore")
    w.writeheader()
    for row in rows:
        w.writerow({k: row.get(k, "") for k in flat_keys})
    return Response(
        "\ufeff" + buf.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="leads.csv"'},
    )


@app.get("/api/export/xlsx")
def export_xlsx(
    user_id: str = Depends(verify_user),
    city: Optional[str] = None,
    business_type: Optional[str] = None,
    min_score: Optional[int] = None,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    has_phone: Optional[bool] = None,
    has_whatsapp: Optional[bool] = None,
):
    sb = _sb()
    q = _filtered_leads_query(
        sb,
        user_id,
        city=city,
        business_type=business_type,
        min_score=min_score,
        status=status,
        priority=priority,
    )
    r = q.limit(2000).execute()
    rows = getattr(r, "data", None) or []
    if has_phone:
        rows = [x for x in rows if (x.get("phone") or "").strip()]
    if has_whatsapp:
        rows = [x for x in rows if (x.get("whatsapp") or "").strip()]
    if not rows:
        return Response("אין נתונים", media_type="text/plain; charset=utf-8")

    cols = [
        ("business_name", "name"),
        ("final_url", "website"),
        ("phone", "phone"),
        ("whatsapp", "whatsapp"),
        ("score", "score"),
        ("grade", "grade"),
        ("priority_level", "priority"),
        ("strongest_problem", "strongest_problem"),
        ("opening_line", "opening_line"),
        ("status", "status"),
        ("notes", "notes"),
        ("follow_up_date", "follow_up_date"),
        ("search_city", "city"),
        ("search_business_type", "type"),
    ]

    wb = Workbook()
    ws = wb.active
    ws.title = "leads"
    ws.append([label for _, label in cols])
    for row in rows:
        ws.append([row.get(key, "") for key, _ in cols])

    out = io.BytesIO()
    wb.save(out)
    out.seek(0)
    return Response(
        out.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="leads.xlsx"'},
    )

