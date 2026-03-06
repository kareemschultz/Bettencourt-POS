import type { RouterClient } from "@orpc/server";

import { protectedProcedure, publicProcedure } from "../index";
import { analyticsRouter } from "./analytics";
import { auditRouter } from "./audit";
import { cashRouter } from "./cash";
import { categoriesRouter } from "./categories";
import { customersRouter } from "./customers";
import { dashboardRouter } from "./dashboard";
import { discountsRouter } from "./discounts";
import { giftcardsRouter } from "./giftcards";
import { inventoryRouter } from "./inventory";
import { journalRouter } from "./journal";
import { kitchenRouter } from "./kitchen";
import { locationsRouter } from "./locations";
import { loyaltyRouter } from "./loyalty";
import { menuBoardRouter } from "./menu-board";
import { menuSchedulesRouter } from "./menu-schedules";
import { invoicesRouter } from "./invoices";
import { notificationsRouter } from "./notifications";
import { quotationsRouter } from "./quotations";
import { onlineOrderRouter } from "./online-order";
import { ordersRouter } from "./orders";
import { posRouter } from "./pos";
import { productionRouter } from "./production";
import { productsRouter } from "./products";
import { reconciliationRouter } from "./reconciliation";
import { reportsRouter } from "./reports";
import { settingsRouter } from "./settings";
import { splitBillRouter } from "./split-bill";
import { tablesRouter } from "./tables";
import { timeclockRouter } from "./timeclock";
import { webhooksRouter } from "./webhooks";

export const appRouter = {
	healthCheck: publicProcedure.handler(() => {
		return "OK";
	}),
	privateData: protectedProcedure.handler(({ context }) => {
		return {
			message: "This is private",
			user: context.session?.user,
		};
	}),
	pos: posRouter,
	orders: ordersRouter,
	products: productsRouter,
	categories: categoriesRouter,
	inventory: inventoryRouter,
	kitchen: kitchenRouter,
	cash: cashRouter,
	production: productionRouter,
	reports: reportsRouter,
	audit: auditRouter,
	settings: settingsRouter,
	reconciliation: reconciliationRouter,
	dashboard: dashboardRouter,
	timeclock: timeclockRouter,
	customers: customersRouter,
	loyalty: loyaltyRouter,
	discounts: discountsRouter,
	giftcards: giftcardsRouter,
	analytics: analyticsRouter,
	menuSchedules: menuSchedulesRouter,
	menuBoard: menuBoardRouter,
	journal: journalRouter,
	splitBill: splitBillRouter,
	tables: tablesRouter,
	onlineOrder: onlineOrderRouter,
	locations: locationsRouter,
	webhooks: webhooksRouter,
	notifications: notificationsRouter,
	quotations: quotationsRouter,
	invoices: invoicesRouter,
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
