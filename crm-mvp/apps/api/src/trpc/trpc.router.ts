import { Injectable } from '@nestjs/common';
import { initTRPC } from '@trpc/server';
import { z } from 'zod';
import { DashboardService } from '../dashboard/dashboard.service';
import { LeadsService } from '../leads/leads.service';
import { ClientsService } from '../clients/clients.service';
import { SchedulesService } from '../schedule/schedules.service';
import { ContractsService } from '../contracts/contracts.service';
import { RemindersService } from '../reminders/reminders.service';
import { UsersService } from '../users/users.service';
import { EquipamentosService } from '../equipamentos/equipamentos.service';
import { ServiceOrdersService } from '../service-orders/service-orders.service';
import { CompaniesService } from '../companies/companies.service';
import { TeamsService } from '../teams/teams.service';

const t = initTRPC.create();

@Injectable()
export class TrpcRouter {
  constructor(
    private dashboardService: DashboardService,
    private leadsService: LeadsService,
    private clientsService: ClientsService,
    private schedulesService: SchedulesService,
    private contractsService: ContractsService,
    private remindersService: RemindersService,
    private usersService: UsersService,
    private equipamentosService: EquipamentosService,
    private serviceOrdersService: ServiceOrdersService,
    private companiesService: CompaniesService,
    private teamsService: TeamsService,
  ) {}

  get appRouter() {
    return t.router({
      health: t.procedure.query(() => ({ status: 'ok', time: new Date().toISOString() })),

      dashboard: t.router({
        getStats: t.procedure.query(() => this.dashboardService.getStats()),
        getRecentItems: t.procedure.query(() => this.dashboardService.getRecentItems()),
      }),

      leads: t.router({
        list: t.procedure
          .input(z.object({ status: z.string().optional(), source: z.string().optional(), search: z.string().optional() }).optional())
          .query(({ input }) => this.leadsService.findAll(input)),
        getById: t.procedure.input(z.object({ id: z.string().uuid() })).query(({ input }) => this.leadsService.findOne(input.id)),
        create: t.procedure
          .input(z.object({
            name: z.string().min(1),
            email: z.string().email().optional(),
            phone: z.string().optional(),
            source: z.string().optional(),
            status: z.enum(['novo', 'contato', 'qualificado', 'proposta', 'negociacao', 'ganho', 'perdido']).default('novo'),
            responsibleId: z.string().uuid().optional(),
            estimatedValue: z.number().optional(),
            notes: z.string().optional(),
            teamId: z.string().uuid().optional(),
          }))
          .mutation(({ input }) => this.leadsService.create(input)),
        update: t.procedure
          .input(z.object({
            id: z.string().uuid(),
            name: z.string().min(1).optional(),
            email: z.string().email().optional(),
            phone: z.string().optional(),
            source: z.string().optional(),
            status: z.enum(['novo', 'contato', 'qualificado', 'proposta', 'negociacao', 'ganho', 'perdido']).optional(),
            responsibleId: z.string().uuid().optional(),
            estimatedValue: z.number().optional(),
            notes: z.string().optional(),
          }))
          .mutation(({ input }) => this.leadsService.update(input.id, input)),
        delete: t.procedure.input(z.object({ id: z.string().uuid() })).mutation(({ input }) => this.leadsService.remove(input.id)),
        convertToClient: t.procedure.input(z.object({ id: z.string().uuid() })).mutation(({ input }) => this.leadsService.convertToClient(input.id)),
      }),

      clients: t.router({
        list: t.procedure
          .input(z.object({ status: z.string().optional(), type: z.string().optional(), search: z.string().optional() }).optional())
          .query(({ input }) => this.clientsService.findAll(input)),
        getById: t.procedure.input(z.object({ id: z.string().uuid() })).query(({ input }) => this.clientsService.findOne(input.id)),
        create: t.procedure
          .input(z.object({
            name: z.string().min(1),
            type: z.enum(['pf', 'pj']).default('pf'),
            document: z.string().optional(),
            email: z.string().email().optional(),
            phone: z.string().optional(),
            address: z.string().optional(),
            tags: z.array(z.string()).optional(),
            status: z.enum(['ativo', 'inativo']).default('ativo'),
            teamId: z.string().uuid().optional(),
          }))
          .mutation(({ input }) => this.clientsService.create(input)),
        update: t.procedure
          .input(z.object({
            id: z.string().uuid(),
            name: z.string().min(1).optional(),
            type: z.enum(['pf', 'pj']).optional(),
            document: z.string().optional(),
            email: z.string().email().optional(),
            phone: z.string().optional(),
            address: z.string().optional(),
            tags: z.array(z.string()).optional(),
            status: z.enum(['ativo', 'inativo']).optional(),
          }))
          .mutation(({ input }) => this.clientsService.update(input.id, input)),
        delete: t.procedure.input(z.object({ id: z.string().uuid() })).mutation(({ input }) => this.clientsService.remove(input.id)),
      }),

      schedules: t.router({
        list: t.procedure
          .input(z.object({ status: z.string().optional(), type: z.string().optional(), clientId: z.string().uuid().optional() }).optional())
          .query(({ input }) => this.schedulesService.findAll(input)),
        getById: t.procedure.input(z.object({ id: z.string().uuid() })).query(({ input }) => this.schedulesService.findOne(input.id)),
        create: t.procedure
          .input(z.object({
            clientId: z.string().uuid(),
            dateTime: z.string().datetime(),
            type: z.enum(['instalacao', 'manutencao', 'visita_tecnica', 'emergencia']),
            technicianId: z.string().uuid().optional(),
            status: z.enum(['agendado', 'confirmado', 'em_andamento', 'concluido', 'cancelado']).default('agendado'),
            notes: z.string().optional(),
            teamId: z.string().uuid().optional(),
          }))
          .mutation(({ input }) => this.schedulesService.create({ ...input, dateTime: new Date(input.dateTime) })),
        update: t.procedure
          .input(z.object({
            id: z.string().uuid(),
            dateTime: z.string().datetime().optional(),
            type: z.enum(['instalacao', 'manutencao', 'visita_tecnica', 'emergencia']).optional(),
            technicianId: z.string().uuid().optional(),
            status: z.enum(['agendado', 'confirmado', 'em_andamento', 'concluido', 'cancelado']).optional(),
            notes: z.string().optional(),
          }))
          .mutation(({ input }) => {
            const { id, dateTime, ...rest } = input;
            const data: any = { ...rest };
            if (dateTime) data.dateTime = new Date(dateTime);
            return this.schedulesService.update(id, data);
          }),
        delete: t.procedure.input(z.object({ id: z.string().uuid() })).mutation(({ input }) => this.schedulesService.remove(input.id)),
      }),

      contracts: t.router({
        list: t.procedure
          .input(z.object({ status: z.string().optional(), type: z.string().optional(), clientId: z.string().uuid().optional() }).optional())
          .query(({ input }) => this.contractsService.findAll(input)),
        getById: t.procedure.input(z.object({ id: z.string().uuid() })).query(({ input }) => this.contractsService.findOne(input.id)),
        create: t.procedure
          .input(z.object({
            clientId: z.string().uuid(),
            type: z.enum(['comercial', 'manutencao', 'residencial']),
            value: z.number().min(0),
            frequency: z.enum(['mensal', 'trimestral', 'semestral', 'anual']),
            startDate: z.string(),
            endDate: z.string(),
            status: z.enum(['rascunho', 'ativo', 'suspenso', 'encerrado', 'cancelado']).default('rascunho'),
            teamId: z.string().uuid().optional(),
          }))
          .mutation(({ input }) => this.contractsService.create(input)),
        update: t.procedure
          .input(z.object({
            id: z.string().uuid(),
            type: z.enum(['comercial', 'manutencao', 'residencial']).optional(),
            value: z.number().min(0).optional(),
            frequency: z.enum(['mensal', 'trimestral', 'semestral', 'anual']).optional(),
            startDate: z.string().optional(),
            endDate: z.string().optional(),
            status: z.enum(['rascunho', 'ativo', 'suspenso', 'encerrado', 'cancelado']).optional(),
          }))
          .mutation(({ input }) => this.contractsService.update(input.id, input)),
        delete: t.procedure.input(z.object({ id: z.string().uuid() })).mutation(({ input }) => this.contractsService.remove(input.id)),
      }),

      reminders: t.router({
        list: t.procedure
          .input(z.object({ status: z.string().optional(), type: z.string().optional(), clientId: z.string().uuid().optional() }).optional())
          .query(({ input }) => this.remindersService.findAll(input)),
        getById: t.procedure.input(z.object({ id: z.string().uuid() })).query(({ input }) => this.remindersService.findOne(input.id)),
        create: t.procedure
          .input(z.object({
            clientId: z.string().uuid(),
            title: z.string().min(1),
            type: z.enum(['ligacao', 'email', 'visita', 'renovacao']),
            dueDate: z.string().datetime(),
            status: z.enum(['pendente', 'concluido', 'cancelado']).default('pendente'),
            teamId: z.string().uuid().optional(),
          }))
          .mutation(({ input }) => this.remindersService.create({ ...input, dueDate: new Date(input.dueDate) })),
        update: t.procedure
          .input(z.object({
            id: z.string().uuid(),
            title: z.string().min(1).optional(),
            type: z.enum(['ligacao', 'email', 'visita', 'renovacao']).optional(),
            dueDate: z.string().datetime().optional(),
            status: z.enum(['pendente', 'concluido', 'cancelado']).optional(),
          }))
          .mutation(({ input }) => {
            const { id, dueDate, ...rest } = input;
            const data: any = { ...rest };
            if (dueDate) data.dueDate = new Date(dueDate);
            return this.remindersService.update(id, data);
          }),
        delete: t.procedure.input(z.object({ id: z.string().uuid() })).mutation(({ input }) => this.remindersService.remove(input.id)),
        complete: t.procedure.input(z.object({ id: z.string().uuid() })).mutation(({ input }) => this.remindersService.complete(input.id)),
      }),

      equipamentos: t.router({
        list: t.procedure
          .input(z.object({ status: z.string().optional(), type: z.string().optional(), clientId: z.string().uuid().optional(), search: z.string().optional() }).optional())
          .query(({ input }) => this.equipamentosService.findAll(input)),
        getById: t.procedure.input(z.object({ id: z.string().uuid() })).query(({ input }) => this.equipamentosService.findOne(input.id)),
        create: t.procedure
          .input(z.object({
            name: z.string().min(1),
            serialNumber: z.string().optional(),
            type: z.enum(['ar_condicionado', 'refrigerador', 'freezer', 'split', 'janela', 'de_chao', 'portatil', 'outro']).default('ar_condicionado'),
            brand: z.string().optional(),
            model: z.string().optional(),
            clientId: z.string().uuid().optional(),
            subdomain: z.string().optional(),
            status: z.enum(['ativo', 'em_manutencao', 'inativo']).default('ativo'),
            installationDate: z.string().optional(),
            notes: z.string().optional(),
            teamId: z.string().uuid().optional(),
          }))
          .mutation(({ input }) => this.equipamentosService.create(input)),
        update: t.procedure
          .input(z.object({
            id: z.string().uuid(),
            name: z.string().min(1).optional(),
            serialNumber: z.string().optional(),
            type: z.enum(['ar_condicionado', 'refrigerador', 'freezer', 'split', 'janela', 'de_chao', 'portatil', 'outro']).optional(),
            brand: z.string().optional(),
            model: z.string().optional(),
            clientId: z.string().uuid().optional(),
            subdomain: z.string().optional(),
            status: z.enum(['ativo', 'em_manutencao', 'inativo']).optional(),
            installationDate: z.string().optional(),
            notes: z.string().optional(),
          }))
          .mutation(({ input }) => this.equipamentosService.update(input.id, input)),
        delete: t.procedure.input(z.object({ id: z.string().uuid() })).mutation(({ input }) => this.equipamentosService.remove(input.id)),
      }),

      serviceOrders: t.router({
        list: t.procedure
          .input(z.object({
            status: z.string().optional(),
            type: z.string().optional(),
            priority: z.string().optional(),
            clientId: z.string().uuid().optional(),
            equipamentoId: z.string().uuid().optional(),
            technicianId: z.string().uuid().optional(),
            search: z.string().optional(),
          }).optional())
          .query(({ input }) => this.serviceOrdersService.findAll(input)),
        getById: t.procedure.input(z.object({ id: z.string().uuid() })).query(({ input }) => this.serviceOrdersService.findOne(input.id)),
        create: t.procedure
          .input(z.object({
            title: z.string().min(1),
            description: z.string().optional(),
            clientId: z.string().uuid().optional(),
            equipamentoId: z.string().uuid().optional(),
            technicianId: z.string().uuid().optional(),
            type: z.enum(['instalacao', 'manutencao', 'reparo', 'visita_tecnica', 'emergencia']).default('manutencao'),
            priority: z.enum(['baixa', 'media', 'alta', 'urgente']).default('media'),
            status: z.enum(['orcamento', 'aprovada', 'em_andamento', 'concluida', 'cancelada']).default('orcamento'),
            scheduledDate: z.string().datetime().optional(),
            cost: z.number().optional(),
            notes: z.string().optional(),
            teamId: z.string().uuid().optional(),
          }))
          .mutation(({ input }) => {
            const { scheduledDate, ...rest } = input;
            const data: any = { ...rest };
            if (scheduledDate) data.scheduledDate = new Date(scheduledDate);
            return this.serviceOrdersService.create(data);
          }),
        update: t.procedure
          .input(z.object({
            id: z.string().uuid(),
            title: z.string().min(1).optional(),
            description: z.string().optional(),
            clientId: z.string().uuid().optional(),
            equipamentoId: z.string().uuid().optional(),
            technicianId: z.string().uuid().optional(),
            type: z.enum(['instalacao', 'manutencao', 'reparo', 'visita_tecnica', 'emergencia']).optional(),
            priority: z.enum(['baixa', 'media', 'alta', 'urgente']).optional(),
            status: z.enum(['orcamento', 'aprovada', 'em_andamento', 'concluida', 'cancelada']).optional(),
            scheduledDate: z.string().datetime().optional(),
            cost: z.number().optional(),
            notes: z.string().optional(),
          }))
          .mutation(({ input }) => {
            const { id, scheduledDate, ...rest } = input;
            const data: any = { ...rest };
            if (scheduledDate) data.scheduledDate = new Date(scheduledDate);
            return this.serviceOrdersService.update(id, data);
          }),
        delete: t.procedure.input(z.object({ id: z.string().uuid() })).mutation(({ input }) => this.serviceOrdersService.remove(input.id)),
        complete: t.procedure
          .input(z.object({
            id: z.string().uuid(),
            cost: z.number().optional(),
            notes: z.string().optional(),
          }))
          .mutation(({ input }) => this.serviceOrdersService.complete(input.id, input.cost, input.notes)),
        startExecution: t.procedure
          .input(z.object({ id: z.string().uuid() }))
          .mutation(({ input }) => this.serviceOrdersService.startExecution(input.id)),
        updateExecution: t.procedure
          .input(z.object({
            id: z.string().uuid(),
            checklist: z.array(z.object({
              id: z.string(),
              label: z.string(),
              checked: z.boolean(),
            })).optional(),
            photos: z.array(z.object({
              id: z.string(),
              data: z.string(),
              caption: z.string(),
              takenAt: z.string(),
            })).optional(),
            signature: z.string().optional(),
          }))
          .mutation(({ input }) => {
            const { id, ...data } = input;
            return this.serviceOrdersService.updateExecution(id, data as any);
          }),
        submitExecution: t.procedure
          .input(z.object({
            id: z.string().uuid(),
            cost: z.number().optional(),
            notes: z.string().optional(),
          }))
          .mutation(({ input }) => {
            const { id, ...data } = input;
            return this.serviceOrdersService.submitExecution(id, data);
          }),
      }),

      companies: t.router({
        get: t.procedure.query(() => this.companiesService.find()),
        upsert: t.procedure
          .input(z.object({
            name: z.string().min(1).optional(),
            cnpj: z.string().optional(),
            phone: z.string().optional(),
            address: z.string().optional(),
            logoUrl: z.string().optional(),
            primaryColor: z.string().optional(),
            secondaryColor: z.string().optional(),
            responsibleSignature: z.string().optional(),
          }))
          .mutation(({ input }) => this.companiesService.upsert(input)),
      }),

      users: t.router({
        list: t.procedure.query(() => this.usersService.findAll()),
        getById: t.procedure.input(z.object({ id: z.string().uuid() })).query(({ input }) => this.usersService.findOne(input.id)),
        create: t.procedure
          .input(z.object({
            name: z.string().min(1),
            email: z.string().min(1),
            password: z.string().optional(),
            role: z.enum(['admin', 'manager', 'technician', 'user']).default('user'),
            teamId: z.string().uuid().optional(),
          }))
          .mutation(({ input }) => this.usersService.create({
            name: input.name,
            email: input.email,
            password: input.password,
            role: input.role,
            teamId: input.teamId,
          })),
        update: t.procedure
          .input(z.object({
            id: z.string().uuid(),
            name: z.string().min(1).optional(),
            email: z.string().min(1).optional(),
            role: z.enum(['admin', 'manager', 'technician', 'user']).optional(),
            teamId: z.string().uuid().optional(),
          }))
          .mutation(({ input }) => this.usersService.update(input.id, input)),
        delete: t.procedure.input(z.object({ id: z.string().uuid() })).mutation(({ input }) => this.usersService.remove(input.id)),
      }),

      teams: t.router({
        list: t.procedure.query(() => this.teamsService.findAll()),
        getById: t.procedure.input(z.object({ id: z.string().uuid() })).query(({ input }) => this.teamsService.findOne(input.id)),
        create: t.procedure
          .input(z.object({
            name: z.string().min(1),
            description: z.string().optional(),
          }))
          .mutation(({ input }) => this.teamsService.create({
            name: input.name,
            description: input.description,
          })),
        update: t.procedure
          .input(z.object({
            id: z.string().uuid(),
            name: z.string().min(1).optional(),
            description: z.string().optional(),
          }))
          .mutation(({ input }) => {
            const data: { name?: string; description?: string } = {};
            if (input.name !== undefined) data.name = input.name;
            if (input.description !== undefined) data.description = input.description;
            return this.teamsService.update(input.id, data);
          }),
        delete: t.procedure.input(z.object({ id: z.string().uuid() })).mutation(({ input }) => this.teamsService.remove(input.id)),
      }),
    });
  }
}
