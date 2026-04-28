from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from core.ml_engine import SESSION_STORE
from core.fix_engine import apply_fix
from core.shap_engine import shap_after_fix

router = APIRouter()

class FixRequest(BaseModel):
    session_id: str
    fix_type: str
    model_type: str = "random_forest"

@router.post("/apply")
async def apply_fix_route(req: FixRequest):
    sess = SESSION_STORE.get(req.session_id)
    if not sess or not sess.get("pipe"):
        raise HTTPException(404, "Train a model first.")
    before_fs = sess["fairscore"]
    pipe, acc, after_fs = apply_fix(sess["df"], req.fix_type, sess["feat_cols"], req.model_type)
    sess["fix_pipe"] = pipe
    sess["fix_score"] = after_fs
    sess["fix_type"] = req.fix_type
    shap_b = sess.get("shap")
    return {
        "fix_type": req.fix_type,
        "accuracy": acc,
        "before": before_fs,
        "after": after_fs,
        "shap_before": shap_b["ranked"] if shap_b else None,
        "shap_after": shap_after_fix(shap_b, req.fix_type) if shap_b else None,
    }
