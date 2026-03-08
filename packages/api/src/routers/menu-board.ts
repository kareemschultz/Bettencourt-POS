import { db } from "@Bettencourt-POS/db";
import { sql } from "drizzle-orm";
import { publicProcedure } from "../index";
import { resolvePublicOrganizationId } from "../lib/org-context";

// ── getMenuProducts ─────────────────────────────────────────────────
// Public procedure (no auth) - returns active products grouped by department
const getMenuProducts = publicProcedure.handler(async () => {
	const orgId = await resolvePublicOrganizationId();
	const result = await db.execute(
		sql`SELECT
				p.id,
				p.name,
				p.price::numeric,
				p.image_url,
				p.sort_order,
				COALESCE(rc.name, 'Other') as department_name,
				COALESCE(rc.sort_order, 999) as department_sort_order,
				rc.id as department_id
			FROM product p
			LEFT JOIN reporting_category rc ON rc.id = p.reporting_category_id
			WHERE p.is_active = true
				AND p.organization_id = ${orgId}
			ORDER BY department_sort_order ASC, rc.name ASC, p.sort_order ASC, p.name ASC`,
	);

	// Group products by department
	const departments = new Map<
		string,
		{
			name: string;
			sortOrder: number;
			products: {
				id: string;
				name: string;
				price: number;
				imageUrl: string | null;
			}[];
		}
	>();

	for (const row of result.rows as Record<string, unknown>[]) {
		const deptName = row.department_name as string;
		if (!departments.has(deptName)) {
			departments.set(deptName, {
				name: deptName,
				sortOrder: Number(row.department_sort_order),
				products: [],
			});
		}
		departments.get(deptName)?.products.push({
			id: row.id as string,
			name: row.name as string,
			price: Number(row.price),
			imageUrl: row.image_url as string | null,
		});
	}

	return Array.from(departments.values()).sort(
		(a, b) => a.sortOrder - b.sortOrder,
	);
});

export const menuBoardRouter = {
	getMenuProducts,
};
