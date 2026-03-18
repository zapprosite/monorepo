import { seedCRM } from "@backend/db/seed/crm.seed";
import { seedPrompts } from "@backend/db/seed/prompts.seed";

export const seed = async () => {
	console.log("Seeding database...");

	await seedPrompts();
	await seedCRM();

	console.log("Seeding completed successfully!");
};
