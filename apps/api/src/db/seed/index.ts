import { isDev } from "@backend/configs/env.config";
import { seedCRM } from "@backend/db/seed/crm.seed";
import { seedDevTeam } from "@backend/db/seed/dev-team.seed";
import { seedPrompts } from "@backend/db/seed/prompts.seed";

export const seed = async () => {
	console.log("Seeding database...");

	await seedPrompts();
	await seedCRM();

	// Seed dev team only in development mode
	if (isDev) {
		await seedDevTeam();
	}

	console.log("Seeding completed successfully!");
};
