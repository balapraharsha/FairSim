from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from core.ml_engine import SESSION_STORE, compute_fairscore, predict_single
from core.shap_engine import compute_shap, shap_after_fix
from core.fix_engine import apply_fix
from core.eli5_engine import get_eli5

# ── SHAP ──────────────────────────────────────────────────────────────────────
shap_router = APIRouter()

@shap_router.get("/{session_id}")
async def get_shap(session_id: str):
    sess = SESSION_STORE.get(session_id)
    if not sess or not sess.get("pipe"):
        raise HTTPException(404, "Train a model first.")
    result = compute_shap(sess["pipe"], sess["df"], sess["feat_cols"])
    sess["shap"] = result
    return result

# ── Fix ───────────────────────────────────────────────────────────────────────
fix_router = APIRouter()

class FixRequest(BaseModel):
    session_id: str
    fix_type: str   # rebalancing | neutralization | constraint
    model_type: str = "random_forest"

@fix_router.post("/apply")
async def apply_fix_route(req: FixRequest):
    sess = SESSION_STORE.get(req.session_id)
    if not sess or not sess.get("pipe"):
        raise HTTPException(404, "Train a model first.")

    before_fs  = sess["fairscore"]
    pipe, acc, after_fs = apply_fix(sess["df"], req.fix_type, sess["feat_cols"], req.model_type)
    sess["fix_pipe"]  = pipe
    sess["fix_score"] = after_fs
    sess["fix_type"]  = req.fix_type

    shap_before = sess.get("shap")
    shap_after  = shap_after_fix(shap_before, req.fix_type) if shap_before else None

    return {
        "fix_type":    req.fix_type,
        "accuracy":    acc,
        "before":      before_fs,
        "after":       after_fs,
        "shap_before": shap_before["ranked"] if shap_before else None,
        "shap_after":  shap_after,
    }

# ── ELI5 ──────────────────────────────────────────────────────────────────────
eli5_router = APIRouter()

class ELI5Request(BaseModel):
    topic: str
    context: dict = {}

@eli5_router.post("/explain")
async def explain(req: ELI5Request):
    return {"topic": req.topic, "explanation": get_eli5(req.topic, req.context)}

# ── What-If ───────────────────────────────────────────────────────────────────
whatif_router = APIRouter()

class WhatIfRequest(BaseModel):
    session_id: str
    profile: dict
    use_fixed: bool = False

@whatif_router.post("/predict")
async def whatif_predict(req: WhatIfRequest):
    sess = SESSION_STORE.get(req.session_id)
    if not sess or not sess.get("pipe"):
        raise HTTPException(404, "Train a model first.")
    pipe = sess["fix_pipe"] if req.use_fixed and sess.get("fix_pipe") else sess["pipe"]
    pred, prob = predict_single(pipe, req.profile, sess["feat_cols"])
    # Also predict with original pipe for comparison
    orig_pred, orig_prob = predict_single(sess["pipe"], req.profile, sess["feat_cols"])
    return {
        "prediction":   pred,
        "probability":  round(prob * 100, 1),
        "label":        "Selected" if pred == 1 else "Rejected",
        "orig_pred":    orig_pred,
        "orig_prob":    round(orig_prob * 100, 1),
        "orig_label":   "Selected" if orig_pred == 1 else "Rejected",
    }

# ── Report ────────────────────────────────────────────────────────────────────
report_router = APIRouter()

@report_router.get("/{session_id}")
async def get_report(session_id: str):
    sess = SESSION_STORE.get(session_id)
    if not sess or not sess.get("pipe"):
        raise HTTPException(404, "No data for this session.")
    return {
        "session_id":    session_id,
        "rows":          len(sess["df"]),
        "feat_cols":     sess["feat_cols"],
        "fairscore":     sess["fairscore"],
        "fix_score":     sess.get("fix_score"),
        "fix_type":      sess.get("fix_type"),
        "attack":        sess.get("attack"),
        "shap":          sess.get("shap"),
    }
