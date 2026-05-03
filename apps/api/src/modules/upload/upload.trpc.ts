import { db } from '@backend/db/db';
import { protectedProcedure, trpcRouter } from '@backend/trpc';
import { uploadToDisk } from '@backend/lib/upload';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

const uploadPhotoInputZod = z.object({
  file: z.string(), // base64
  filename: z.string(),
  mimeType: z.string().optional(),
  equipmentId: z.string().uuid().optional(),
  scheduleId: z.string().uuid().optional(),
});

// @ts-ignore TS2742 — pqb internal type inference not portable
export const uploadRouter = trpcRouter({
  uploadPhoto: protectedProcedure
    .input(uploadPhotoInputZod)
    .mutation(async ({ ctx, input }) => {
      const { teamId } = ctx.user;
      if (!teamId)
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Team não encontrado no contexto' });

      // Verify equipment belongs to team if provided
      if (input.equipmentId) {
        const equipment = await db.equipment.findOptional(input.equipmentId);
        if (!equipment)
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Equipamento não encontrado' });
        const cliente = await db.clients.findOptional(equipment.clienteId);
        if (!cliente || cliente.teamId !== teamId)
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Acesso negado' });
      }

      // Verify schedule belongs to team if provided
      if (input.scheduleId) {
        const schedule = await db.maintenanceSchedules.findOptional(input.scheduleId);
        if (!schedule)
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Agendamento não encontrado' });
        const plan = await db.maintenancePlans.findOptional(schedule.planoManutencaoId);
        if (plan?.clienteId) {
          const cliente = await db.clients.findOptional(plan.clienteId);
          if (!cliente || cliente.teamId !== teamId)
            throw new TRPCError({ code: 'FORBIDDEN', message: 'Acesso negado' });
        }
      }

      const url = await uploadToDisk({
        base64: input.file,
        filename: input.filename,
        teamId,
        folder: 'photos',
        mimeType: input.mimeType,
      });

      return { url };
    }),

  uploadSignature: protectedProcedure
    .input(
      z.object({
        file: z.string(), // base64 PNG
        filename: z.string().default('signature.png'),
        type: z.enum(['technician', 'client']),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { teamId } = ctx.user;
      if (!teamId)
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Team não encontrado no contexto' });

      const url = await uploadToDisk({
        base64: input.file,
        filename: input.filename,
        teamId,
        folder: 'signatures',
        mimeType: 'image/png',
      });

      return { url, type: input.type };
    }),
});