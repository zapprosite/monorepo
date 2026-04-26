import { change } from "../db_script";

change(async (db) => {
	// Add teamId to users table to enable team-based access control
	// This is required for IDOR protection - users must belong to a team
	await db.sql`
		ALTER TABLE users
		ADD COLUMN IF NOT EXISTS "teamId" uuid REFERENCES teams("teamId") ON DELETE SET NULL
	`;

	// Create index for faster team-based queries
	await db.sql`
		CREATE INDEX IF NOT EXISTS "idx_users_teamId" ON users("teamId")
	`;
});
