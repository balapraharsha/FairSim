from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from core.ml_engine import SESSION_STORE, predict_single

router = APIRouter()

class WhatIfReq(BaseModel):
    session_id: str
    profile: dict
    use_fixed: bool = False

@router.post("/predict")
async def predict(req: WhatIfReq):
    sess = SESSION_STORE.get(req.session_id)
    if not sess or not sess.get("pipe"):
        raise HTTPException(404, "Train a model first.")
    pipe = sess["fix_pipe"] if req.use_fixed and sess.get("fix_pipe") else sess["pipe"]
    pred, prob = predict_single(pipe, req.profile, sess["feat_cols"])
    orig_pred, orig_prob = predict_single(sess["pipe"], req.profile, sess["feat_cols"])
    return {
        "prediction": pred, "probability": round(prob*100,1),
        "label": "Selected" if pred==1 else "Rejected",
        "orig_pred": orig_pred, "orig_prob": round(orig_prob*100,1),
        "orig_label": "Selected" if orig_pred==1 else "Rejected",
    }
