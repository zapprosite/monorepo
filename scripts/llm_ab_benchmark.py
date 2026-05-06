#!/usr/bin/env python3
"""
A/B benchmark for local LLM serving stacks.

Scenario A: current LiteLLM -> llama-server stack
Scenario B: alternate OpenAI-compatible endpoint (e.g. parallel vLLM)

Outputs JSON so results can be compared and archived.
"""
from __future__ import annotations

import argparse
import json
import os
import statistics
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed


def post_json(url: str, payload: dict, headers: dict[str, str], timeout: int) -> tuple[int, bytes]:
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.status, resp.read()


def single_request(base_url: str, model: str, api_key: str, prompt: str, max_tokens: int, timeout: int) -> dict:
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    payload = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.1,
        "max_tokens": max_tokens,
        "stream": False,
    }

    started = time.perf_counter()
    status, body = post_json(f"{base_url.rstrip('/')}/chat/completions", payload, headers, timeout)
    elapsed = time.perf_counter() - started
    parsed = json.loads(body)
    message = parsed["choices"][0]["message"]
    text = message.get("content") or message.get("reasoning_content") or ""
    usage = parsed.get("usage", {})
    return {
        "status": status,
        "latency_s": elapsed,
        "output_chars": len(text),
        "completion_tokens": usage.get("completion_tokens"),
        "prompt_tokens": usage.get("prompt_tokens"),
        "total_tokens": usage.get("total_tokens"),
    }


def run_case(base_url: str, model: str, api_key: str, prompt: str, max_tokens: int, timeout: int, concurrency: int, requests: int) -> dict:
    results = []
    started = time.perf_counter()
    with ThreadPoolExecutor(max_workers=concurrency) as pool:
        futures = [
            pool.submit(single_request, base_url, model, api_key, prompt, max_tokens, timeout)
            for _ in range(requests)
        ]
        for future in as_completed(futures):
            results.append(future.result())
    wall = time.perf_counter() - started

    latencies = [r["latency_s"] for r in results]
    total_completion_tokens = sum(r["completion_tokens"] or 0 for r in results)

    return {
        "base_url": base_url,
        "model": model,
        "requests": requests,
        "concurrency": concurrency,
        "wall_s": round(wall, 4),
        "latency": {
            "min_s": round(min(latencies), 4),
            "avg_s": round(statistics.mean(latencies), 4),
            "p95_s": round(sorted(latencies)[max(0, int(len(latencies) * 0.95) - 1)], 4),
            "max_s": round(max(latencies), 4),
        },
        "completion_tokens_total": total_completion_tokens,
        "completion_tokens_per_s": round(total_completion_tokens / wall, 2) if wall > 0 else 0,
        "raw": results,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Benchmark OpenAI-compatible LLM endpoints")
    parser.add_argument("--base-url", required=True, help="Base URL ending with /v1")
    parser.add_argument("--model", required=True)
    parser.add_argument("--prompt", default="Write four concise bullet points about why low-latency code completion matters.")
    parser.add_argument("--max-tokens", type=int, default=192)
    parser.add_argument("--timeout", type=int, default=180)
    parser.add_argument("--concurrency", type=int, default=2)
    parser.add_argument("--requests", type=int, default=6)
    parser.add_argument("--api-key-env", default="LITELLM_API_KEY")
    args = parser.parse_args()

    api_key = os.environ.get(args.api_key_env, "")
    result = run_case(
        base_url=args.base_url,
        model=args.model,
        api_key=api_key,
        prompt=args.prompt,
        max_tokens=args.max_tokens,
        timeout=args.timeout,
        concurrency=args.concurrency,
        requests=args.requests,
    )
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
