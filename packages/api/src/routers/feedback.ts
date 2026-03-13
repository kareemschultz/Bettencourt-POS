import { db } from "@Bettencourt-POS/db";
import * as schema from "@Bettencourt-POS/db/schema";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { permissionProcedure } from "../index";
import { requireOrganizationId } from "../lib/org-context";

const list = permissionProcedure("reports.read")
	.input(
		z
			.object({
				startDate: z.string().optional(),
				endDate: z.string().optional(),
				minRating: z.number().int().min(1).max(5).optional(),
			})
			.optional(),
	)
	.handler(async ({ input: rawInput, context }) => {
		const input = rawInput ?? {};
		const orgId = requireOrganizationId(context);
		const conditions = [eq(schema.customerFeedback.organizationId, orgId)];

		if (input.startDate) {
			conditions.push(
				gte(
					schema.customerFeedback.createdAt,
					new Date(`${input.startDate}T00:00:00`),
				),
			);
		}
		if (input.endDate) {
			conditions.push(
				lte(
					schema.customerFeedback.createdAt,
					new Date(`${input.endDate}T23:59:59`),
				),
			);
		}
		if (input.minRating) {
			conditions.push(gte(schema.customerFeedback.rating, input.minRating));
		}

		return db
			.select()
			.from(schema.customerFeedback)
			.where(and(...conditions))
			.orderBy(desc(schema.customerFeedback.createdAt))
			.limit(100);
	});

const submit = permissionProcedure("orders.create")
	.input(
		z.object({
			orderId: z.string().uuid().optional().nullable(),
			customerId: z.string().uuid().optional().nullable(),
			rating: z.number().int().min(1).max(5),
			foodRating: z.number().int().min(1).max(5).optional().nullable(),
			serviceRating: z.number().int().min(1).max(5).optional().nullable(),
			ambienceRating: z.number().int().min(1).max(5).optional().nullable(),
			comment: z.string().optional().nullable(),
			customerName: z.string().optional().nullable(),
			customerEmail: z.string().email().optional().nullable(),
			source: z.enum(["pos", "online", "qr"]).optional(),
		}),
	)
	.handler(async ({ input, context }) => {
		const orgId = requireOrganizationId(context);
		const [row] = await db
			.insert(schema.customerFeedback)
			.values({
				organizationId: orgId,
				orderId: input.orderId ?? undefined,
				customerId: input.customerId ?? undefined,
				rating: input.rating,
				foodRating: input.foodRating ?? undefined,
				serviceRating: input.serviceRating ?? undefined,
				ambienceRating: input.ambienceRating ?? undefined,
				comment: input.comment ?? undefined,
				customerName: input.customerName ?? undefined,
				customerEmail: input.customerEmail ?? undefined,
				source: input.source ?? "pos",
			})
			.returning();
		return row;
	});

const summary = permissionProcedure("reports.read")
	.input(
		z
			.object({
				startDate: z.string().optional(),
				endDate: z.string().optional(),
			})
			.optional(),
	)
	.handler(async ({ input: rawInput, context }) => {
		const input = rawInput ?? {};
		const orgId = requireOrganizationId(context);
		const start = input.startDate ?? "2000-01-01";
		const end = input.endDate ?? "2099-12-31";

		const result = await db.execute(
			sql`SELECT
				COUNT(*)::int as total_reviews,
				COALESCE(AVG(rating), 0)::numeric(3,2) as avg_rating,
				COALESCE(AVG(food_rating), 0)::numeric(3,2) as avg_food,
				COALESCE(AVG(service_rating), 0)::numeric(3,2) as avg_service,
				COALESCE(AVG(ambience_rating), 0)::numeric(3,2) as avg_ambience,
				COUNT(*) FILTER (WHERE rating >= 4)::int as positive_count,
				COUNT(*) FILTER (WHERE rating <= 2)::int as negative_count,
				COUNT(*) FILTER (WHERE rating = 5)::int as five_star,
				COUNT(*) FILTER (WHERE rating = 4)::int as four_star,
				COUNT(*) FILTER (WHERE rating = 3)::int as three_star,
				COUNT(*) FILTER (WHERE rating = 2)::int as two_star,
				COUNT(*) FILTER (WHERE rating = 1)::int as one_star
			FROM customer_feedback
			WHERE organization_id = ${orgId}
				AND created_at >= ${start}::timestamptz
				AND created_at <= ${end}::timestamptz`,
		);

		return result.rows[0];
	});

export const feedbackRouter = { list, submit, summary };
