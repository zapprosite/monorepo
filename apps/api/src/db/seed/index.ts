import { seedCRM } from '@backend/db/seed/crm.seed';

export const seed = async () => {
	console.log('Seeding database...');
	await seedCRM();
	console.log('Seeding completed successfully!');
};
