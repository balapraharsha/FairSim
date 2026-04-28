from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from core.ml_engine import SESSION_STORE
from core.attack_engine import counterfactual_attack, intersection_attack, adversarial_search, compute_heatmap

router = APIRouter()

class AttackRequest(BaseModel):
    session_id: str
    mode: str  # "counterfactual" | "intersection" | "adversarial"

@router.post("/run")
async def run_attack(req: AttackRequest):
    sess = SESSION_STORE.get(req.session_id)
    if not sess or sess.get("pipe") is None:
        raise HTTPException(404, "Train a model first.")
    df, pipe, feat_cols = sess["df"], sess["pipe"], sess["feat_cols"]

    if req.mode == "counterfactual":
        result = counterfactual_attack(df, pipe, feat_cols)
    elif req.mode == "intersection":
        result = intersection_attack(df, pipe, feat_cols)
    elif req.mode == "adversarial":
        result = adversarial_search(df, pipe, feat_cols)
    else:
        raise HTTPException(400, "mode must be counterfactual | intersection | adversarial")

    sess["attack"] = {"mode": req.mode, "result": result}
    return {"mode": req.mode, "result": result}

@router.get("/heatmap/{session_id}")
async def get_heatmap(session_id: str):
    sess = SESSION_STORE.get(session_id)
    if not sess or sess.get("pipe") is None:
        raise HTTPException(404, "Train a model first.")
    return compute_heatmap(sess["df"], sess["pipe"], sess["feat_cols"])
