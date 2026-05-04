import type { Server } from 'node:https';
import type { NODE_ENV } from '@repo/zod-schemas/node_env';
import type { FastifyBaseLogger, FastifyHttpOptions } from 'fastify';

export const loggerConfig: Record<
	NODE_ENV,
	FastifyHttpOptions<Server, FastifyBaseLogger>['logger']
> = {
	development: {
		transport: {
			target: 'pino-pretty',
			options: {
				translateTime: 'HH:MM:ss Z',
				ignore: 'pid,hostname',
			},
		},
	},
	production: {
		level: 'info',
		...(process.env['AXIOM_DATASET'] && process.env['AXIOM_TOKEN']
			? {
					transport: {
						targets: [
							{
								target: '@axiomhq/pino',
								options: {
									translateTime: 'HH:MM:ss Z',
									ignore: 'pid,hostname',
									dataset: process.env['AXIOM_DATASET'],
									token: process.env['AXIOM_TOKEN'],
								},
							},
						],
					},
				}
			: {}),
	},
	staging: { level: 'info' },
	test: {
		level: 'fatal',
		transport: {
			target: 'pino-pretty',
			options: {
				translateTime: 'HH:MM:ss Z',
				ignore: 'pid,hostname',
			},
		},
	},
};
