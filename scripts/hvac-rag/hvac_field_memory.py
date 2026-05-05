"""
HVAC Field Expertise Memory - Core module for field experience cases.
Stores and retrieves field technique knowledge from technicians and service notes.
"""

import os
import json
import uuid
import hashlib
from datetime import datetime
from typing import Optional

import psycopg2
import psycopg2.extras
from psycopg2 import sql
import qdrant_client
from qdrant_client.models import Distance, VectorParams, PointStruct, Filter, FieldCondition, MatchValue, MatchAny

try:
    from openai import OpenAI
except ImportError:
    OpenAI = None


def get_db_connection():
    """Returns psycopg2 connection using env vars."""
    return psycopg2.connect(
        host=os.getenv("POSTGRES_HOST", "localhost"),
        port=int(os.getenv("POSTGRES_PORT", "5432")),
        dbname=os.getenv("POSTGRES_DB", "hvac_kb"),
        user=os.getenv("POSTGRES_USER", "postgres"),
        password=os.getenv("POSTGRES_PASSWORD", ""),
    )


def ensure_schema():
    """Runs hvac_field_case_schema.sql to create table if not exists."""
    schema_path = os.path.join(os.path.dirname(__file__), "hvac_field_case_schema.sql")
    with open(schema_path, "r") as f:
        schema_sql = f.read()

    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(schema_sql)
        conn.commit()
    finally:
        conn.close()


def insert_field_case(case_data: dict) -> str:
    """Inserts a field case into Postgres, returns ID."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO hvac_field_cases (
                    author, source_type, source_url, source_title,
                    brand, model, model_family, equipment_type,
                    alarm_codes, components, symptoms,
                    problem_summary, field_technique, safety_notes, limitations,
                    evidence_level, confidence, status, metadata
                ) VALUES (
                    %(author)s, %(source_type)s, %(source_url)s, %(source_title)s,
                    %(brand)s, %(model)s, %(model_family)s, %(equipment_type)s,
                    %(alarm_codes)s, %(components)s, %(symptoms)s,
                    %(problem_summary)s, %(field_technique)s, %(safety_notes)s, %(limitations)s,
                    %(evidence_level)s, %(confidence)s, %(status)s, %(metadata)s
                )
                RETURNING id::text
                """,
                {
                    "author": case_data.get("author"),
                    "source_type": case_data.get("source_type", "field_experience"),
                    "source_url": case_data.get("source_url"),
                    "source_title": case_data.get("source_title"),
                    "brand": case_data.get("brand"),
                    "model": case_data.get("model"),
                    "model_family": case_data.get("model_family"),
                    "equipment_type": case_data.get("equipment_type"),
                    "alarm_codes": case_data.get("alarm_codes", []),
                    "components": case_data.get("components", []),
                    "symptoms": case_data.get("symptoms", []),
                    "problem_summary": case_data.get("problem_summary"),
                    "field_technique": case_data.get("field_technique"),
                    "safety_notes": case_data.get("safety_notes"),
                    "limitations": case_data.get("limitations"),
                    "evidence_level": case_data.get("evidence_level", "field_experience"),
                    "confidence": case_data.get("confidence", "medium"),
                    "status": case_data.get("status", "draft"),
                    "metadata": json.dumps(case_data.get("metadata", {})),
                },
            )
            result = cur.fetchone()
            conn.commit()
            return result[0] if result else None
    finally:
        conn.close()


def get_field_case(case_id: str) -> dict:
    """Fetch single case by ID."""
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                "SELECT * FROM hvac_field_cases WHERE id = %s::uuid",
                (case_id,),
            )
            row = cur.fetchone()
            if row:
                return dict(row)
            return None
    finally:
        conn.close()


def approve_field_case(case_id: str) -> None:
    """Update status from 'draft' to 'approved'."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE hvac_field_cases
                SET status = 'approved', updated_at = now()
                WHERE id = %s::uuid AND status = 'draft'
                """,
                (case_id,),
            )
        conn.commit()
    finally:
        conn.close()


def deprecate_field_case(case_id: str) -> None:
    """Update status to 'deprecated'."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE hvac_field_cases
                SET status = 'deprecated', updated_at = now()
                WHERE id = %s::uuid
                """,
                (case_id,),
            )
        conn.commit()
    finally:
        conn.close()


def delete_field_case(case_id: str) -> None:
    """Hard delete."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "DELETE FROM hvac_field_cases WHERE id = %s::uuid",
                (case_id,),
            )
        conn.commit()
    finally:
        conn.close()


def list_field_cases(
    status: str = None,
    author: str = None,
    brand: str = None,
    limit: int = 100,
) -> list[dict]:
    """List with optional filters."""
    conn = get_db_connection()
    try:
        conditions = []
        params = []

        if status:
            conditions.append("status = %s")
            params.append(status)
        if author:
            conditions.append("author = %s")
            params.append(author)
        if brand:
            conditions.append("brand = %s")
            params.append(brand)

        where_clause = ""
        if conditions:
            where_clause = "WHERE " + " AND ".join(conditions)

        query = f"SELECT * FROM hvac_field_cases {where_clause} ORDER BY created_at DESC LIMIT %s"
        params.append(limit)

        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(query, params)
            rows = cur.fetchall()
            return [dict(row) for row in rows]
    finally:
        conn.close()


def generate_embedding(text: str) -> list[float]:
    """Generate OpenAI embedding."""
    if OpenAI is None:
        raise ImportError("openai package required for embeddings")

    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    response = client.embeddings.create(
        input=text,
        model="text-embedding-3-small",
    )
    return response.data[0].embedding


def get_qdrant_client() -> qdrant_client.QdrantClient:
    """Returns Qdrant client."""
    return qdrant_client.QdrantClient(
        host=os.getenv("QDRANT_HOST", "localhost"),
        port=int(os.getenv("QDRANT_PORT", "6333")),
    )


def ensure_qdrant_collection():
    """Create hvac_field_experience_v1 collection if not exists with vector size 1536."""
    client = get_qdrant_client()
    collection_name = "hvac_field_experience_v1"

    collections = client.get_collections().collections
    collection_names = [c.name for c in collections]

    if collection_name not in collection_names:
        client.create_collection(
            collection_name=collection_name,
            vectors_config=VectorParams(size=1536, distance=Distance.COSINE),
        )

        # Create payload indexes
        payload_index_fields = [
            "source_type",
            "author",
            "brand",
            "model_family",
            "equipment_type",
            "alarm_codes",
            "components",
            "symptoms",
            "evidence_level",
            "confidence",
            "status",
        ]

        for field in payload_index_fields:
            try:
                client.create_payload_index(
                    collection_name=collection_name,
                    field_name=field,
                    field_schema="keyword" if field not in ["alarm_codes", "components", "symptoms"] else "text",
                )
            except Exception:
                pass


def case_card_to_text(case: dict) -> str:
    """Convert case dict to searchable text."""
    parts = [
        case.get("problem_summary", ""),
        case.get("field_technique", ""),
        case.get("safety_notes", ""),
    ]
    return " ".join(p for p in parts if p)


def index_field_case_approved(case_id: str) -> None:
    """Fetch approved case from Postgres, generate embedding, upsert to Qdrant."""
    case = get_field_case(case_id)
    if not case:
        raise ValueError(f"Case not found: {case_id}")

    if case.get("status") != "approved":
        raise ValueError(f"Case {case_id} is not approved (status: {case.get('status')})")

    # Build payload (exclude internal fields)
    payload = {
        "id": case["id"],
        "author": case["author"],
        "source_type": case["source_type"],
        "source_url": case["source_url"],
        "source_title": case["source_title"],
        "brand": case["brand"],
        "model": case["model"],
        "model_family": case["model_family"],
        "equipment_type": case["equipment_type"],
        "alarm_codes": case["alarm_codes"] or [],
        "components": case["components"] or [],
        "symptoms": case["symptoms"] or [],
        "problem_summary": case["problem_summary"],
        "field_technique": case["field_technique"],
        "safety_notes": case["safety_notes"],
        "limitations": case["limitations"],
        "evidence_level": case["evidence_level"],
        "confidence": case["confidence"],
        "status": case["status"],
    }

    # Generate embedding
    text = case_card_to_text(case)
    embedding = generate_embedding(text)

    # Upsert to Qdrant
    client = get_qdrant_client()
    collection_name = "hvac_field_experience_v1"

    point = PointStruct(
        id=case_id,
        vector=embedding,
        payload=payload,
    )

    client.upsert(
        collection_name=collection_name,
        points=[point],
    )


def field_experience_lookup(
    brand: str = None,
    family: str = None,
    alarm_code: str = None,
    component: str = None,
    symptom: str = None,
    top_k: int = 3,
) -> list[dict]:
    """
    Search Qdrant for matching field cases.
    Build filter: status=approved, source_type=field_experience,
    and should clauses for brand/family/alarm_code/component/symptom if provided.
    """
    client = get_qdrant_client()
    collection_name = "hvac_field_experience_v1"

    # Ensure collection exists
    ensure_qdrant_collection()

    # Build must conditions (required)
    must_conditions = [
        FieldCondition(key="status", match=MatchValue(value="approved")),
        FieldCondition(key="source_type", match=MatchValue(value="field_experience")),
    ]

    # Build should conditions (optional)
    should_conditions = []
    if brand:
        should_conditions.append(
            FieldCondition(key="brand", match=MatchValue(value=brand))
        )
    if family:
        should_conditions.append(
            FieldCondition(key="model_family", match=MatchValue(value=family))
        )
    if alarm_code:
        should_conditions.append(
            FieldCondition(key="alarm_codes", match=MatchValue(value=alarm_code))
        )
    if component:
        should_conditions.append(
            FieldCondition(key="components", match=MatchValue(value=component))
        )
    if symptom:
        should_conditions.append(
            FieldCondition(key="symptoms", match=MatchValue(value=symptom))
        )

    search_filter = Filter(
        must=must_conditions,
        should=should_conditions if should_conditions else None,
    )

    # Generate query embedding for the search
    query_parts = []
    if brand:
        query_parts.append(brand)
    if family:
        query_parts.append(family)
    if alarm_code:
        query_parts.append(alarm_code)
    if component:
        query_parts.append(component)
    if symptom:
        query_parts.append(symptom)

    query_text = " ".join(query_parts) if query_parts else "HVAC field technique"
    query_embedding = generate_embedding(query_text)

    results = client.search(
        collection_name=collection_name,
        query_vector=query_embedding,
        query_filter=search_filter,
        limit=top_k,
    )

    return [
        {
            "id": hit.id,
            "score": hit.score,
            "payload": hit.payload,
        }
        for hit in results
    ]
