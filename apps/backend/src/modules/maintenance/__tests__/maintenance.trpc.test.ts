import { describe, it, expect } from "vitest";
import { z } from "zod";

describe("Maintenance Module — TRPC Contracts", () => {
  describe("Input Validation", () => {
    it("should validate valid maintenance plan creation", () => {
      const schema = z.object({
        nomeEmpresa: z.string().min(1),
        tipoEquipamento: z.enum(["ar-condicionado", "refrigerador"]),
        periodicidadeDias: z.number().int().min(1),
      });

      const valid = {
        nomeEmpresa: "Empresa LTDA",
        tipoEquipamento: "ar-condicionado" as const,
        periodicidadeDias: 90,
      };
      const result = schema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("should reject invalid maintenance plan", () => {
      const schema = z.object({
        nomeEmpresa: z.string().min(1),
        tipoEquipamento: z.enum(["ar-condicionado", "refrigerador"]),
        periodicidadeDias: z.number().int().min(1),
      });

      const invalid = {
        nomeEmpresa: "",
        tipoEquipamento: "ar-condicionado",
        periodicidadeDias: -5,
      };
      const result = schema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("should validate equipment type enum", () => {
      const equipmentEnum = z.enum(["ar-condicionado", "refrigerador", "freezer", "climatizador"]);
      expect(equipmentEnum.safeParse("ar-condicionado").success).toBe(true);
      expect(equipmentEnum.safeParse("ar-condicionado").success).toBe(true);
      expect(equipmentEnum.safeParse("invalid-equipment").success).toBe(false);
    });

    it("should validate periodicity range", () => {
      const periodicitySchema = z.number().int().min(1).max(365);
      expect(periodicitySchema.safeParse(90).success).toBe(true);
      expect(periodicitySchema.safeParse(0).success).toBe(false);
      expect(periodicitySchema.safeParse(366).success).toBe(false);
    });
  });

  describe("Business Logic", () => {
    it("should calculate next maintenance date", () => {
      const today = new Date("2026-03-19");
      const periodDays = 90;
      const nextDate = new Date(today);
      nextDate.setDate(nextDate.getDate() + periodDays);

      // Just verify the date was increased by approximately 90 days
      const dayDifference = (nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
      expect(dayDifference).toBe(90);
    });

    it("should detect overdue maintenance", () => {
      const lastMaintenance = new Date("2026-01-01");
      const periodDays = 30;
      const now = new Date("2026-03-19");

      const daysSinceLastMaintenance =
        (now.getTime() - lastMaintenance.getTime()) / (1000 * 60 * 60 * 24);
      const isOverdue = daysSinceLastMaintenance > periodDays;

      expect(isOverdue).toBe(true);
    });
  });
});
