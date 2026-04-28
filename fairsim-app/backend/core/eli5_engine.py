import os
from dotenv import load_dotenv
load_dotenv()

FALLBACKS = {
    "what_is_bias": "Imagine a teacher who gives lower marks to students just because they're girls — not because their answers are worse. That's bias. Our AI model learned from old data where people from villages were hired less often. So now it repeats that mistake, even when they're equally qualified. FairSim catches this before it harms real people.",
    "what_found": "We discovered the AI treats certain groups very unfairly. The most affected group was approved only a fraction of the time compared to everyone else. That means qualified people are being rejected just because of their background. This is exactly the hidden discrimination FairSim is designed to find.",
    "how_fixed": "We fixed the bias by teaching the AI to treat all groups more equally — like adjusting a tilted scale. The fairness score improved dramatically. The model still makes accurate predictions; it just stopped penalising people for things that shouldn't matter, like which school they attended.",
    "intersection": "Intersection bias is like a storm. Rain alone is fine. Wind alone is fine. But rain + wind + cold together = dangerous blizzard. Same with bias: being female alone is a small disadvantage. Being from a village is another. Going to a government school is another. But all three together means the AI almost always says no. FairSim specifically hunts for these invisible storms.",
    "shap": "SHAP tells us exactly which features caused biased decisions — like a receipt showing exactly what you were charged for. The top features driving bias are income, location, and school type. After the fix, these features have much less influence, making decisions fairer without losing accuracy.",
}

def get_eli5(topic: str, context: dict = None) -> str:
    api_key = os.getenv("GEMINI_API_KEY", "")
    if not api_key or api_key == "your_gemini_api_key_here":
        return _inject_context(FALLBACKS.get(topic, FALLBACKS["what_is_bias"]), context)
    try:
        import google.generativeai as genai
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-1.5-flash")
        ctx = context or {}
        prompts = {
            "what_is_bias": "Explain AI bias to a 10-year-old in 4 sentences. Use a relatable analogy. Be warm and simple.",
            "what_found": f"An AI bias test found: worst group '{ctx.get('worst_group','rural women')}' had {ctx.get('worst_rate','8')}% approval vs {ctx.get('avg_rate','65')}% average. Explain this to a non-technical HR manager in 4 sentences.",
            "how_fixed": f"We fixed AI bias using {ctx.get('fix_type','data rebalancing')}. FairScore went from {ctx.get('before',38)} to {ctx.get('after',81)}. Explain what happened and why it matters in 4 sentences, no jargon.",
            "intersection": "Explain intersection bias using a storm analogy: rain+wind+cold = blizzard. Apply to female+village+government school = AI disadvantage. 4 sentences, simple language.",
            "shap": f"Explain SHAP values simply. Top bias features: {ctx.get('top_features','income, location, school type')}. What does this mean for fairness? 4 sentences.",
        }
        resp = model.generate_content(prompts.get(topic, prompts["what_is_bias"]))
        return resp.text.strip()
    except Exception:
        return _inject_context(FALLBACKS.get(topic, FALLBACKS["what_is_bias"]), context)

def _inject_context(text: str, ctx: dict) -> str:
    if not ctx:
        return text
    for k, v in ctx.items():
        text = text.replace(f"{{{k}}}", str(v))
    return text
