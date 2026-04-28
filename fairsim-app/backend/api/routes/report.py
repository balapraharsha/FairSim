from fastapi import APIRouter, HTTPException
from core.ml_engine import SESSION_STORE

router = APIRouter()

@router.get("/{session_id}")
async def get_report(session_id: str):
    sess = SESSION_STORE.get(session_id)
    if not sess or not sess.get("pipe"):
        raise HTTPException(404, "No session data found.")
    return {
        "session_id": session_id,
        "rows": len(sess["df"]),
        "feat_cols": sess["feat_cols"],
        "fairscore": sess["fairscore"],
        "fix_score": sess.get("fix_score"),
        "fix_type": sess.get("fix_type"),
        "attack": sess.get("attack"),
        "shap": sess.get("shap"),
    }
