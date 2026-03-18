import { seedPrompts } from "@backend/db/seed/prompts.seed";
import { seedCRM } from "@backend/db/seed/crm.seed";

export const seed = async () => {
	console.log("Seeding database...");

	await seedPrompts();
	await seedCRM();

	console.log("Seeding completed successfully!");
};

