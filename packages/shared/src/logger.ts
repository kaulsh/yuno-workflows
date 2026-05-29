import pino from 'pino';

export const logger = pino({
	nestedKey: '$',
	level:
		process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development'
			? 'debug'
			: 'info',
	formatters: {
		level(label) {
			return { level: label };
		},
	},
});

export type { Logger } from 'pino';
