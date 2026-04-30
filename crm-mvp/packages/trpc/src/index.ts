import { initTRPC } from '@trpc/server';
import { z } from 'zod';

const t = initTRPC.create();

export const router = t.router;
export const publicProcedure = t.procedure;

// Input helpers
export const uuidSchema = z.string().uuid();
export const paginationSchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
});

// Placeholder router shape — será sobrescrito pelo TrpcRouter no backend
export const appRouter = router({
  health: publicProcedure.query(() => ({ status: 'ok', time: new Date().toISOString() })),
  dashboard: router({
    getStats: publicProcedure.query(() => ({ totalClients: 0, activeLeads: 0, activeContracts: 0, pendingReminders: 0, todaySchedules: 0 })),
    getRecentItems: publicProcedure.query(() => ({ recentSchedules: [], recentReminders: [], recentContracts: [] })),
  }),
  leads: router({
    list: publicProcedure.input(z.object({ status: z.string().optional(), source: z.string().optional(), search: z.string().optional() }).optional()).query(() => []),
    getById: publicProcedure.input(z.object({ id: z.string().uuid() })).query(() => null),
    create: publicProcedure.input(z.object({ name: z.string(), email: z.string().optional(), phone: z.string().optional(), source: z.string().optional(), status: z.string().optional(), responsibleId: z.string().uuid().optional(), estimatedValue: z.number().optional(), notes: z.string().optional(), teamId: z.string().uuid().optional() })).mutation(() => ({})),
    update: publicProcedure.input(z.object({ id: z.string().uuid(), name: z.string().optional(), email: z.string().optional(), phone: z.string().optional(), source: z.string().optional(), status: z.string().optional(), responsibleId: z.string().uuid().optional(), estimatedValue: z.number().optional(), notes: z.string().optional() })).mutation(() => ({})),
    delete: publicProcedure.input(z.object({ id: z.string().uuid() })).mutation(() => ({ id: '', deleted: true })),
    convertToClient: publicProcedure.input(z.object({ id: z.string().uuid() })).mutation(() => ({ leadId: '', clientId: '' })),
  }),
  clients: router({
    list: publicProcedure.input(z.object({ status: z.string().optional(), type: z.string().optional(), search: z.string().optional() }).optional()).query(() => []),
    getById: publicProcedure.input(z.object({ id: z.string().uuid() })).query(() => null),
    create: publicProcedure.input(z.object({ name: z.string(), type: z.string().optional(), document: z.string().optional(), email: z.string().optional(), phone: z.string().optional(), address: z.string().optional(), tags: z.array(z.string()).optional(), status: z.string().optional(), teamId: z.string().uuid().optional() })).mutation(() => ({})),
    update: publicProcedure.input(z.object({ id: z.string().uuid(), name: z.string().optional(), type: z.string().optional(), document: z.string().optional(), email: z.string().optional(), phone: z.string().optional(), address: z.string().optional(), tags: z.array(z.string()).optional(), status: z.string().optional() })).mutation(() => ({})),
    delete: publicProcedure.input(z.object({ id: z.string().uuid() })).mutation(() => ({ id: '', deleted: true })),
  }),
  schedules: router({
    list: publicProcedure.input(z.object({ status: z.string().optional(), type: z.string().optional(), clientId: z.string().uuid().optional() }).optional()).query(() => []),
    getById: publicProcedure.input(z.object({ id: z.string().uuid() })).query(() => null),
    create: publicProcedure.input(z.object({ clientId: z.string().uuid(), dateTime: z.string(), type: z.string(), technicianId: z.string().uuid().optional(), status: z.string().optional(), notes: z.string().optional(), teamId: z.string().uuid().optional() })).mutation(() => ({})),
    update: publicProcedure.input(z.object({ id: z.string().uuid(), dateTime: z.string().optional(), type: z.string().optional(), technicianId: z.string().uuid().optional(), status: z.string().optional(), notes: z.string().optional() })).mutation(() => ({})),
    delete: publicProcedure.input(z.object({ id: z.string().uuid() })).mutation(() => ({ id: '', deleted: true })),
  }),
  contracts: router({
    list: publicProcedure.input(z.object({ status: z.string().optional(), type: z.string().optional(), clientId: z.string().uuid().optional() }).optional()).query(() => []),
    getById: publicProcedure.input(z.object({ id: z.string().uuid() })).query(() => null),
    create: publicProcedure.input(z.object({ clientId: z.string().uuid(), type: z.string(), value: z.number(), frequency: z.string(), startDate: z.string(), endDate: z.string(), status: z.string().optional(), teamId: z.string().uuid().optional() })).mutation(() => ({})),
    update: publicProcedure.input(z.object({ id: z.string().uuid(), type: z.string().optional(), value: z.number().optional(), frequency: z.string().optional(), startDate: z.string().optional(), endDate: z.string().optional(), status: z.string().optional() })).mutation(() => ({})),
    delete: publicProcedure.input(z.object({ id: z.string().uuid() })).mutation(() => ({ id: '', deleted: true })),
  }),
  reminders: router({
    list: publicProcedure.input(z.object({ status: z.string().optional(), type: z.string().optional(), clientId: z.string().uuid().optional() }).optional()).query(() => []),
    getById: publicProcedure.input(z.object({ id: z.string().uuid() })).query(() => null),
    create: publicProcedure.input(z.object({ clientId: z.string().uuid(), title: z.string(), type: z.string(), dueDate: z.string(), status: z.string().optional(), teamId: z.string().uuid().optional() })).mutation(() => ({})),
    update: publicProcedure.input(z.object({ id: z.string().uuid(), title: z.string().optional(), type: z.string().optional(), dueDate: z.string().optional(), status: z.string().optional() })).mutation(() => ({})),
    delete: publicProcedure.input(z.object({ id: z.string().uuid() })).mutation(() => ({ id: '', deleted: true })),
    complete: publicProcedure.input(z.object({ id: z.string().uuid() })).mutation(() => ({})),
  }),
});

export type AppRouter = typeof appRouter;
