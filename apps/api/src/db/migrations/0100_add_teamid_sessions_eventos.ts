import { change } from "../db_script";

// @ts-ignore - rakeDb types don't expose callable signature
change(async (db) => {
	// Add teamId to sessions table for IDOR protection
	await db.sql`
		ALTER TABLE session
		ADD COLUMN IF NOT EXISTS "teamId" uuid REFERENCES teams("teamId") ON DELETE SET NULL
	`;

	// Add teamId to eventos table for IDOR protection
	await db.sql`
		ALTER TABLE eventos
		ADD COLUMN IF NOT EXISTS "teamId" uuid REFERENCES teams("teamId") ON DELETE SET NULL
	`;

	// Create indexes for faster team-based queries
	await db.sql`
		CREATE INDEX IF NOT EXISTS "idx_session_teamId" ON session("teamId")
	`;

	await db.sql`
		CREATE INDEX IF NOT EXISTS "idx_eventos_teamId" ON eventos("teamId")
	`;
});
