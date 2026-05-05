# OpenWebUI Best Practices for HVAC Technical Documentation Q&A

> **Research Date:** 2026-05-05
> **Sources:** docs.openwebui.com, GitHub open-webui/open-webui, GitHub open-webui/pipelines

---

## 1. How to Build Tools/Functions in OpenWebUI That Query Technical Documentation

### Architecture Decision: Use Native Mode (Agentic) Tools + Knowledge Base

OpenWebUI has **two plugin families** that can query technical documentation:

| Approach | Best For | Complexity | Where It Runs |
|----------|----------|------------|---------------|
| **Workspace Tools** | Model-called functions during inference | Low | Inside OpenWebUI process |
| **Knowledge Base (RAG)** | Document retrieval & Q&A | Low | Built-in, no code needed |
| **Pipe Functions** | Custom model providers / agents | Medium | Inside OpenWebUI process |
| **Pipelines** | Heavy compute / GPU workloads | High | Separate Docker container |

### Recommended Approach for HVAC Manuals: Knowledge Base + Custom Tool

**Step 1: Create Knowledge Bases per Brand**

In OpenWebUI: **Workspace > Knowledge > + New Knowledge**

```
Knowledge Base: "HVAC - LG"
Knowledge Base: "HVAC - Samsung"
Knowledge Base: "HVAC - Daikin"
Knowledge Base: "HVAC - Springer Carrier"
```

**Step 2: Upload manuals as PDFs to each KB**

**Step 3: Create a custom Tool for advanced queries**

```python
"""
title: HVAC Technical Query Tool
author: your_name
version: 1.0.0
requirements: httpx
"""

from pydantic import BaseModel, Field
import httpx

class Tools:
    def __init__(self):
        self.valves = self.Valves()
        self.citation = False  # Disable auto-citations to use custom ones

    class Valves(BaseModel):
        qdrant_url: str = Field(
            default="http://localhost:6333",
            description="Qdrant vector DB URL"
        )
        qdrant_api_key: str = Field(
            default="",
            description="Qdrant API key (if applicable)",
            json_schema_extra={"input": {"type": "password"}}
        )
        collection_prefix: str = Field(
            default="hvac_manuals",
            description="Prefix for Qdrant collections"
        )

    async def query_hvac_manual(
        self,
        brand: str,
        query: str,
        model_number: str = "",
        __event_emitter__=None
    ) -> str:
        """
        Query HVAC technical documentation for a specific brand.
        
        :param brand: Equipment brand (LG, Samsung, Daikin, Springer, Carrier)
        :param query: Technical question or search terms
        :param model_number: Specific model number (optional, improves accuracy)
        """
        if __event_emitter__:
            await __event_emitter__({
                "type": "status",
                "data": {"description": f"Searching {brand} manuals...", "done": False}
            })

        # Construct search query with model number if provided
        search_query = f"{brand} {model_number} {query}" if model_number else f"{brand} {query}"
        
        try:
            # Option A: Query internal OpenWebUI Knowledge API
            # Or Option B: Query external Qdrant directly
            headers = {"Content-Type": "application/json"}
            if self.valves.qdrant_api_key:
                headers["api-key"] = self.valves.qdrant_api_key

            collection_name = f"{self.valves.collection_prefix}_{brand.lower()}"
            
            # Get embedding for query (simplified - use your embedding model)
            # In practice, call your embedding endpoint here
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.valves.qdrant_url}/collections/{collection_name}/points/search",
                    headers=headers,
                    json={
                        "vector": [0.0] * 768,  # Replace with actual embedding
                        "limit": 5,
                        "with_payload": True
                    }
                )
                results = response.json().get("result", [])

            # Format results
            contexts = []
            for point in results:
                payload = point.get("payload", {})
                contexts.append({
                    "content": payload.get("text", ""),
                    "source": payload.get("source", "Unknown"),
                    "page": payload.get("page", "N/A")
                })

            # Emit citations (Native Mode compatible)
            if __event_emitter__:
                for ctx in contexts:
                    await __event_emitter__({
                        "type": "citation",
                        "data": {
                            "document": [ctx["content"]],
                            "metadata": [{
                                "date_accessed": "2026-05-05",
                                "source": ctx["source"],
                                "page": ctx["page"]
                            }],
                            "source": {
                                "name": ctx["source"],
                                "url": f"#page-{ctx['page']}"
                            }
                        }
                    })
                
                await __event_emitter__({
                    "type": "status",
                    "data": {"description": f"Found {len(contexts)} relevant sections", "done": True}
                })

            # Return synthesized context to the model
            formatted = "\n\n".join([
                f"Source: {c['source']} (Page {c['page']})\n{c['content']}"
                for c in contexts
            ])
            
            return f"Technical documentation findings for {brand}:\n\n{formatted}"

        except Exception as e:
            if __event_emitter__:
                await __event_emitter__({
                    "type": "status",
                    "data": {"description": f"Error: {str(e)}", "done": True}
                })
            return f"Error querying manuals: {str(e)}"
```

### Best Practices for Technical Documentation Tools

1. **Always use `async` methods** — OpenWebUI backend is progressively moving to fully async
2. **Set `self.citation = False`** when emitting custom citations to prevent auto-citation override
3. **Use `status` events** for progress updates — they work in both Default and Native modes
4. **Avoid `message`/`replace` events** in Native Mode — they get overwritten by completion snapshots
5. **Return content as string** from the tool method — this is the most reliable delivery mechanism in Native Mode

---

## 2. Patterns for Model-Specific Tool Routing (LG vs Samsung vs Daikin)

### Pattern A: Knowledge Base Scoping (Recommended)

Attach specific Knowledge Bases to specific Models:

```
Workspace > Models > + New Model

Model: "HVAC Assistant - LG"
Base Model: hermes-local-code (or your preferred model)
System Prompt: "You are an LG HVAC technical support specialist..."
Knowledge: Attach "HVAC - LG" KB
Tools: Enable HVAC Technical Query Tool
```

Repeat for each brand. Users select the brand-specific model.

### Pattern B: Single Model with Brand Detection + Pipe Function

Create a **Pipe Function** that routes to different knowledge collections based on detected brand:

```python
"""
title: HVAC Brand Router Pipe
author: your_name
version: 1.0.0
requirements: httpx
"""

from pydantic import BaseModel, Field
import httpx
import re

class Pipe:
    class Valves(BaseModel):
        qdrant_url: str = Field(default="http://localhost:6333")
        embedding_model: str = Field(default="nomic-embed-text")

    def __init__(self):
        self.valves = self.Valves()
        self.brand_patterns = {
            "lg": r"\b(LG|LG Electronics|LG HVAC)\b",
            "samsung": r"\b(Samsung|Samsung HVAC|Samsung DVM)\b",
            "daikin": r"\b(Daikin|Daikin Industries)\b",
            "springer": r"\b(Springer|Springer Carrier|Carrier)\b"
        }

    def pipes(self):
        return [
            {"id": "hvac-auto", "name": "HVAC - Auto Router"},
            {"id": "hvac-lg", "name": "HVAC - LG Only"},
            {"id": "hvac-samsung", "name": "HVAC - Samsung Only"},
            {"id": "hvac-daikin", "name": "HVAC - Daikin Only"},
        ]

    async def pipe(self, body: dict, __user__: dict) -> str:
        user_message = body.get("messages", [])[-1].get("content", "")
        model_id = body.get("model", "")
        
        # Detect brand from message or model selection
        selected_brand = None
        
        # If user selected specific model pipe
        if "lg" in model_id:
            selected_brand = "lg"
        elif "samsung" in model_id:
            selected_brand = "samsung"
        elif "daikin" in model_id:
            selected_brand = "daikin"
        elif "springer" in model_id:
            selected_brand = "springer"
        else:
            # Auto-detect from message content
            for brand, pattern in self.brand_patterns.items():
                if re.search(pattern, user_message, re.IGNORECASE):
                    selected_brand = brand
                    break
        
        if not selected_brand:
            return "Please specify an HVAC brand (LG, Samsung, Daikin, or Springer/Carrier)."

        # Modify system prompt to include brand context
        system_prompt = f"""You are an HVAC technical support specialist for {selected_brand.upper()} equipment.
Use the query_knowledge_files tool to search the {selected_brand.upper()} technical manual knowledge base.
Always cite specific manual sections and page numbers when providing technical answers."""

        # Inject system prompt and brand-specific tool configuration
        messages = body.get("messages", [])
        if messages and messages[0].get("role") == "system":
            messages[0]["content"] = system_prompt
        else:
            messages.insert(0, {"role": "system", "content": system_prompt})

        body["messages"] = messages
        
        # Route to the actual LLM
        from open_webui.utils.chat import generate_chat_completion
        from fastapi import Request
        
        # Use internal completion generator
        # This requires __request__ to be available
        return await self._call_model(body, __user__)

    async def _call_model(self, body, user):
        # Call the underlying model with modified body
        # In practice, delegate to generate_chat_completion
        pass
```

### Pattern C: Filter Function with Brand Injection

Use a **Filter Function** to automatically detect brand and inject context before the model sees the prompt:

```python
"""
title: HVAC Brand Detection Filter
author: your_name
version: 1.0.0
"""

class Filter:
    def __init__(self):
        self.valves = self.Valves()
        self.toggle = True  # Allow users to enable/disable per chat

    class Valves(BaseModel):
        auto_detect_brand: bool = Field(
            default=True,
            description="Automatically detect HVAC brand from user query"
        )

    async def inlet(self, body: dict, __user__: dict) -> dict:
        messages = body.get("messages", [])
        if not messages:
            return body

        last_message = messages[-1].get("content", "")
        
        # Simple brand detection
        brands = {
            "LG": ["lg", "lg electronics"],
            "Samsung": ["samsung", "samsung dvm", "samsung hvac"],
            "Daikin": ["daikin", "daikin industries"],
            "Springer Carrier": ["springer", "carrier", "springer carrier"]
        }
        
        detected_brand = None
        for brand, keywords in brands.items():
            if any(kw in last_message.lower() for kw in keywords):
                detected_brand = brand
                break

        if detected_brand:
            # Inject brand context into system prompt
            system_msg = {
                "role": "system",
                "content": f"[BRAND CONTEXT: This query is about {detected_brand} HVAC equipment. Use {detected_brand} technical manuals.]"
            }
            
            if messages[0].get("role") == "system":
                messages[0]["content"] += f"\n\n{system_msg['content']}"
            else:
                messages.insert(0, system_msg)

            body["messages"] = messages

        return body

    async def outlet(self, body: dict, __user__: dict) -> dict:
        # Optional: Post-process responses
        return body
```

---

## 3. OpenWebUI Tools vs Functions vs Pipelines — Which is Best for HVAC Manual Q&A?

### Decision Matrix

| Requirement | Tool | Function (Pipe/Filter) | Pipeline |
|------------|------|------------------------|----------|
| **Simple document Q&A** | ✅ Best | ⚠️ Overkill | ❌ Overkill |
| **Model routing by brand** | ❌ Can't | ✅ Pipe | ✅ Pipe |
| **Pre-process user queries** | ❌ Can't | ✅ Filter | ✅ Filter |
| **Heavy GPU embedding** | ❌ In-process | ❌ In-process | ✅ Offloaded |
| **Custom RAG pipeline** | ❌ Limited | ⚠️ Complex | ✅ Best |
| **Multi-step agent logic** | ⚠️ Limited | ✅ Pipe | ✅ Pipe |
| **Call external APIs** | ✅ Yes | ✅ Yes | ✅ Yes |
| **Community sharing** | ✅ Easy | ✅ Easy | ⚠️ Harder |

### Recommendation for HVAC Manual Q&A

**Architecture: Hybrid Approach**

```
┌─────────────────────────────────────────────────────────────┐
│                    OPENWEBUI INSTANCE                        │
│                                                              │
│  ┌─────────────────┐    ┌──────────────────────────────┐   │
│  │  Knowledge Base │    │      Custom Tool             │   │
│  │  (per brand)    │    │  query_hvac_manual()         │   │
│  │                 │    │  - Searches Qdrant           │   │
│  │  • LG Manuals   │◄───┤  - Returns context + cites   │   │
│  │  • Samsung      │    │                              │   │
│  │  • Daikin       │    └──────────────────────────────┘   │
│  │  • Springer     │                                       │
│  └─────────────────┘                                       │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │           Model Presets (Workspace > Models)         │    │
│  │                                                      │    │
│  │  "HVAC Assistant - LG"        → LG KB + Tool        │    │
│  │  "HVAC Assistant - Samsung"   → Samsung KB + Tool   │    │
│  │  "HVAC Assistant - Daikin"    → Daikin KB + Tool    │    │
│  │  "HVAC Assistant - General"   → All KBs + Tool      │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Filter Function (Optional)                         │    │
│  │  - Auto-detects brand from query                    │    │
│  │  - Injects brand context into system prompt         │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  QDRANT VECTOR DB (External)                                │
│  Collections: hvac_manuals_lg, hvac_manuals_samsung, ...   │
│  Embeddings: nomic-embed-text (768D)                        │
└─────────────────────────────────────────────────────────────┘
```

### When to Use Each Component

**Use Tools when:**
- You need the model to call external APIs during inference
- You want model-decided retrieval ("should I search manuals for this?")
- You need to return structured data + citations

**Use Functions (Pipe) when:**
- You want to create brand-specific "models" in the sidebar
- You need multi-step agent logic before/after LLM calls
- You want to wrap multiple tools into a single user-facing model

**Use Functions (Filter) when:**
- You want transparent pre/post-processing on ALL messages
- You need brand detection without user explicitly selecting a model
- You want to enforce formatting, inject context, or log usage

**Use Pipelines when:**
- Your RAG pipeline needs GPU (cross-encoder reranking, heavy embeddings)
- You want to isolate heavy compute from the main OpenWebUI instance
- You need custom chunking, hybrid search, or complex retrieval logic

### Concrete Recommendation

For **HVAC manual Q&A**, start with:

1. **Knowledge Bases** (built-in RAG) — Upload all manuals
2. **One custom Tool** — For advanced Qdrant queries when built-in RAG isn't enough
3. **Model Presets** — One per brand, binding the right KB
4. **Native Mode** — Required for agentic knowledge tool usage

Only move to Pipelines if:
- You need custom embedding models running on GPU
- You have >1000 manuals and need advanced reranking
- You want to isolate the retrieval layer for scaling

---

## 4. Examples of OpenWebUI for Technical Support / Repair Manual Lookup

### Example 1: LG Error Code Lookup Tool

```python
"""
title: LG HVAC Error Code Lookup
author: your_name
version: 1.0.0
"""

from pydantic import BaseModel, Field

class Tools:
    def __init__(self):
        self.valves = self.Valves()
        self.citation = False

    class Valves(BaseModel):
        knowledge_base_id: str = Field(
            default="lg-hvac-kb",
            description="Knowledge base ID for LG manuals"
        )

    async def lookup_lg_error(
        self,
        error_code: str,
        unit_type: str = "",  # e.g., "multi-v", "chiller", "ducted"
        __event_emitter__=None
    ) -> str:
        """
        Look up an LG HVAC error code in the technical documentation.
        
        :param error_code: The error code displayed (e.g., "CH05", "E1", "P0")
        :param unit_type: Optional unit type for more specific results
        """
        if __event_emitter__:
            await __event_emitter__({
                "type": "status",
                "data": {"description": f"Looking up LG error code {error_code}...", "done": False}
            })

        # In practice, this would query your Qdrant/PGVector knowledge base
        # For this example, we'll show the pattern
        
        # Query would be: "error code {error_code} {unit_type}"
        # Return would include: meaning, causes, troubleshooting steps
        
        result = f"""
## LG Error Code: {error_code}

**Unit Type:** {unit_type or "General"}

### Meaning
[Retrieved from knowledge base]

### Possible Causes
1. [Cause 1 from manual]
2. [Cause 2 from manual]

### Troubleshooting Steps
1. Step 1...
2. Step 2...

### Reference
- Manual: LG Multi-V Service Manual
- Page: [Retrieved page number]
"""

        if __event_emitter__:
            await __event_emitter__({
                "type": "citation",
                "data": {
                    "document": [f"Error code {error_code} definition and troubleshooting"],
                    "metadata": [{"source": "LG Service Manual", "type": "technical_manual"}],
                    "source": {"name": "LG Service Manual", "url": "#"}
                }
            })
            await __event_emitter__({
                "type": "status",
                "data": {"description": "Error code lookup complete", "done": True}
            })

        return result
```

### Example 2: Multi-Brand Troubleshooting Agent (Pipe)

```python
"""
title: HVAC Troubleshooting Agent
author: your_name
version: 1.0.0
requirements: httpx
"""

from pydantic import BaseModel, Field
import httpx

class Pipe:
    class Valves(BaseModel):
        primary_model: str = Field(default="hermes-local-code")
        enable_web_search: bool = Field(default=False)

    def __init__(self):
        self.valves = self.Valves()

    def pipes(self):
        return [
            {"id": "hvac-troubleshoot", "name": "HVAC Troubleshooter"}
        ]

    async def pipe(self, body: dict, __user__: dict) -> str:
        messages = body.get("messages", [])
        user_query = messages[-1].get("content", "") if messages else ""

        # Step 1: Detect symptoms and brand
        system_prompt = """You are an HVAC diagnostic assistant. Follow this protocol:
1. Identify the equipment brand from the user's query
2. Ask clarifying questions if needed (model number, symptom details)
3. Use knowledge tools to search relevant technical manuals
4. Provide step-by-step troubleshooting procedures
5. Always cite manual sections and safety warnings

Safety First: Always remind users to disconnect power before servicing."""

        if messages and messages[0].get("role") == "system":
            messages[0]["content"] = system_prompt
        else:
            messages.insert(0, {"role": "system", "content": system_prompt})

        body["messages"] = messages
        
        # Delegate to primary model with modified prompt
        from open_webui.utils.chat import generate_chat_completion
        # Return the completion (simplified - actual implementation needs request object)
        return "[Agent would delegate to model with enhanced system prompt]"
```

### Example 3: Using Built-in Knowledge Tools (No Custom Code)

With Native Mode enabled, models automatically get these built-in tools:

| Tool | Purpose | HVAC Use Case |
|------|---------|---------------|
| `query_knowledge_files` | RAG search over KB | "Search LG manuals for CH05 error" |
| `search_knowledge_files` | Filename search | "Find the installation manual" |
| `view_knowledge_file` | Read specific file | "Show page 45 of the service manual" |
| `list_knowledge` | List attached KBs | "What manuals do you have?" |

**System Prompt for Model Preset:**

```
You are an HVAC technical support specialist. When users ask questions:
1. First use list_knowledge to see what manuals are available
2. Use query_knowledge_files to search for relevant sections
3. Use view_knowledge_file with offset to read specific pages if needed
4. Always cite the manual name and page number
5. Include safety warnings when appropriate

Available brands: LG, Samsung, Daikin, Springer Carrier
```

---

## 5. How to Use OpenWebUI's Valves/UserValves for Brand/Model Selection

### Two-Tier Configuration System

OpenWebUI uses **Pydantic BaseModel** classes for configuration:

| Level | Class | Who Configures | Where |
|-------|-------|---------------|-------|
| **Admin** | `Valves` | Administrators only | Admin Panel → Functions → ⚙️ |
| **User** | `UserValves` | Any user | Chat interface, per-function |

### Example: HVAC Tool with Brand Selection Valves

```python
"""
title: HVAC Configurable Query Tool
author: your_name
version: 1.0.0
"""

from pydantic import BaseModel, Field
from typing import Literal

class Tools:
    def __init__(self):
        self.valves = self.Valves()

    # ─── ADMIN CONFIGURATION ───
    class Valves(BaseModel):
        """Settings configured by administrator"""
        
        default_brand: Literal["LG", "Samsung", "Daikin", "Springer", "Any"] = Field(
            default="Any",
            description="Default brand when user doesn't specify",
            json_schema_extra={
                "input": {
                    "type": "select",
                    "options": [
                        {"value": "LG", "label": "LG Electronics"},
                        {"value": "Samsung", "label": "Samsung HVAC"},
                        {"value": "Daikin", "label": "Daikin Industries"},
                        {"value": "Springer", "label": "Springer Carrier"},
                        {"value": "Any", "label": "Any Brand"}
                    ]
                }
            }
        )
        
        qdrant_url: str = Field(
            default="http://localhost:6333",
            description="Qdrant vector database URL"
        )
        
        qdrant_api_key: str = Field(
            default="",
            description="API key for Qdrant authentication",
            json_schema_extra={"input": {"type": "password"}}
        )
        
        max_results: int = Field(
            default=5,
            description="Maximum number of manual sections to retrieve",
            ge=1,
            le=20
        )
        
        enable_hybrid_search: bool = Field(
            default=True,
            description="Use BM25 + vector search for better results"
        )

    # ─── USER CONFIGURATION ───
    class UserValves(BaseModel):
        """Settings configurable by each user in chat"""
        
        preferred_brand: Literal["Auto", "LG", "Samsung", "Daikin", "Springer"] = Field(
            default="Auto",
            description="Preferred HVAC brand for this conversation",
            json_schema_extra={
                "input": {
                    "type": "select",
                    "options": [
                        {"value": "Auto", "label": "Auto-detect from query"},
                        {"value": "LG", "label": "LG Electronics"},
                        {"value": "Samsung", "label": "Samsung HVAC"},
                        {"value": "Daikin", "label": "Daikin Industries"},
                        {"value": "Springer", "label": "Springer Carrier"}
                    ]
                }
            }
        )
        
        model_number: str = Field(
            default="",
            description="Specific model number (e.g., ARNU15GSK1A)"
        )
        
        include_diagrams: bool = Field(
            default=True,
            description="Include wiring diagrams and schematics in results"
        )
        
        search_depth: Literal["quick", "standard", "deep"] = Field(
            default="standard",
            description="Search thoroughness level",
            json_schema_extra={
                "input": {
                    "type": "select",
                    "options": [
                        {"value": "quick", "label": "Quick (top 3 results)"},
                        {"value": "standard", "label": "Standard (top 5 results)"},
                        {"value": "deep", "label": "Deep (top 10 results)"}
                    ]
                }
            }
        )

    async def query_manuals(
        self,
        query: str,
        __user__: dict,
        __event_emitter__=None
    ) -> str:
        """
        Query HVAC technical manuals with brand/model filtering.
        
        :param query: Technical question or search terms
        """
        # Access admin valves
        admin_config = self.valves
        
        # Access user valves
        user_config = __user__.get("valves", self.UserValves())
        
        # Determine brand priority: user preference > auto-detect > admin default
        brand = user_config.preferred_brand
        if brand == "Auto":
            brand = self._detect_brand(query) or admin_config.default_brand

        # Determine result limit based on search depth
        depth_limits = {"quick": 3, "standard": 5, "deep": 10}
        limit = depth_limits.get(user_config.search_depth, admin_config.max_results)

        if __event_emitter__:
            await __event_emitter__({
                "type": "status",
                "data": {
                    "description": f"Searching {brand} manuals (depth: {user_config.search_depth})...",
                    "done": False
                }
            })

        # Build query with model number if provided
        enriched_query = query
        if user_config.model_number:
            enriched_query = f"{user_config.model_number} {query}"

        # Execute search (simplified)
        # In practice: query Qdrant with brand filter
        
        result = f"""
**Brand:** {brand}
**Model:** {user_config.model_number or "Not specified"}
**Query:** {enriched_query}
**Results:** {limit} sections retrieved
**Diagrams included:** {user_config.include_diagrams}

[Search results would be formatted here with citations]
"""

        if __event_emitter__:
            await __event_emitter__({
                "type": "status",
                "data": {"description": "Search complete", "done": True}
            })

        return result

    def _detect_brand(self, query: str) -> str:
        """Simple keyword-based brand detection"""
        query_lower = query.lower()
        brands = {
            "LG": ["lg", "lg electronics"],
            "Samsung": ["samsung", "samsung hvac"],
            "Daikin": ["daikin"],
            "Springer": ["springer", "carrier"]
        }
        for brand, keywords in brands.items():
            if any(kw in query_lower for kw in keywords):
                return brand
        return ""
```

### Dynamic Options Example

For model numbers that change over time, use **dynamic options**:

```python
class Tools:
    class UserValves(BaseModel):
        model_number: str = Field(
            default="",
            description="Select equipment model",
            json_schema_extra={
                "input": {
                    "type": "select",
                    "options": "get_available_models"  # Method name as string!
                }
            }
        )

    @classmethod
    def get_available_models(cls, __user__=None) -> list[dict]:
        """Dynamically fetch model numbers from database"""
        # This could query your Qdrant metadata or a database
        return [
            {"value": "", "label": "-- Select Model --"},
            {"value": "ARNU15GSK1A", "label": "ARNU15GSK1A (1.5 Ton Wall Mount)"},
            {"value": "ARNU24GSK1A", "label": "ARNU24GSK1A (2 Ton Wall Mount)"},
            {"value": "AMNH18GSK1", "label": "AMNH18GSK1 (1.5 Ton Ducted)"},
        ]
```

### UI Rendering

The valves above render in OpenWebUI as:

**Admin Panel (Valves):**
- Dropdown: Default Brand
- Text: Qdrant URL
- Password: Qdrant API Key
- Number: Max Results (1-20)
- Toggle: Enable Hybrid Search

**Chat Interface (UserValves):**
- Dropdown: Preferred Brand (Auto/LG/Samsung/Daikin/Springer)
- Text: Model Number
- Toggle: Include Diagrams
- Dropdown: Search Depth (Quick/Standard/Deep)

---

## Summary: Recommended Architecture for HVAC Manual Q&A

```
┌─────────────────────────────────────────────────────────────────┐
│                     OPENWEBUI (Docker)                           │
│                                                                  │
│  ┌─────────────────┐  ┌──────────────────────────────────────┐  │
│  │  Knowledge Base │  │  Custom Tools                        │  │
│  │  Workspace      │  │  Workspace > Tools                   │  │
│  │                 │  │                                      │  │
│  │  HVAC - LG      │  │  ┌──────────────────────────────┐   │  │
│  │  HVAC - Samsung │  │  │ query_hvac_manual()          │   │  │
│  │  HVAC - Daikin  │  │  │ - Valves: qdrant_url, prefix │   │  │
│  │  HVAC - Springer│  │  │ - UserValves: brand, model   │   │  │
│  │                 │  │  └──────────────────────────────┘   │  │
│  └─────────────────┘  └──────────────────────────────────────┘  │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Model Presets (Workspace > Models)                         │ │
│  │                                                             │ │
│  │  "HVAC - LG Expert"        → LG KB + query tool            │ │
│  │  "HVAC - Samsung Expert"   → Samsung KB + query tool       │ │
│  │  "HVAC - Daikin Expert"    → Daikin KB + query tool        │ │
│  │  "HVAC - General"          → All KBs + query tool          │ │
│  │                                                             │ │
│  │  All presets: function_calling = Native                    │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Optional: Filter Function                                  │ │
│  │  - Auto-detects brand from query                            │ │
│  │  - Injects brand context into system prompt                 │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  QDRANT VECTOR DB                                               │
│  Collections: hvac_manuals_lg, hvac_manuals_samsung, etc.      │
│  Embeddings: nomic-embed-text via Ollama (:11434)              │
└─────────────────────────────────────────────────────────────────┘
```

### Key Configuration Checklist

- [ ] Set `function_calling = Native` globally (Admin > Settings > Models > ⚙️)
- [ ] Enable `ENABLE_RAG_HYBRID_SEARCH` for better retrieval accuracy
- [ ] Configure external embedding engine (Ollama `nomic-embed-text`) via `RAG_EMBEDDING_ENGINE`
- [ ] Create Knowledge Bases per brand, upload PDFs
- [ ] Create Model Presets binding KB + tools
- [ ] Write custom Tool with Valves/UserValves for Qdrant queries
- [ ] Add system prompts instructing models to use knowledge tools
- [ ] Test with frontier models (Claude, GPT, Gemini) for best tool-calling reliability

---

## References

1. [OpenWebUI Tools Documentation](https://docs.openwebui.com/features/extensibility/plugin/tools)
2. [OpenWebUI Functions Documentation](https://docs.openwebui.com/features/extensibility/plugin/functions)
3. [OpenWebUI Valves Guide](https://docs.openwebui.com/features/extensibility/plugin/development/valves)
4. [OpenWebUI Pipe Functions](https://docs.openwebui.com/features/extensibility/plugin/functions/pipe)
5. [OpenWebUI Knowledge Base](https://docs.openwebui.com/features/workspace/knowledge)
6. [OpenWebUI Pipelines](https://docs.openwebui.com/features/extensibility/pipelines/)
7. [OpenWebUI Essentials](https://docs.openwebui.com/getting-started/essentials)
