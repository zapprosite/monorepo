import { db } from '@backend/db/db';
import { protectedProcedure, trpcRouter } from '@backend/trpc';
import { makePdf, type MakePdfOptions } from '@backend/skills/make-pdf';
import { getCompanyIdentity } from '@backend/lib/company.identity';
import { uploadToDisk } from '@backend/lib/upload';
import {
	materialItemCreateInputZod,
	materialItemsByServiceOrderZod,
} from '@repo/zod-schemas/material_item.zod';
import {
	listServiceOrdersFilterZod,
	serviceOrderCreateInputZod,
	serviceOrderGetByIdZod,
	serviceOrderUpdateInputZod,
} from '@repo/zod-schemas/service_order.zod';
import {
	technicalReportByServiceOrderZod,
	technicalReportCreateInputZod,
	technicalReportUpdateInputZod,
} from '@repo/zod-schemas/technical_report.zod';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

const SERVICE_ORDERS_MAX_LIMIT = 200;
const RELATED_MAX_LIMIT = 100;

// Legacy by design: service orders orchestrate PDFs, signatures, reports, and materials across
// multiple entities, so this router stays custom instead of bending createCrudRouter past CRUD.
export const serviceOrdersRouterTrpc = trpcRouter({
	// — Service Orders —

	listServiceOrders: protectedProcedure
		.input(listServiceOrdersFilterZod)
		.query(async ({ ctx, input }) => {
			const { teamId } = ctx.user;
			let query = db.serviceOrders
				.select('*')
				// @ts-ignore TS2339 innerJoin not in type but exists at runtime
				.innerJoin('clients', 'serviceOrders.clienteId', 'clients.clientId')
				.where('clients.teamId', teamId);

			if (input.clienteId) query = query.where({ 'serviceOrders.clienteId': input.clienteId });
			if (input.tecnicoId) query = query.where({ 'serviceOrders.tecnicoId': input.tecnicoId });
			if (input.equipmentId)
				query = query.where({ 'serviceOrders.equipmentId': input.equipmentId });
			if (input.status) query = query.where({ 'serviceOrders.status': input.status });
			if (input.tipo) query = query.where({ 'serviceOrders.tipo': input.tipo });
			if (input.search) {
				const term = `%${input.search}%`;
				query = query.whereSql`"serviceOrders"."numero" ILIKE ${term}`;
			}

			return query.order({ dataAbertura: 'DESC' }).limit(SERVICE_ORDERS_MAX_LIMIT);
		}),

	getServiceOrderDetail: protectedProcedure
		.input(serviceOrderGetByIdZod)
		.query(async ({ ctx, input: { serviceOrderId } }) => {
			const { teamId } = ctx.user;
			const order = await db.serviceOrders.findOptional(serviceOrderId);
			if (!order)
				throw new TRPCError({ code: 'NOT_FOUND', message: 'Ordem de Serviço não encontrada' });
			// Verify ownership via client
			const cliente = await db.clients
				.where({ clientId: order.clienteId, teamId })
				.findOptional(order.clienteId);
			if (!cliente) throw new TRPCError({ code: 'FORBIDDEN', message: 'Acesso negado' });
			return order;
		}),

	createServiceOrder: protectedProcedure
		.input(serviceOrderCreateInputZod)
		.mutation(async ({ ctx, input }) => {
			return db.$transaction(async () => {
			const { teamId } = ctx.user;
			const cliente = await db.clients
				.where({ clientId: input.clienteId, teamId })
				.findOptional(input.clienteId);
			if (!cliente) throw new TRPCError({ code: 'NOT_FOUND', message: 'Cliente não encontrado' });
			if (input.tecnicoId) {
				const tecnico = await db.users.findOptional(input.tecnicoId);
				if (!tecnico) throw new TRPCError({ code: 'NOT_FOUND', message: 'Técnico não encontrado' });
				if (tecnico.teamId !== teamId)
					throw new TRPCError({ code: 'FORBIDDEN', message: 'Técnico de outro time' });
			}
			if (input.scheduleId) {
				const schedule = await db.schedules.findOptional(input.scheduleId);
				if (!schedule) throw new TRPCError({ code: 'NOT_FOUND', message: 'Agendamento não encontrado' });
			}
			if (input.unitId) {
				const unit = await db.units.findOptional(input.unitId);
				if (!unit) throw new TRPCError({ code: 'NOT_FOUND', message: 'Unidade não encontrada' });
			}
			if (input.equipmentId) {
				const equipment = await db.equipment.findOptional(input.equipmentId);
				if (!equipment)
					throw new TRPCError({ code: 'NOT_FOUND', message: 'Equipamento não encontrado' });
			}
			return db.serviceOrders.create(input);
			});
		}),

	updateServiceOrder: protectedProcedure
		.input(serviceOrderUpdateInputZod)
		.mutation(async ({ ctx, input: { serviceOrderId, ...data } }) => {
			const { teamId } = ctx.user;
			const order = await db.serviceOrders.findOptional(serviceOrderId);
			if (!order)
				throw new TRPCError({ code: 'NOT_FOUND', message: 'Ordem de Serviço não encontrada' });
			const cliente = await db.clients
				.where({ clientId: order.clienteId, teamId })
				.findOptional(order.clienteId);
			if (!cliente) throw new TRPCError({ code: 'FORBIDDEN', message: 'Acesso negado' });
			return db.serviceOrders.where({ serviceOrderId }).update(data);
		}),

	iniciarAtendimento: protectedProcedure
		.input(serviceOrderGetByIdZod)
		.mutation(async ({ ctx, input: { serviceOrderId } }) => {
			const { teamId } = ctx.user;
			const order = await db.serviceOrders.findOptional(serviceOrderId);
			if (!order)
				throw new TRPCError({ code: 'NOT_FOUND', message: 'Ordem de Serviço não encontrada' });
			const cliente = await db.clients
				.where({ clientId: order.clienteId, teamId })
				.findOptional(order.clienteId);
			if (!cliente) throw new TRPCError({ code: 'FORBIDDEN', message: 'Acesso negado' });
			if (order.status !== 'Aberta') {
				throw new TRPCError({
					code: 'BAD_REQUEST',
					message: "Só é possível iniciar atendimento com status 'Aberta'",
				});
			}
			return db.serviceOrders.where({ serviceOrderId }).update({ status: 'Em Andamento' });
		}),

	concluirOrdem: protectedProcedure
		.input(serviceOrderGetByIdZod)
		.mutation(async ({ ctx, input: { serviceOrderId } }) => {
			const { teamId } = ctx.user;
			const order = await db.serviceOrders.findOptional(serviceOrderId);
			if (!order)
				throw new TRPCError({ code: 'NOT_FOUND', message: 'Ordem de Serviço não encontrada' });
			const cliente = await db.clients
				.where({ clientId: order.clienteId, teamId })
				.findOptional(order.clienteId);
			if (!cliente) throw new TRPCError({ code: 'FORBIDDEN', message: 'Acesso negado' });
			if (order.status !== 'Em Andamento') {
				throw new TRPCError({
					code: 'BAD_REQUEST',
					message: "Só é possível concluir ordem com status 'Em Andamento'",
				});
			}
			const dataFechamento = new Date().toISOString();
			if (new Date(dataFechamento) < new Date(order.dataAbertura)) {
				throw new TRPCError({
					code: 'BAD_REQUEST',
					message: 'Data de fechamento não pode ser anterior à data de abertura',
				});
			}

			// Generate PDF after order completion
			const tecnico = order.tecnicoId ? await db.users.findOptional(order.tecnicoId) : null;
			const equipment = order.equipmentId ? await db.equipment.findOptional(order.equipmentId) : null;
			const report = await db.technicalReports.where({ serviceOrderId }).takeOptional();
			const materialItems = await db.materialItems.where({ serviceOrderId }).order({ createdAt: 'ASC' }).limit(100);
			const companyIdentity = await getCompanyIdentity(teamId!);

			const primaryAddress = await db.addresses.where({ clienteId: order.clienteId, tipo: 'Técnica' as const }).takeOptional()
				|| await db.addresses.where({ clienteId: order.clienteId }).takeOptional();

			const rgUrl = equipment?.subdomain ? `https://crm.zappro.site/public/equip/${equipment.subdomain}` : '';

			const pdfData: MakePdfOptions['data'] = {
				osNumber: order.numero,
				clientName: cliente.nome,
				clientAddress: primaryAddress ? `${primaryAddress.rua}, ${primaryAddress.numero} - ${primaryAddress.bairro}, ${primaryAddress.cidade}/${primaryAddress.estado}` : '',
				clientPhone: cliente.telefone || '',
				equipmentName: equipment?.nome || '',
				equipmentModel: equipment?.modelo || '',
				equipmentSerial: equipment?.numeroDeSerie || '',
				equipmentBtu: equipment?.capacidadeBtu ? `${equipment.capacidadeBtu} BTU` : '',
				technicianName: tecnico?.name || '',
				serviceDate: new Date(order.dataAbertura).toLocaleDateString('pt-BR'),
				serviceType: order.tipo,
				diagnostico: report?.diagnostico || '',
				servicosExecutados: report?.servicosExecutados || '',
				materiais: materialItems.map((m: any) => ({
					descricao: m.descricao,
					quantidade: m.quantidade,
					valorUnitario: m.valorUnitario,
				})),
				photos: [],
				technicianSignature: report?.signatureUrlTecnico || '',
				clientSignature: report?.signatureUrlCliente || '',
				rgUrl,
				companyName: companyIdentity.name,
				companyLogo: companyIdentity.logoUrl,
				companyAddress: companyIdentity.address,
				companyPhone: companyIdentity.phone,
				primaryColor: companyIdentity.primaryColor,
			};

			const pdfUrl = await makePdf({ data: pdfData });

			return db.serviceOrders.where({ serviceOrderId }).update({
				status: 'Concluída',
				dataFechamento,
				pdfUrl,
			});
		}),

	cancelarOrdem: protectedProcedure
		.input(serviceOrderGetByIdZod)
		.mutation(async ({ ctx, input: { serviceOrderId } }) => {
			const { teamId } = ctx.user;
			const order = await db.serviceOrders.findOptional(serviceOrderId);
			if (!order)
				throw new TRPCError({ code: 'NOT_FOUND', message: 'Ordem de Serviço não encontrada' });
			const cliente = await db.clients
				.where({ clientId: order.clienteId, teamId })
				.findOptional(order.clienteId);
			if (!cliente) throw new TRPCError({ code: 'FORBIDDEN', message: 'Acesso negado' });
			if (order.status === 'Concluída' || order.status === 'Cancelada') {
				throw new TRPCError({
					code: 'BAD_REQUEST',
					message: "Não é possível cancelar ordem com status 'Concluída' ou 'Cancelada'",
				});
			}
			return db.serviceOrders.where({ serviceOrderId }).update({ status: 'Cancelada' });
		}),

	deleteServiceOrder: protectedProcedure
		.input(serviceOrderGetByIdZod)
		.mutation(async ({ ctx, input }) => {
			// Delegates to cancelarOrdem (identical behavior, avoid duplicate logic)
			const { teamId } = ctx.user;
			const order = await db.serviceOrders.findOptional(input.serviceOrderId);
			if (!order)
				throw new TRPCError({ code: 'NOT_FOUND', message: 'Ordem de Serviço não encontrada' });
			const cliente = await db.clients
				.where({ clientId: order.clienteId, teamId })
				.findOptional(order.clienteId);
			if (!cliente) throw new TRPCError({ code: 'FORBIDDEN', message: 'Acesso negado' });
			if (order.status === 'Concluída' || order.status === 'Cancelada') {
				throw new TRPCError({
					code: 'BAD_REQUEST',
					message: 'Não é possível excluir ordem com este status',
				});
			}
			return db.serviceOrders.where({ serviceOrderId: input.serviceOrderId }).update({ status: 'Cancelada' });
		}),

	// — Technical Reports —

	getReportByServiceOrder: protectedProcedure
		.input(technicalReportByServiceOrderZod)
		.query(async ({ ctx, input: { serviceOrderId } }) => {
			const { teamId } = ctx.user;
			const order = await db.serviceOrders.findOptional(serviceOrderId);
			if (!order)
				throw new TRPCError({ code: 'NOT_FOUND', message: 'Ordem de Serviço não encontrada' });
			const cliente = await db.clients
				.where({ clientId: order.clienteId, teamId })
				.findOptional(order.clienteId);
			if (!cliente) throw new TRPCError({ code: 'FORBIDDEN', message: 'Acesso negado' });
			return db.technicalReports.where({ serviceOrderId }).takeOptional();
		}),

	createReport: protectedProcedure
		.input(technicalReportCreateInputZod)
		.mutation(async ({ ctx, input }) => {
			const { teamId } = ctx.user;
			const order = await db.serviceOrders.findOptional(input.serviceOrderId);
			if (!order)
				throw new TRPCError({ code: 'NOT_FOUND', message: 'Ordem de Serviço não encontrada' });
			const cliente = await db.clients
				.where({ clientId: order.clienteId, teamId })
				.findOptional(order.clienteId);
			if (!cliente) throw new TRPCError({ code: 'FORBIDDEN', message: 'Acesso negado' });
			return db.technicalReports.create(input);
		}),

	updateReport: protectedProcedure
		.input(technicalReportUpdateInputZod)
		.mutation(async ({ ctx, input: { reportId, ...data } }) => {
			const { teamId } = ctx.user;
			const report = await db.technicalReports.findOptional(reportId);
			if (!report)
				throw new TRPCError({ code: 'NOT_FOUND', message: 'Relatório técnico não encontrado' });
			const order = await db.serviceOrders.findOptional(report.serviceOrderId);
			if (!order)
				throw new TRPCError({ code: 'NOT_FOUND', message: 'Ordem de Serviço não encontrada' });
			const cliente = await db.clients
				.where({ clientId: order.clienteId, teamId })
				.findOptional(order.clienteId);
			if (!cliente) throw new TRPCError({ code: 'FORBIDDEN', message: 'Acesso negado' });
			return db.technicalReports.where({ reportId }).update(data);
		}),

	assinarTecnico: protectedProcedure
		.input(technicalReportByServiceOrderZod)
		.mutation(async ({ ctx, input: { serviceOrderId } }) => {
			const { teamId } = ctx.user;
			const order = await db.serviceOrders.findOptional(serviceOrderId);
			if (!order)
				throw new TRPCError({ code: 'NOT_FOUND', message: 'Ordem de Serviço não encontrada' });
			const cliente = await db.clients
				.where({ clientId: order.clienteId, teamId })
				.findOptional(order.clienteId);
			if (!cliente) throw new TRPCError({ code: 'FORBIDDEN', message: 'Acesso negado' });
			const report = await db.technicalReports.where({ serviceOrderId }).takeOptional();
			if (!report)
				throw new TRPCError({ code: 'NOT_FOUND', message: 'Relatório técnico não encontrado' });
			return db.technicalReports.where({ serviceOrderId }).update({ assinadoTecnico: true });
		}),

	assinarCliente: protectedProcedure
		.input(technicalReportByServiceOrderZod)
		.mutation(async ({ ctx, input: { serviceOrderId } }) => {
			const { teamId } = ctx.user;
			const order = await db.serviceOrders.findOptional(serviceOrderId);
			if (!order)
				throw new TRPCError({ code: 'NOT_FOUND', message: 'Ordem de Serviço não encontrada' });
			const cliente = await db.clients
				.where({ clientId: order.clienteId, teamId })
				.findOptional(order.clienteId);
			if (!cliente) throw new TRPCError({ code: 'FORBIDDEN', message: 'Acesso negado' });
			const report = await db.technicalReports.where({ serviceOrderId }).takeOptional();
			if (!report)
				throw new TRPCError({ code: 'NOT_FOUND', message: 'Relatório técnico não encontrado' });
			return db.technicalReports.where({ serviceOrderId }).update({ assinadoCliente: true });
		}),

	saveOsSignatures: protectedProcedure
		.input(
			z.object({
				serviceOrderId: z.string().uuid(),
				technicianSignature: z.string(),
				clientSignature: z.string(),
			}),
		)
		.mutation(async ({ ctx, input: { serviceOrderId, technicianSignature, clientSignature } }) => {
			const { teamId } = ctx.user;
			const order = await db.serviceOrders.findOptional(serviceOrderId);
			if (!order)
				throw new TRPCError({ code: 'NOT_FOUND', message: 'Ordem de Serviço não encontrada' });
			const cliente = await db.clients
				.where({ clientId: order.clienteId, teamId })
				.findOptional(order.clienteId);
			if (!cliente) throw new TRPCError({ code: 'FORBIDDEN', message: 'Acesso negado' });

			const techUrl = await uploadToDisk({
				base64: technicianSignature.split(',')[1] || technicianSignature,
				filename: `tech-signature-${serviceOrderId}.png`,
				teamId: teamId!,
				folder: 'signatures',
				mimeType: 'image/png',
			});

			const clientUrl = await uploadToDisk({
				base64: clientSignature.split(',')[1] || clientSignature,
				filename: `client-signature-${serviceOrderId}.png`,
				teamId: teamId!,
				folder: 'signatures',
				mimeType: 'image/png',
			});

			return db.technicalReports.where({ serviceOrderId }).update({
				signatureUrlTecnico: techUrl,
				signatureUrlCliente: clientUrl,
				assinadoTecnico: true,
				assinadoCliente: true,
			});
		}),

	// — Material Items —

	listMaterials: protectedProcedure
		.input(materialItemsByServiceOrderZod)
		.query(async ({ ctx, input: { serviceOrderId } }) => {
			const { teamId } = ctx.user;
			const order = await db.serviceOrders.findOptional(serviceOrderId);
			if (!order)
				throw new TRPCError({ code: 'NOT_FOUND', message: 'Ordem de Serviço não encontrada' });
			const cliente = await db.clients
				.where({ clientId: order.clienteId, teamId })
				.findOptional(order.clienteId);
			if (!cliente) throw new TRPCError({ code: 'FORBIDDEN', message: 'Acesso negado' });
			return db.materialItems
				.where({ serviceOrderId })
				.order({ createdAt: 'ASC' })
				.limit(RELATED_MAX_LIMIT);
		}),

	addMaterial: protectedProcedure
		.input(materialItemCreateInputZod)
		.mutation(async ({ ctx, input }) => {
			const { teamId } = ctx.user;
			const order = await db.serviceOrders.findOptional(input.serviceOrderId);
			if (!order)
				throw new TRPCError({ code: 'NOT_FOUND', message: 'Ordem de Serviço não encontrada' });
			const cliente = await db.clients
				.where({ clientId: order.clienteId, teamId })
				.findOptional(order.clienteId);
			if (!cliente) throw new TRPCError({ code: 'FORBIDDEN', message: 'Acesso negado' });
			return db.materialItems.create(input);
		}),
});
