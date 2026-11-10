"""Feature schema loaded from features.yaml, and the Pydantic model built from it."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal

import yaml
from pydantic import BaseModel, ConfigDict, Field, create_model


@dataclass(frozen=True)
class FeatureSpec:
    name: str
    type: Literal["float", "int"]
    min: float | None = None
    max: float | None = None
    required: bool = True
    example: float | None = None
    description: str = ""

    @property
    def python_type(self) -> type:
        return int if self.type == "int" else float


@dataclass(frozen=True)
class TargetSpec:
    name: str
    min: float | None = None
    max: float | None = None


@dataclass(frozen=True)
class Schema:
    target: TargetSpec
    features: tuple[FeatureSpec, ...]

    @property
    def names(self) -> list[str]:
        return [f.name for f in self.features]

    @property
    def required_names(self) -> list[str]:
        return [f.name for f in self.features if f.required]

    def get(self, name: str) -> FeatureSpec | None:
        return next((f for f in self.features if f.name == name), None)

    def example(self) -> dict[str, Any]:
        return {f.name: f.example for f in self.features if f.example is not None}


def load_schema(path: Path) -> Schema:
    raw = yaml.safe_load(path.read_text(encoding="utf-8"))
    if not isinstance(raw, dict) or "features" not in raw or "target" not in raw:
        raise ValueError(f"{path}: expected top-level 'target' and 'features' keys")

    features: list[FeatureSpec] = []
    seen: set[str] = set()
    for item in raw["features"]:
        spec = FeatureSpec(
            name=str(item["name"]),
            type=item.get("type", "float"),
            min=item.get("min"),
            max=item.get("max"),
            required=bool(item.get("required", True)),
            example=item.get("example"),
            description=item.get("description", ""),
        )
        if spec.type not in ("float", "int"):
            raise ValueError(f"{path}: feature {spec.name!r} has unsupported type {spec.type!r}")
        if spec.name in seen:
            raise ValueError(f"{path}: duplicate feature {spec.name!r}")
        seen.add(spec.name)
        features.append(spec)

    if not features:
        raise ValueError(f"{path}: at least one feature is required")

    t = raw["target"]
    target = TargetSpec(name=str(t["name"]), min=t.get("min"), max=t.get("max"))
    if target.name in seen:
        raise ValueError(f"{path}: target {target.name!r} is also listed as a feature")
    return Schema(target=target, features=tuple(features))


def build_request_model(schema: Schema) -> type[BaseModel]:
    """Build the /predict input model from the schema.

    Fields marked `required: false` are optional here; whether a value is
    needed is decided per request by the active model's feature list.
    """
    fields: dict[str, Any] = {}
    for f in schema.features:
        constraints = {"description": f.description or None}
        if f.min is not None:
            constraints["ge"] = f.min
        if f.max is not None:
            constraints["le"] = f.max
        if f.example is not None:
            constraints["examples"] = [f.example]
        if f.required:
            fields[f.name] = (f.python_type, Field(..., **constraints))
        else:
            fields[f.name] = (f.python_type | None, Field(None, **constraints))

    return create_model(
        "HouseFeatures",
        __config__=ConfigDict(extra="forbid", json_schema_extra={"example": schema.example()}),
        **fields,
    )
