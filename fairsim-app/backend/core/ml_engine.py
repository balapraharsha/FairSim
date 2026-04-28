import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.metrics import accuracy_score
from sklearn.model_selection import train_test_split
import joblib, io, base64, traceback

CATEGORICAL_COLS = ["gender", "city_tier", "school_type", "income_bracket", "education_level"]
NUMERIC_COLS     = ["years_experience"]
TARGET_COL       = "hired"

PROTECTED_ATTRIBUTES = {
    "gender":         {"privileged": "male",    "unprivileged": "female"},
    "city_tier":      {"privileged": "1",        "unprivileged": "3"},
    "school_type":    {"privileged": "private",  "unprivileged": "government"},
    "income_bracket": {"privileged": "high",     "unprivileged": "low"},
}

SESSION_STORE: dict = {}

MAX_CARDINALITY   = 20    # drop categorical cols with more unique values than this
MAX_CAT_COLS      = 15    # cap total categorical columns
MAX_ROWS_TRAINING = 10000 # subsample large datasets for training speed


def preprocess(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df.columns = [str(c).strip().lower().replace(" ","_").replace("-","_") for c in df.columns]
    if TARGET_COL in df.columns:
        try:
            df[TARGET_COL] = pd.to_numeric(df[TARGET_COL], errors="coerce").fillna(0).astype(int)
        except Exception:
            df[TARGET_COL] = 0
    for col in CATEGORICAL_COLS:
        if col in df.columns:
            df[col] = df[col].astype(str).str.strip().str.lower().fillna("unknown")
    if "city_tier" in df.columns:
        df["city_tier"] = df["city_tier"].astype(str).str.strip()
    for col in NUMERIC_COLS:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)
    return df


def _smart_feat_cols(df: pd.DataFrame) -> tuple[list, list]:
    """
    Intelligently choose feature columns:
    - Drop ID-like, URL, free-text columns (high cardinality)
    - Keep numeric cols
    - Keep low-cardinality categorical cols (max MAX_CARDINALITY unique values)
    - Hard cap at MAX_CAT_COLS categorical columns (take most informative first)
    """
    skip_patterns = ["id", "url", "link", "title", "text", "article",
                     "body", "content", "description", "name", "date",
                     "time", "timestamp", "uuid", "email", "phone"]

    def is_skip(col: str) -> bool:
        col_l = col.lower()
        for p in skip_patterns:
            if p in col_l:
                return True
        return False

    cat_cols, num_cols = [], []
    for col in df.columns:
        if col == TARGET_COL:
            continue
        if is_skip(col):
            continue
        if df[col].dtype == object:
            n_unique = df[col].nunique()
            if n_unique <= MAX_CARDINALITY:
                cat_cols.append((col, n_unique))
        else:
            try:
                pd.to_numeric(df[col], errors="raise")
                num_cols.append(col)
            except Exception:
                pass

    # Sort cat cols by cardinality (most discriminative first) and cap
    cat_cols.sort(key=lambda x: x[1], reverse=True)
    cat_cols = [c for c, _ in cat_cols[:MAX_CAT_COLS]]

    return cat_cols, num_cols


def build_pipeline(model_type="random_forest", cat_cols=None, num_cols=None):
    cat_cols = cat_cols or []
    num_cols = num_cols or []
    transformers = []
    if cat_cols:
        transformers.append(("cat", OneHotEncoder(
            handle_unknown="ignore", sparse_output=False, max_categories=15
        ), cat_cols))
    if num_cols:
        transformers.append(("num", StandardScaler(), num_cols))
    if not transformers:
        raise ValueError("No usable feature columns found.")
    pre = ColumnTransformer(transformers, remainder="drop")
    clf = (RandomForestClassifier(n_estimators=100, random_state=42, class_weight="balanced", n_jobs=-1)
           if model_type == "random_forest"
           else LogisticRegression(max_iter=500, random_state=42, class_weight="balanced"))
    return Pipeline([("pre", pre), ("clf", clf)])


def train(df: pd.DataFrame, model_type="random_forest"):
    df = preprocess(df)
    cat_cols, num_cols = _smart_feat_cols(df)

    if not cat_cols and not num_cols:
        raise ValueError("No usable feature columns. Try a different dataset.")

    feat_cols = cat_cols + num_cols
    X = df[feat_cols].copy()
    y = df[TARGET_COL]

    # Subsample for large datasets
    if len(X) > MAX_ROWS_TRAINING:
        idx = np.random.RandomState(42).choice(len(X), MAX_ROWS_TRAINING, replace=False)
        X, y = X.iloc[idx], y.iloc[idx]

    X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.2, random_state=42)
    pipe = build_pipeline(model_type, cat_cols, num_cols)
    pipe.fit(X_tr, y_tr)
    acc = round(accuracy_score(y_te, pipe.predict(X_te)) * 100, 1)
    return pipe, acc, feat_cols


def _infer_protected(df: pd.DataFrame, feat_cols: list) -> dict:
    """
    Auto-detect protected attribute columns from any dataset.
    Returns a dict like PROTECTED_ATTRIBUTES.
    """
    protected = {}
    # Always use hardcoded ones if present
    for attr, vals in PROTECTED_ATTRIBUTES.items():
        if attr in df.columns and attr in feat_cols:
            protected[attr] = vals

    # For custom datasets: look for binary categorical columns
    if not protected:
        for col in feat_cols:
            if col not in df.columns:
                continue
            if df[col].dtype != object:
                continue
            unique_vals = df[col].dropna().unique()
            if len(unique_vals) == 2:
                v0, v1 = str(unique_vals[0]).lower(), str(unique_vals[1]).lower()
                # Pick the "less common" as unprivileged
                c0 = (df[col].astype(str).str.lower() == v0).sum()
                c1 = (df[col].astype(str).str.lower() == v1).sum()
                priv, unpriv = (v0, v1) if c0 >= c1 else (v1, v0)
                protected[col] = {"privileged": priv, "unprivileged": unpriv}
            if len(protected) >= 4:
                break

    return protected


def compute_fairscore(df: pd.DataFrame, pipe, feat_cols: list) -> dict:
    df = preprocess(df)
    valid = [c for c in feat_cols if c in df.columns]
    X  = df[valid].copy()
    y  = df[TARGET_COL].values

    # Subsample for large datasets
    if len(X) > 5000:
        idx = np.random.RandomState(42).choice(len(X), 5000, replace=False)
        X, y = X.iloc[idx], y[idx]

    try:
        pr = pipe.predict(X)
    except Exception:
        return {"composite":50,"dp":50,"eo":50,"cf":50,"risk":"Unknown","attr_scores":{}}

    overall      = pr.mean()
    dp_gaps, eo_gaps, cf_flips = [], [], []
    attr_scores  = {}
    protected    = _infer_protected(df, feat_cols)

    for attr, vals in protected.items():
        if attr not in df.columns:
            continue
        col_vals = df[attr].astype(str).str.lower()
        priv_m   = col_vals == vals["privileged"]
        unpriv_m = col_vals == vals["unprivileged"]
        if priv_m.sum() < 2 or unpriv_m.sum() < 2:
            continue

        # Align with subsample
        pi = np.where(priv_m.values)[0]
        ui = np.where(unpriv_m.values)[0]
        pi = pi[pi < len(pr)]; ui = ui[ui < len(pr)]
        if not len(pi) or not len(ui):
            continue

        priv_r   = pr[pi].mean()
        unpriv_r = pr[ui].mean()
        gap      = abs(priv_r - unpriv_r)
        dp_gaps.append(gap)

        tp_priv   = (y[:len(pr)] == 1) & priv_m.values[:len(pr)]
        tp_unpriv = (y[:len(pr)] == 1) & unpriv_m.values[:len(pr)]
        if tp_priv.sum() > 0 and tp_unpriv.sum() > 0:
            eo_gaps.append(abs(pr[tp_priv].mean() - pr[tp_unpriv].mean()))

        try:
            samp = df.sample(min(200, len(df)), random_state=42)
            flip = samp.copy()
            flip[attr] = flip[attr].apply(
                lambda v: vals["unprivileged"] if str(v).lower()==vals["privileged"] else vals["privileged"]
            )
            orig_p = pipe.predict(samp[valid])
            flip_p = pipe.predict(flip[valid])
            cf_flips.append((orig_p != flip_p).mean())
        except Exception:
            pass

        attr_scores[attr] = {
            "priv_rate":   round(priv_r * 100, 1),
            "unpriv_rate": round(unpriv_r * 100, 1),
            "gap":         round(gap * 100, 1),
            "score":       max(0, 100 - int(gap * 220)),
        }

    dp  = max(0, 100 - int(np.mean(dp_gaps)  * 220)) if dp_gaps  else 60
    eo  = max(0, 100 - int(np.mean(eo_gaps)  * 220)) if eo_gaps  else 60
    cf  = max(0, 100 - int(np.mean(cf_flips) * 170)) if cf_flips else 60
    composite = int(dp * 0.4 + eo * 0.35 + cf * 0.25)

    return {
        "composite":   composite,
        "dp": dp, "eo": eo, "cf": cf,
        "risk": "High Risk" if composite < 50 else "Medium Risk" if composite < 75 else "Low Risk",
        "attr_scores": attr_scores,
        "protected_used": list(protected.keys()),
    }


def predict_single(pipe, profile: dict, feat_cols: list):
    row = pd.DataFrame([{c: profile.get(c, "") for c in feat_cols}])
    prob = pipe.predict_proba(row)[0]
    pred = pipe.predict(row)[0]
    return int(pred), float(prob[1])


def _prep_X(df: pd.DataFrame, feat_cols: list) -> pd.DataFrame:
    valid = [c for c in feat_cols if c in df.columns]
    return df[valid].copy()


def serialize_model(pipe) -> str:
    buf = io.BytesIO()
    joblib.dump(pipe, buf)
    return base64.b64encode(buf.getvalue()).decode()

def deserialize_model(s: str):
    return joblib.load(io.BytesIO(base64.b64decode(s)))