import { db } from '@backend/db/db';
import { renderEquipmentPage } from '@backend/templates/equipment-rg.html';
import type { FastifyInstance } from 'fastify';

export const publicRouter = (app: FastifyInstance) => {
	// GET /public/equip/:subdomain — RG público do equipamento
	app.get('/public/equip/:subdomain', async (request, reply) => {
		const { subdomain } = request.params as { subdomain: string };

		const equipment = await db.equipment
			.select('*')
			// @ts-ignore TS2339 innerJoin not in type but exists at runtime
			.innerJoin('clients', 'equipment.clienteId', 'clients.clientId')
			.where({ subdomain, ativo: true })
			.findOptional();

		if (!equipment) {
			return reply.status(404).send({
				statusCode: 404,
				error: 'Not Found',
				message: 'Equipamento não encontrado',
			});
		}

		const html = renderEquipmentPage(equipment);
		return reply.type('text/html').send(html);
	});
};
