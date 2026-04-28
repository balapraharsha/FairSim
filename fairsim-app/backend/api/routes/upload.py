from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
import pandas as pd, numpy as np, io, uuid, os, traceback

try:
    import chardet
    CHARDET = True
except ImportError:
    CHARDET = False

router = APIRouter()

from core.ml_engine import (train, compute_fairscore, SESSION_STORE,
                              serialize_model, CATEGORICAL_COLS,
                              NUMERIC_COLS, TARGET_COL)

# Columns that could be the binary target in any dataset
TARGET_ALIASES = [
    "hired", "label", "target", "outcome", "result", "selected",
    "label_bias", "bias", "approved", "accepted", "passed",
    "class", "y", "output", "decision", "is_hired", "is_selected",
]

def _find_sample():
    candidates = [
        os.path.join(os.path.dirname(__file__), "..", "..", "data", "sample_hiring.csv"),
        os.path.join(os.path.dirname(__file__), "..", "..", "..", "data", "sample_hiring.csv"),
        "/app/data/sample_hiring.csv",
    ]
    for p in candidates:
        r = os.path.abspath(p)
        if os.path.exists(r):
            return r
    return os.path.abspath(candidates[0])

SAMPLE_PATH = _find_sample()

@router.get("/sample")
async def download_sample():
    if not os.path.exists(SAMPLE_PATH):
        raise HTTPException(404, "Sample file not found.")
    return FileResponse(SAMPLE_PATH, media_type="text/csv", filename="sample_hiring.csv")


def _read_csv_robust(content: bytes) -> pd.DataFrame:
    # Strip BOM
    if content.startswith(b'\xef\xbb\xbf'):
        content = content[3:]

    # Detect encoding
    enc = "utf-8"
    if CHARDET:
        det = chardet.detect(content)
        enc = det.get("encoding") or "utf-8"

    # Decode
    text = None
    for e in [enc, "utf-8", "latin-1", "cp1252"]:
        try:
            text = content.decode(e)
            break
        except Exception:
            continue
    if text is None:
        raise ValueError("Could not decode the file. Please save it as UTF-8.")

    # Normalise line endings
    text = text.replace('\r\n', '\n').replace('\r', '\n')

    # Try separators
    for sep in [',', ';', '\t', '|']:
        try:
            df = pd.read_csv(io.StringIO(text), sep=sep, skipinitialspace=True)
            if len(df.columns) >= 2 and len(df) >= 5:
                return df
        except Exception:
            continue

    raise ValueError(
        "Could not parse the CSV file. Please make sure:\n"
        "• It is comma-separated (.csv)\n"
        "• It has a header row\n"
        "• It was saved as CSV, not Excel (.xlsx)"
    )


def _find_target_col(cols: list) -> str | None:
    """Find the binary target column from a list of normalised column names."""
    # Exact match first
    for alias in TARGET_ALIASES:
        if alias in cols:
            return alias
    # Partial match (e.g. "is_hired_flag")
    for col in cols:
        for alias in TARGET_ALIASES:
            if alias in col:
                return col
    # Last resort: find a column that looks binary (only 0/1 or 2 unique values)
    return None


def _infer_binary_col(df: pd.DataFrame, cols: list) -> str | None:
    """Find a column that has only 2 unique non-null values that look binary."""
    for col in cols:
        unique = df[col].dropna().unique()
        if len(unique) == 2:
            vals = set(str(v).strip().lower() for v in unique)
            binary_sets = [{'0','1'},{'yes','no'},{'true','false'},
                           {'selected','rejected'},{'hired','not hired'},
                           {'positive','negative'},{'0.0','1.0'}]
            if vals in binary_sets or vals == {'0','1'}:
                return col
    return None


@router.post("/csv")
async def upload_csv(file: UploadFile = File(...)):
    try:
        content = await file.read()
        if not content:
            raise HTTPException(400, "Uploaded file is empty.")

        try:
            df = _read_csv_robust(content)
        except ValueError as ve:
            raise HTTPException(400, str(ve))

        # Normalise column names
        df.columns = [str(c).strip().lower().replace(" ", "_").replace("-","_") for c in df.columns]
        cols = df.columns.tolist()

        # Find target column
        target_col = _find_target_col(cols)
        if target_col is None:
            target_col = _infer_binary_col(df, cols)
        if target_col is None:
            raise HTTPException(400,
                f"Could not find a target column. Your columns: {cols}.\n"
                f"Please add a column named 'hired' (1 = selected, 0 = rejected), "
                f"or rename your target column to one of: {TARGET_ALIASES[:8]}.")

        # Rename to standard name
        if target_col != TARGET_COL:
            df = df.rename(columns={target_col: TARGET_COL})

        # Convert target to binary int
        def to_binary(v):
            if pd.isna(v): return 0
            s = str(v).strip().lower()
            if s in ('1','yes','true','selected','hired','y','positive','1.0'): return 1
            if s in ('0','no','false','rejected','not hired','n','negative','0.0'): return 0
            try: return 1 if float(s) >= 0.5 else 0
            except: return 0

        df[TARGET_COL] = df[TARGET_COL].apply(to_binary).astype(int)

        # Normalise known categorical cols
        for col in CATEGORICAL_COLS:
            if col in df.columns:
                df[col] = df[col].astype(str).str.strip().str.lower().replace('nan','unknown')
        if "city_tier" in df.columns:
            df["city_tier"] = df["city_tier"].astype(str).str.strip()

        # Normalise known numeric cols
        for col in NUMERIC_COLS:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

        # For unknown datasets: auto-encode all remaining object cols as categorical
        # and numeric cols stay as-is
        remaining_cols = [c for c in df.columns if c != TARGET_COL]
        auto_cat  = [c for c in remaining_cols if df[c].dtype == object and c not in CATEGORICAL_COLS]
        auto_num  = [c for c in remaining_cols if df[c].dtype != object and c not in NUMERIC_COLS]

        for col in auto_cat:
            df[col] = df[col].astype(str).str.strip().str.lower()
        for col in auto_num:
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

        df = df.dropna(subset=[TARGET_COL]).reset_index(drop=True)

        if len(df) < 10:
            raise HTTPException(400, f"Need at least 10 rows. Got {len(df)}.")

        # Build feat_cols: known cols first, then any remaining non-target cols
        known_feat_cols = [c for c in CATEGORICAL_COLS + NUMERIC_COLS if c in df.columns]
        extra_feat_cols = [c for c in remaining_cols
                           if c not in known_feat_cols and c != TARGET_COL]
        feat_cols = known_feat_cols + extra_feat_cols

        if not feat_cols:
            raise HTTPException(400, f"No feature columns found. Got columns: {list(df.columns)}")

        session_id = str(uuid.uuid4())
        SESSION_STORE[session_id] = {
            "df": df, "pipe": None, "feat_cols": None,
            "fairscore": None, "fix_pipe": None, "fix_score": None,
            "fix_type": None, "shap": None, "attack": None,
            "original_target": target_col,
        }

        preview = df.head(5).copy()
        for c in preview.select_dtypes(include=[np.floating]).columns:
            preview[c] = preview[c].round(2)

        return {
            "session_id":      session_id,
            "rows":            len(df),
            "columns":         df.columns.tolist(),
            "feat_cols":       feat_cols,
            "target_col_used": target_col,
            "target_dist":     {str(k): int(v) for k, v in df[TARGET_COL].value_counts().items()},
            "hire_rate":       round(df[TARGET_COL].mean() * 100, 1),
            "preview":         preview.fillna("").astype(str).to_dict(orient="records"),
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"[upload/csv ERROR]\n{traceback.format_exc()}")
        raise HTTPException(400, f"Upload failed: {str(e)}")


class TrainRequest(BaseModel):
    model_config = {"protected_namespaces": ()}
    session_id: str
    model_type: str = "random_forest"

@router.post("/train")
async def train_model_route(req: TrainRequest):
    sess = SESSION_STORE.get(req.session_id)
    if not sess:
        raise HTTPException(404, "Session not found. Upload a dataset first.")
    try:
        pipe, acc, feat_cols = train(sess["df"], req.model_type)
        fs = compute_fairscore(sess["df"], pipe, feat_cols)
        sess.update({"pipe": pipe, "feat_cols": feat_cols, "fairscore": fs,
                     "model_str": serialize_model(pipe)})
        return {"accuracy": acc, "fairscore": fs, "feat_cols": feat_cols, "model_type": req.model_type}
    except Exception as e:
        print(f"[upload/train ERROR]\n{traceback.format_exc()}")
        raise HTTPException(500, f"Training failed: {str(e)}")