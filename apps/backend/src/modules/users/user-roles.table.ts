import { BaseTable } from "@backend/db/base_table";
import { USER_ROLE_ENUM } from "@connected-repo/zod-schemas/crm_enums.zod";

export class UserRolesTable extends BaseTable {
	readonly table = "user_roles";

	columns = this.setColumns((t) => ({
		userRoleId: t.uuid().primaryKey().default(t.sql`gen_random_uuid()`),
		userId: t.uuid().foreignKey("users", "userId", {
			onUpdate: "RESTRICT",
			onDelete: "CASCADE",
		}),
		role: t.enum("user_role_enum", USER_ROLE_ENUM),
		assignedAt: t.timestamp().default(t.sql`now()`),
		assignedByUserId: t
			.uuid()
			.nullable()
			.foreignKey("users", "userId", {
				onUpdate: "RESTRICT",
				onDelete: "SET NULL",
			}),
	}));
}
