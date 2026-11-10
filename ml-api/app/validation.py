"""Validation of uploaded training CSVs against the feature schema."""

from __future__ import annotations

import io
from dataclasses import dataclass, field

import numpy as np
import pandas as pd

from .features import Schema

MAX_REPORTED_ERRORS = 25


class DatasetValidationError(Exception):
    def __init__(self, errors: list[str]):
        super().__init__("; ".join(errors))
        self.errors = errors


@dataclass
class ValidatedDataset:
    frame: pd.DataFrame
    """Only the used feature columns plus the target, all numeric."""
    features: list[str]
    target: str
    ignored_columns: list[str] = field(default_factory=list)

    @property
    def rows(self) -> int:
        return len(self.frame)


def _check_range(errors: list[str], col: str, values: pd.Series, lo: float | None, hi: float | None) -> None:
    bad = pd.Series(False, index=values.index)
    if lo is not None:
        bad |= values < lo
    if hi is not None:
        bad |= values > hi
    if bad.any():
        rows = (values.index[bad] + 2).tolist()  # +2: header line and 1-based numbering
        bounds = f"[{lo if lo is not None else '-inf'}, {hi if hi is not None else 'inf'}]"
        errors.append(f"column {col!r}: values outside {bounds} on line(s) {_fmt_rows(rows)}")


def _fmt_rows(rows: list[int], limit: int = 10) -> str:
    shown = ", ".join(map(str, rows[:limit]))
    return shown + (f" (+{len(rows) - limit} more)" if len(rows) > limit else "")


def _lines(index: pd.Index, mask: pd.Series) -> str:
    """CSV line numbers for the masked rows (+2: header line and 1-based numbering)."""
    return _fmt_rows((index[mask] + 2).tolist())


def validate_training_csv(content: bytes, schema: Schema, min_rows: int) -> ValidatedDataset:
    """Parse and validate a training CSV. Raises DatasetValidationError with every problem found."""
    if not content.strip():
        raise DatasetValidationError(["file is empty"])
    try:
        # utf-8-sig strips the byte-order mark that Excel-exported CSVs start with.
        df = pd.read_csv(
            io.BytesIO(content), encoding="utf-8-sig", dtype=str, skipinitialspace=True, keep_default_na=False
        )
    except UnicodeDecodeError:
        raise DatasetValidationError(["file is not UTF-8 encoded text"]) from None
    except (pd.errors.ParserError, pd.errors.EmptyDataError) as exc:
        raise DatasetValidationError([f"could not parse CSV: {exc}"]) from None

    df.columns = [str(c).strip() for c in df.columns]
    errors: list[str] = []

    dupes = sorted({c for c in df.columns if list(df.columns).count(c) > 1})
    if dupes:
        errors.append(f"duplicate column(s): {', '.join(dupes)}")

    missing = [c for c in [schema.target.name, *schema.required_names] if c not in df.columns]
    if missing:
        errors.append(f"missing required column(s): {', '.join(missing)}")
    if errors:
        raise DatasetValidationError(errors)

    used_features = [f for f in schema.names if f in df.columns]
    used = [*used_features, schema.target.name]
    ignored = [c for c in df.columns if c not in used]

    if len(df) < min_rows:
        errors.append(f"need at least {min_rows} data rows, got {len(df)}")

    numeric = pd.DataFrame(index=df.index)
    for col in used:
        raw = df[col].fillna("").str.strip()
        blank = raw == ""
        if blank.any():
            errors.append(f"column {col!r}: missing values on line(s) {_lines(df.index, blank)}")
        values = pd.to_numeric(raw, errors="coerce")
        not_number = values.isna() & ~blank
        if not_number.any():
            errors.append(f"column {col!r}: non-numeric values on line(s) {_lines(df.index, not_number)}")
        if not np.isfinite(values.dropna()).all():
            errors.append(f"column {col!r}: contains infinite values")
        numeric[col] = values

    if not errors:
        for name in used_features:
            spec = schema.get(name)
            assert spec is not None
            values = numeric[name]
            if spec.type == "int":
                fractional = values != values.round()
                if fractional.any():
                    errors.append(f"column {name!r}: expected whole numbers on line(s) {_lines(df.index, fractional)}")
            _check_range(errors, name, values, spec.min, spec.max)
        _check_range(errors, schema.target.name, numeric[schema.target.name], schema.target.min, schema.target.max)

        constant = [c for c in used_features if numeric[c].nunique() <= 1]
        if constant and len(constant) == len(used_features):
            errors.append("every feature column is constant; nothing to learn from")
        if numeric[schema.target.name].nunique() <= 1:
            errors.append(f"target column {schema.target.name!r} is constant")

    if errors:
        raise DatasetValidationError(errors[:MAX_REPORTED_ERRORS])

    return ValidatedDataset(
        frame=numeric.reset_index(drop=True),
        features=used_features,
        target=schema.target.name,
        ignored_columns=ignored,
    )
