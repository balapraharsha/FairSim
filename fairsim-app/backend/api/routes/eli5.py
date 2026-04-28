from fastapi import APIRouter
from pydantic import BaseModel
from core.eli5_engine import get_eli5

router = APIRouter()

class ELI5Req(BaseModel):
    topic: str
    context: dict = {}

@router.post("/explain")
async def explain(req: ELI5Req):
    return {"topic": req.topic, "explanation": get_eli5(req.topic, req.context)}
