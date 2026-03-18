import { app } from "@backend/app";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

beforeAll(async () => {
	await app.ready();
});

afterAll(async () => {
	await app.close();
});

describe("GET /", () => {
	it("returns 200 with live message", async () => {
		const res = await app.inject({ method: "GET", url: "/" });
		expect(res.statusCode).toBe(200);
		expect(res.json()).toMatchObject({ message: "Backend is live." });
	});
});

describe("GET /health", () => {
	it("returns 200 with status ok", async () => {
		const res = await app.inject({ method: "GET", url: "/health" });
		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.status).toBe("ok");
		expect(body.timestamp).toBeDefined();
		expect(new Date(body.timestamp).getTime()).not.toBeNaN();
	});
});

describe("404 handler", () => {
	it("returns 404 for unknown routes", async () => {
		const res = await app.inject({ method: "GET", url: "/nonexistent-route" });
		expect(res.statusCode).toBe(404);
		expect(res.json()).toMatchObject({
			statusCode: 404,
			error: "Not Found",
			message: "Route not found",
		});
	});

	it("returns 404 for unknown POST routes", async () => {
		const res = await app.inject({ method: "POST", url: "/does-not-exist" });
		expect(res.statusCode).toBe(404);
	});
});
