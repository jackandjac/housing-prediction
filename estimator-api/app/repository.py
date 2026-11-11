"""MongoDB persistence for estimate history."""

from __future__ import annotations

import re
from typing import Any

from bson import ObjectId
from bson.errors import InvalidId
from pymongo import DESCENDING, AsyncMongoClient
from pymongo.errors import PyMongoError


class DatabaseUnavailableError(Exception):
    pass


def redact(text: object) -> str:
    """Strip credentials from driver error messages before they reach logs or responses."""
    return re.sub(r"//[^@/\s]+@", "//***@", str(text))


def parse_id(value: str) -> ObjectId | None:
    try:
        return ObjectId(value)
    except (InvalidId, TypeError):
        return None


def to_api(doc: dict[str, Any]) -> dict[str, Any]:
    out = {k: v for k, v in doc.items() if k != "_id"}
    out["id"] = str(doc["_id"])
    return out


class EstimateRepository:
    def __init__(self, uri: str, db: str, collection: str):
        # Lazy connect: constructing the client does no network I/O.
        self._client: AsyncMongoClient = AsyncMongoClient(
            uri, serverSelectionTimeoutMS=5000, appname="housing-estimator-api", tz_aware=True
        )
        self._coll = self._client[db][collection]

    async def init(self) -> None:
        await self._run(self._coll.create_index([("created_at", DESCENDING)]))

    async def close(self) -> None:
        await self._client.close()

    async def ping(self) -> bool:
        try:
            await self._client.admin.command("ping")
            return True
        except PyMongoError:
            return False

    async def _run(self, awaitable):
        try:
            return await awaitable
        except PyMongoError as exc:
            raise DatabaseUnavailableError(redact(exc)) from None

    async def insert(self, doc: dict[str, Any]) -> dict[str, Any]:
        result = await self._run(self._coll.insert_one(doc))
        return to_api({**doc, "_id": result.inserted_id})

    async def get(self, estimate_id: str) -> dict[str, Any] | None:
        oid = parse_id(estimate_id)
        if oid is None:
            return None
        doc = await self._run(self._coll.find_one({"_id": oid}))
        return to_api(doc) if doc else None

    async def get_many(self, ids: list[str]) -> list[dict[str, Any] | None]:
        """Documents in the order requested; None where an id is unknown or malformed."""
        oids = {i: parse_id(i) for i in ids}
        valid = [o for o in oids.values() if o is not None]
        docs = await self._run(self._coll.find({"_id": {"$in": valid}}).to_list()) if valid else []
        by_id = {str(d["_id"]): to_api(d) for d in docs}
        return [by_id.get(i) for i in ids]

    async def list(self, limit: int, offset: int) -> tuple[list[dict[str, Any]], int]:
        cursor = self._coll.find({}).sort("created_at", DESCENDING).skip(offset).limit(limit)
        docs = await self._run(cursor.to_list())
        total = await self._run(self._coll.count_documents({}))
        return [to_api(d) for d in docs], total

    async def delete(self, estimate_id: str) -> bool:
        oid = parse_id(estimate_id)
        if oid is None:
            return False
        result = await self._run(self._coll.delete_one({"_id": oid}))
        return result.deleted_count == 1

    async def drop(self) -> None:
        """Drop the collection (used by tests on their own throwaway collection)."""
        await self._run(self._coll.drop())
