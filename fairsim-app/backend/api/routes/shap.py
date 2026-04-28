from fastapi import APIRouter, HTTPException
from core.ml_engine import SESSION_STORE
from core.shap_engine import compute_shap

router = APIRouter()

@router.get("/{session_id}")
async def get_shap(session_id: str):
    sess = SESSION_STORE.get(session_id)
    if not sess or not sess.get("pipe"):
        raise HTTPException(404, "Train a model first.")
    result = compute_shap(sess["pipe"], sess["df"], sess["feat_cols"])
    sess["shap"] = result
    return result
