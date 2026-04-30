import {
	SessionSecurityLevel,
	validateSessionSecurity,
} from "../sessionSecurity.middleware";
import * as ipChecker from "@backend/modules/api-gateway/utils/ipChecker.utils";
import * as requestMeta from "@backend/utils/request-metadata.utils";
import { describe, expect, it, vi } from "vitest";

// Mock IP checker and request metadata utils
vi.mock("@backend/modules/api-gateway/utils/ipChecker.utils", () => ({
	areSameSubnet: vi.fn(() => false),
}));

vi.mock("@backend/utils/request-metadata.utils", () => ({
	generateDeviceFingerprint: vi.fn(() => "fingerprint-abc"),
	getClientIpAddress: vi.fn(() => "192.168.1.100"),
}));

function createRequest(sessionData?: any): any {
	return {
		session: sessionData,
		log: { warn: vi.fn(), info: vi.fn() },
	};
}

describe("validateSessionSecurity", () => {
	it("returns allow when no session exists", () => {
		const req = createRequest();
		const result = validateSessionSecurity(req, SessionSecurityLevel.STRICT);
		expect(result.action).toBe("allow");
		expect(result.isValid).toBe(true);
	});

	it("returns allow when session has no user", () => {
		const req = createRequest({ metadata: { deviceFingerprint: "fp" } });
		const result = validateSessionSecurity(req, SessionSecurityLevel.STRICT);
		expect(result.action).toBe("allow");
	});

	it("returns allow when fingerprint and IP match", () => {
		const req = createRequest({
			user: { userId: "u1", email: "a@b.com" },
			metadata: {
				deviceFingerprint: "fingerprint-abc",
				ipAddress: "192.168.1.100",
			},
		});
		const result = validateSessionSecurity(req, SessionSecurityLevel.MODERATE);
		expect(result.action).toBe("allow");
		expect(result.isSuspicious).toBe(false);
	});

	it("blocks on fingerprint mismatch in MODERATE mode", () => {
		const req = createRequest({
			user: { userId: "u1", email: "a@b.com" },
			metadata: {
				deviceFingerprint: "fingerprint-old",
				ipAddress: "192.168.1.100",
			},
		});
		const result = validateSessionSecurity(req, SessionSecurityLevel.MODERATE);
		expect(result.action).toBe("block");
		expect(result.isValid).toBe(false);
		expect(result.reasons).toContain("Device fingerprint mismatch");
	});

	it("warns on IP change only in MODERATE mode", () => {
		const areSameSubnet = vi.mocked(ipChecker.areSameSubnet);
		areSameSubnet.mockReturnValue(false);

		const req = createRequest({
			user: { userId: "u1", email: "a@b.com" },
			metadata: {
				deviceFingerprint: "fingerprint-abc",
				ipAddress: "10.0.0.1",
			},
		});
		const result = validateSessionSecurity(req, SessionSecurityLevel.MODERATE);
		expect(result.action).toBe("warn");
		expect(result.isValid).toBe(true);
		expect(result.reasons.some((r: string) => r.includes("IP address changed"))).toBe(true);
	});

	it("allows on IP change in same subnet in MODERATE mode", () => {
		const areSameSubnet = vi.mocked(ipChecker.areSameSubnet);
		areSameSubnet.mockReturnValue(true);

		const req = createRequest({
			user: { userId: "u1", email: "a@b.com" },
			metadata: {
				deviceFingerprint: "fingerprint-abc",
				ipAddress: "10.0.0.1",
			},
		});
		const result = validateSessionSecurity(req, SessionSecurityLevel.MODERATE);
		expect(result.action).toBe("allow");
	});

	it("blocks any suspicious activity in STRICT mode", () => {
		const generateDeviceFingerprint = vi.mocked(requestMeta.generateDeviceFingerprint);
		generateDeviceFingerprint.mockReturnValue("fingerprint-evil");
		const req = createRequest({
			user: { userId: "u1", email: "a@b.com" },
			metadata: {
				deviceFingerprint: "fingerprint-abc",
				ipAddress: "10.0.0.1",
			},
		});
		const result = validateSessionSecurity(req, SessionSecurityLevel.STRICT);
		expect(result.action).toBe("block");
		expect(result.isValid).toBe(false);
	});

	it("allows everything in LENIENT mode even when suspicious", () => {
		const req = createRequest({
			user: { userId: "u1", email: "a@b.com" },
			metadata: {
				deviceFingerprint: "fingerprint-old",
				ipAddress: "10.0.0.1",
			},
		});
		const result = validateSessionSecurity(req, SessionSecurityLevel.LENIENT);
		expect(result.action).toBe("allow");
		expect(result.isValid).toBe(true);
	});
});
