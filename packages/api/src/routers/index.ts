import type { RouterClient } from "@orpc/server";

import { protectedProcedure, publicProcedure } from "../index";
import { analyticsRouter } from "./analytics";
import { auditRouter } from "./audit";
import { budgetsRouter } from "./budgets";
import { cashRouter } from "./cash";
import { categoriesRouter } from "./categories";
import { creditNotesRouter } from "./credit-notes";
import { customersRouter } from "./customers";
import { dashboardRouter } from "./dashboard";
import { deliveryPlatformsRouter } from "./delivery-platforms";
import { discountsRouter } from "./discounts";
import { feedbackRouter } from "./feedback";
import { floorPlanRouter } from "./floor-plan";
import { giftcardsRouter } from "./giftcards";
import { inventoryRouter } from "./inventory";
import { invoicesRouter } from "./invoices";
import { journalRouter } from "./journal";
import { kitchenRouter } from "./kitchen";
import { locationsRouter } from "./locations";
import { loyaltyRouter } from "./loyalty";
import { menuBoardRouter } from "./menu-board";
import { menuSchedulesRouter } from "./menu-schedules";
import { modifiersRouter } from "./modifiers";
import { notificationsRouter } from "./notifications";
import { onlineOrderRouter } from "./online-order";
import { ordersRouter } from "./orders";
import { posRouter } from "./pos";
import { printersRouter } from "./printers";
import { productionRouter } from "./production";
import { productsRouter } from "./products";
import { quotationsRouter } from "./quotations";
import { reconciliationRouter } from "./reconciliation";
import { recurringRouter } from "./recurring";
import { reportsRouter } from "./reports";
import { reservationsRouter } from "./reservations";
import { settingsRouter } from "./settings";
import { shiftsRouter } from "./shifts";
import { splitBillRouter } from "./split-bill";
import { tablesRouter } from "./tables";
import { timeclockRouter } from "./timeclock";
import { vendorBillsRouter } from "./vendor-bills";
import { waitlistRouter } from "./waitlist";
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
	modifiers: modifiersRouter,
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
	floorPlan: floorPlanRouter,
	giftcards: giftcardsRouter,
	analytics: analyticsRouter,
	menuSchedules: menuSchedulesRouter,
	menuBoard: menuBoardRouter,
	journal: journalRouter,
	splitBill: splitBillRouter,
	tables: tablesRouter,
	printers: printersRouter,
	reservations: reservationsRouter,
	onlineOrder: onlineOrderRouter,
	locations: locationsRouter,
	webhooks: webhooksRouter,
	notifications: notificationsRouter,
	quotations: quotationsRouter,
	invoices: invoicesRouter,
	creditNotes: creditNotesRouter,
	vendorBills: vendorBillsRouter,
	recurring: recurringRouter,
	budgets: budgetsRouter,
	shifts: shiftsRouter,
	waitlist: waitlistRouter,
	feedback: feedbackRouter,
	deliveryPlatforms: deliveryPlatformsRouter,
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
