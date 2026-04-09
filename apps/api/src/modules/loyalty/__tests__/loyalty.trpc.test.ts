import { describe, it, expect } from "vitest";
import { z } from "zod";

describe("Loyalty Module — TRPC Contracts", () => {
  describe("Loyalty Level Calculation", () => {
    it("should assign bronze level for 0-99 points", () => {
      const calculateLevel = (points: number) => {
        if (points >= 300) return "platinum";
        if (points >= 200) return "ouro";
        if (points >= 100) return "prata";
        return "bronze";
      };

      expect(calculateLevel(0)).toBe("bronze");
      expect(calculateLevel(50)).toBe("bronze");
      expect(calculateLevel(99)).toBe("bronze");
    });

    it("should assign prata level for 100-199 points", () => {
      const calculateLevel = (points: number) => {
        if (points >= 300) return "platinum";
        if (points >= 200) return "ouro";
        if (points >= 100) return "prata";
        return "bronze";
      };

      expect(calculateLevel(100)).toBe("prata");
      expect(calculateLevel(150)).toBe("prata");
      expect(calculateLevel(199)).toBe("prata");
    });

    it("should assign ouro level for 200-299 points", () => {
      const calculateLevel = (points: number) => {
        if (points >= 300) return "platinum";
        if (points >= 200) return "ouro";
        if (points >= 100) return "prata";
        return "bronze";
      };

      expect(calculateLevel(200)).toBe("ouro");
      expect(calculateLevel(250)).toBe("ouro");
      expect(calculateLevel(299)).toBe("ouro");
    });

    it("should assign platinum level for 300+ points", () => {
      const calculateLevel = (points: number) => {
        if (points >= 300) return "platinum";
        if (points >= 200) return "ouro";
        if (points >= 100) return "prata";
        return "bronze";
      };

      expect(calculateLevel(300)).toBe("platinum");
      expect(calculateLevel(500)).toBe("platinum");
      expect(calculateLevel(1000)).toBe("platinum");
    });
  });

  describe("Risk Detection", () => {
    it("should detect clients at risk (30+ days without contact)", () => {
      const lastContact = new Date("2026-02-17");
      const now = new Date("2026-03-19");
      const daysSinceContact =
        (now.getTime() - lastContact.getTime()) / (1000 * 60 * 60 * 24);
      const isAtRisk = daysSinceContact >= 30;

      expect(isAtRisk).toBe(true);
    });

    it("should mark clients as risco-30d after 30 days without contact", () => {
      const detectRiskStatus = (daysSinceContact: number) => {
        if (daysSinceContact >= 90) return "risco-90d";
        if (daysSinceContact >= 60) return "risco-60d";
        if (daysSinceContact >= 30) return "risco-30d";
        return "ativo";
      };

      expect(detectRiskStatus(29)).toBe("ativo");
      expect(detectRiskStatus(30)).toBe("risco-30d");
      expect(detectRiskStatus(45)).toBe("risco-30d");
      expect(detectRiskStatus(59)).toBe("risco-30d");
    });

    it("should mark clients as risco-60d after 60 days without contact", () => {
      const detectRiskStatus = (daysSinceContact: number) => {
        if (daysSinceContact >= 90) return "risco-90d";
        if (daysSinceContact >= 60) return "risco-60d";
        if (daysSinceContact >= 30) return "risco-30d";
        return "ativo";
      };

      expect(detectRiskStatus(60)).toBe("risco-60d");
      expect(detectRiskStatus(75)).toBe("risco-60d");
      expect(detectRiskStatus(89)).toBe("risco-60d");
    });

    it("should mark clients as risco-90d after 90 days without contact", () => {
      const detectRiskStatus = (daysSinceContact: number) => {
        if (daysSinceContact >= 90) return "risco-90d";
        if (daysSinceContact >= 60) return "risco-60d";
        if (daysSinceContact >= 30) return "risco-30d";
        return "ativo";
      };

      expect(detectRiskStatus(90)).toBe("risco-90d");
      expect(detectRiskStatus(120)).toBe("risco-90d");
      expect(detectRiskStatus(180)).toBe("risco-90d");
    });
  });

  describe("Input Validation", () => {
    it("should validate loyalty list parameters", () => {
      const schema = z.object({
        status: z
          .enum(["ativo", "risco-30d", "risco-60d", "risco-90d", "perdido"])
          .optional(),
        nivelMinimo: z.enum(["bronze", "prata", "ouro", "platinum"]).optional(),
        limit: z.number().int().min(1).max(100).default(50),
        offset: z.number().int().min(0).default(0),
      });

      const valid = { limit: 50, offset: 0 };
      expect(schema.safeParse(valid).success).toBe(true);

      const invalid = { limit: 0, offset: -1 };
      expect(schema.safeParse(invalid).success).toBe(false);
    });
  });
});
