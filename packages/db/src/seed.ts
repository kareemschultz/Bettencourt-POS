import { createHash, randomBytes } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import dotenv from "dotenv";
import { eq, inArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

// Load env from apps/server/.env (same pattern as drizzle.config.ts)
dotenv.config({ path: "../../apps/server/.env" });

const db = drizzle(process.env.DATABASE_URL!, { schema });

// ── Fixed IDs (RFC4122 v4 compliant) ──────────────────────────────────

const ORG_ID = "a0000000-0000-4000-8000-000000000001";
const LOC_ID = "b0000000-0000-4000-8000-000000000001";
const LOC_QUICK_SERVE = "b0000000-0000-4000-8000-000000000002";

const REG = {
	meals: "c0000000-0000-4000-8000-000000000001",
	pastry: "c0000000-0000-4000-8000-000000000002",
	beverage: "c0000000-0000-4000-8000-000000000003",
	quickServe: "c0000000-0000-4000-8000-000000000004",
} as const;

const DEPT = {
	chicken: "d1000000-0000-4000-8000-000000000001",
	fish: "d1000000-0000-4000-8000-000000000002",
	beef: "d1000000-0000-4000-8000-000000000003",
	duck: "d1000000-0000-4000-8000-000000000004",
	mutton: "d1000000-0000-4000-8000-000000000005",
	veggie: "d1000000-0000-4000-8000-000000000006",
	specials: "d1000000-0000-4000-8000-000000000007",
	pastries: "d1000000-0000-4000-8000-000000000008",
	snacks: "d1000000-0000-4000-8000-000000000009",
	beverages: "d1000000-0000-4000-8000-00000000000a",
	sides: "d1000000-0000-4000-8000-00000000000b",
	localJuice: "d1000000-0000-4000-8000-00000000000c",
	meatCookup: "d1000000-0000-4000-8000-00000000000d",
	boxes: "d1000000-0000-4000-8000-00000000000e",
} as const;

const ROLE = {
	executive: "ac000000-0000-4000-8000-000000000008",
	owner: "ac000000-0000-4000-8000-000000000001",
	manager: "ac000000-0000-4000-8000-000000000002",
	cashier: "ac000000-0000-4000-8000-000000000003",
	server: "ac000000-0000-4000-8000-000000000004",
	kitchen: "ac000000-0000-4000-8000-000000000005",
	warehouseClerk: "ac000000-0000-4000-8000-000000000006",
	accountant: "ac000000-0000-4000-8000-000000000007",
} as const;

const USER = {
	admin: "usr_admin_000000000001",
	bonita: "usr_bonita_00000000001",
	cashier: "usr_cashier_00000000001",
	production: "usr_production_000001",
	anna: "usr_anna_0000000000001",
	carl: "usr_carl_0000000000001",
	renatta: "usr_renatta_000000001",
} as const;

// Product IDs
const PROD = {
	friedRiceBakedChicken: "e1000000-0000-4000-8000-000000000001",
	raisinRicePineapple: "e1000000-0000-4000-8000-000000000002",
	vegRiceSweetSour: "e1000000-0000-4000-8000-000000000003",
	chowmeinBakedChicken: "e1000000-0000-4000-8000-000000000004",
	chowmeinFryChicken: "e1000000-0000-4000-8000-000000000005",
	caribbeanRiceBChicken: "e1000000-0000-4000-8000-000000000006",
	caribbeanRiceFChicken: "e1000000-0000-4000-8000-000000000007",
	cookupBakedChicken: "e1000000-0000-4000-8000-000000000008",
	curryChicken: "e1000000-0000-4000-8000-000000000009",
	macCheeseBakedChick: "e1000000-0000-4000-8000-00000000000a",
	cookupBakedSnapper: "e1000000-0000-4000-8000-000000000011",
	cookupFrySnapper: "e1000000-0000-4000-8000-000000000012",
	currySnapper: "e1000000-0000-4000-8000-000000000013",
	curryBeef: "e1000000-0000-4000-8000-000000000021",
	vegChowmein: "e1000000-0000-4000-8000-000000000031",
	vegMealDholl: "e1000000-0000-4000-8000-000000000032",
	vegRice: "e1000000-0000-4000-8000-000000000033",
	veggieCookup: "e1000000-0000-4000-8000-000000000034",
	spongeCake: "e1000000-0000-4000-8000-000000000041",
	coconutBuns: "e1000000-0000-4000-8000-000000000042",
	bakedCustard: "e1000000-0000-4000-8000-000000000043",
	drink1Lt: "e1000000-0000-4000-8000-000000000051",
	drink12oz: "e1000000-0000-4000-8000-000000000052",
	drink20oz: "e1000000-0000-4000-8000-000000000053",
	coke: "e1000000-0000-4000-8000-000000000054",
	water: "e1000000-0000-4000-8000-000000000055",
	vitaMalt: "e1000000-0000-4000-8000-000000000056",
	xlEnergy: "e1000000-0000-4000-8000-000000000057",
	tamarindJuice: "e1000000-0000-4000-8000-000000000061",
	cookUpBBQ: "e1000000-0000-4000-8000-000000000071",
	cookUpFc: "e1000000-0000-4000-8000-000000000072",
	cupDhal: "e1000000-0000-4000-8000-000000000081",
} as const;

// Mock data IDs
const ORDER = {
	o1: "f1000000-0000-4000-8000-000000000001",
	o2: "f1000000-0000-4000-8000-000000000002",
	o3: "f1000000-0000-4000-8000-000000000003",
	o4: "f1000000-0000-4000-8000-000000000004",
	o5: "f1000000-0000-4000-8000-000000000005",
	o6: "f1000000-0000-4000-8000-000000000006",
	o7: "f1000000-0000-4000-8000-000000000007",
	o8: "f1000000-0000-4000-8000-000000000008",
	o9: "f1000000-0000-4000-8000-000000000009",
	o10: "f1000000-0000-4000-8000-00000000000a",
	o11: "f1000000-0000-4000-8000-00000000000b",
	o12: "f1000000-0000-4000-8000-00000000000c",
	o13: "f1000000-0000-4000-8000-00000000000d",
	o14: "f1000000-0000-4000-8000-00000000000e",
	o15: "f1000000-0000-4000-8000-00000000000f",
	o16: "f1000000-0000-4000-8000-000000000010",
	o17: "f1000000-0000-4000-8000-000000000011",
	o18: "f1000000-0000-4000-8000-000000000012",
	o19: "f1000000-0000-4000-8000-000000000013",
	o20: "f1000000-0000-4000-8000-000000000014",
} as const;

const ORDER_EXT = {
	e1: "f1000000-0000-4000-8000-000000000015",
	e2: "f1000000-0000-4000-8000-000000000016",
	e3: "f1000000-0000-4000-8000-000000000017",
	e4: "f1000000-0000-4000-8000-000000000018",
	e5: "f1000000-0000-4000-8000-000000000019",
	e6: "f1000000-0000-4000-8000-00000000001a",
	e7: "f1000000-0000-4000-8000-00000000001b",
	e8: "f1000000-0000-4000-8000-00000000001c",
	e9: "f1000000-0000-4000-8000-00000000001d",
	e10: "f1000000-0000-4000-8000-00000000001e",
	e11: "f1000000-0000-4000-8000-00000000001f",
	e12: "f1000000-0000-4000-8000-000000000020",
	e13: "f1000000-0000-4000-8000-000000000021",
	e14: "f1000000-0000-4000-8000-000000000022",
	e15: "f1000000-0000-4000-8000-000000000023",
	e16: "f1000000-0000-4000-8000-000000000024",
	e17: "f1000000-0000-4000-8000-000000000025",
	e18: "f1000000-0000-4000-8000-000000000026",
	e19: "f1000000-0000-4000-8000-000000000027",
	e20: "f1000000-0000-4000-8000-000000000028",
} as const;

const TABLE = {
	t1: "fa000000-0000-4000-8000-000000000001",
	t2: "fa000000-0000-4000-8000-000000000002",
	t3: "fa000000-0000-4000-8000-000000000003",
	t4: "fa000000-0000-4000-8000-000000000004",
	t5: "fa000000-0000-4000-8000-000000000005",
	t6: "fa000000-0000-4000-8000-000000000006",
	t7: "fa000000-0000-4000-8000-000000000007",
	t8: "fa000000-0000-4000-8000-000000000008",
	t9: "fa000000-0000-4000-8000-000000000009",
	t10: "fa000000-0000-4000-8000-00000000000a",
	t11: "fa000000-0000-4000-8000-00000000000b",
	t12: "fa000000-0000-4000-8000-00000000000c",
} as const;

const CASH_SESSION = {
	cs1: "fb000000-0000-4000-8000-000000000001",
	cs2: "fb000000-0000-4000-8000-000000000002",
	cs3: "fb000000-0000-4000-8000-000000000003",
	cs4: "fb000000-0000-4000-8000-000000000004",
} as const;

const INV_ITEM = {
	chicken: "fc000000-0000-4000-8000-000000000001",
	rice: "fc000000-0000-4000-8000-000000000002",
	flour: "fc000000-0000-4000-8000-000000000003",
	oil: "fc000000-0000-4000-8000-000000000004",
	sugar: "fc000000-0000-4000-8000-000000000005",
	snapper: "fc000000-0000-4000-8000-000000000006",
	beef: "fc000000-0000-4000-8000-000000000007",
	coconut: "fc000000-0000-4000-8000-000000000008",
	onions: "fc000000-0000-4000-8000-000000000009",
	garlic: "fc000000-0000-4000-8000-00000000000a",
	peppers: "fc000000-0000-4000-8000-00000000000b",
	noodles: "fc000000-0000-4000-8000-00000000000c",
	tamarind: "fc000000-0000-4000-8000-00000000000d",
	softDrinks: "fc000000-0000-4000-8000-00000000000e",
	water: "fc000000-0000-4000-8000-00000000000f",
} as const;

const PO = {
	po1: "fd000000-0000-4000-8000-000000000001",
	po2: "fd000000-0000-4000-8000-000000000002",
	po3: "fd000000-0000-4000-8000-000000000003",
} as const;

const SUPPLIER = {
	freshFoods: "aa000000-0000-4000-8000-000000000001",
	bevDist: "aa000000-0000-4000-8000-000000000002",
} as const;

// Helper: deterministic UUID for real vendors by vendor ID
const SUPP = (n: number) =>
	`cc000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const CUST = (n: number) =>
	`ca000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

// Helper: date N days ago at a specific hour
function daysAgo(days: number, hour = 12): Date {
	const d = new Date();
	d.setDate(d.getDate() - days);
	d.setHours(hour, 0, 0, 0);
	return d;
}

// ── Seed function ──────────────────────────────────────────────────────

async function seed() {
	const seedMode = process.env.SEED_MODE ?? "full";
	const isProduction = seedMode === "production";

	console.log(`Seeding database... (mode: ${seedMode})`);

	const passwordHash = isProduction
		? "" // not used in production mode
		: await hashPassword("password123");

	// 1. Organization
	console.log("  -> Organization");
	await db
		.insert(schema.organization)
		.values({
			id: ORG_ID,
			name: "Bettencourt's Food Inc.",
			slug: "bettencourts-food-inc",
			settings: { currency: "GYD", currency_symbol: "$", tax_included: false },
		})
		.onConflictDoNothing();

	// 2. Locations
	console.log("  -> Locations");
	await db
		.insert(schema.location)
		.values([
			{
				id: LOC_ID,
				organizationId: ORG_ID,
				name: "Food Inc / Main",
				address: "Bettencourt's, Georgetown, Guyana",
				phone: "+592-000-0000",
				timezone: "America/Guyana",
				receiptHeader: "Bettencourt's Food Inc.",
				receiptFooter:
					"Thank you for choosing Bettencourt's! -- A True Guyanese Gem",
			},
			{
				id: LOC_QUICK_SERVE,
				organizationId: ORG_ID,
				name: "Quick Serve",
				address: "Quick Serve, Georgetown, Guyana",
				timezone: "America/Guyana",
				receiptHeader: "Bettencourt's Quick Serve",
				receiptFooter: "Thank you for choosing Bettencourt's!",
			},
		])
		.onConflictDoNothing();
	// Rename existing location in case it was seeded with the old name
	await db
		.update(schema.location)
		.set({ name: "Food Inc / Main" })
		.where(eq(schema.location.id, LOC_ID));

	// 3. Registers
	console.log("  -> Registers");
	await db
		.insert(schema.register)
		.values([
			{
				id: REG.meals,
				locationId: LOC_ID,
				name: "Meals POS",
				workflowMode: "standard",
			},
			{
				id: REG.pastry,
				locationId: LOC_ID,
				name: "Pastry POS",
				workflowMode: "standard",
			},
			{
				id: REG.beverage,
				locationId: LOC_ID,
				name: "Beverage & Pickup POS",
				workflowMode: "pickup_delivery",
			},
			{
				id: REG.quickServe,
				locationId: LOC_QUICK_SERVE,
				name: "Quick Serve POS",
				workflowMode: "standard",
			},
		])
		.onConflictDoNothing();

	// 4. Departments
	console.log("  -> Departments");
	await db
		.insert(schema.reportingCategory)
		.values([
			{
				id: DEPT.chicken,
				organizationId: ORG_ID,
				name: "Chicken",
				sortOrder: 1,
			},
			{ id: DEPT.fish, organizationId: ORG_ID, name: "Fish", sortOrder: 2 },
			{ id: DEPT.beef, organizationId: ORG_ID, name: "Beef", sortOrder: 3 },
			{ id: DEPT.duck, organizationId: ORG_ID, name: "Duck", sortOrder: 4 },
			{ id: DEPT.mutton, organizationId: ORG_ID, name: "Mutton", sortOrder: 5 },
			{ id: DEPT.veggie, organizationId: ORG_ID, name: "Veggie", sortOrder: 6 },
			{
				id: DEPT.specials,
				organizationId: ORG_ID,
				name: "Specials",
				sortOrder: 7,
			},
			{
				id: DEPT.pastries,
				organizationId: ORG_ID,
				name: "Pastries",
				sortOrder: 8,
			},
			{ id: DEPT.snacks, organizationId: ORG_ID, name: "Snacks", sortOrder: 9 },
			{
				id: DEPT.beverages,
				organizationId: ORG_ID,
				name: "Beverages",
				sortOrder: 10,
			},
			{ id: DEPT.sides, organizationId: ORG_ID, name: "Sides", sortOrder: 11 },
			{
				id: DEPT.localJuice,
				organizationId: ORG_ID,
				name: "Local Juice",
				sortOrder: 12,
			},
			{
				id: DEPT.meatCookup,
				organizationId: ORG_ID,
				name: "Meat Cookup",
				sortOrder: 13,
			},
			{ id: DEPT.boxes, organizationId: ORG_ID, name: "Boxes", sortOrder: 14 },
		])
		.onConflictDoNothing();

	// 5. Register-Department assignments
	console.log("  -> Register-Department assignments");
	await db
		.insert(schema.registerDepartment)
		.values([
			{ registerId: REG.meals, departmentId: DEPT.chicken },
			{ registerId: REG.meals, departmentId: DEPT.fish },
			{ registerId: REG.meals, departmentId: DEPT.beef },
			{ registerId: REG.meals, departmentId: DEPT.duck },
			{ registerId: REG.meals, departmentId: DEPT.mutton },
			{ registerId: REG.meals, departmentId: DEPT.veggie },
			{ registerId: REG.meals, departmentId: DEPT.specials },
			{ registerId: REG.meals, departmentId: DEPT.sides },
			{ registerId: REG.meals, departmentId: DEPT.meatCookup },
			{ registerId: REG.pastry, departmentId: DEPT.pastries },
			{ registerId: REG.pastry, departmentId: DEPT.snacks },
			{ registerId: REG.pastry, departmentId: DEPT.beverages },
			{ registerId: REG.beverage, departmentId: DEPT.beverages },
			{ registerId: REG.beverage, departmentId: DEPT.localJuice },
			{ registerId: REG.beverage, departmentId: DEPT.boxes },
		])
		.onConflictDoNothing();

	// 6. Products
	console.log("  -> Products");
	await db
		.insert(schema.product)
		.values([
			{
				id: PROD.friedRiceBakedChicken,
				organizationId: ORG_ID,
				name: "Fried Rice and Baked Chicken",
				reportingName: "Fried Rice & Baked Chicken",
				reportingCategoryId: DEPT.chicken,
				price: "2200",
				taxRate: "0",
				sortOrder: 1,
			},
			{
				id: PROD.raisinRicePineapple,
				organizationId: ORG_ID,
				name: "Raisin Rice with Pineapple Chicken",
				reportingName: "Raisin Rice & Pineapple Chicken",
				reportingCategoryId: DEPT.chicken,
				price: "2200",
				taxRate: "0",
				sortOrder: 2,
			},
			{
				id: PROD.vegRiceSweetSour,
				organizationId: ORG_ID,
				name: "Vegetable Rice with Sweet and Sour Chicken",
				reportingName: "Veg Rice & S&S Chicken",
				reportingCategoryId: DEPT.chicken,
				price: "2200",
				taxRate: "0",
				sortOrder: 3,
			},
			{
				id: PROD.chowmeinBakedChicken,
				organizationId: ORG_ID,
				name: "Chowmein/Baked Chicken",
				reportingName: "Chowmein/Baked Chicken",
				reportingCategoryId: DEPT.chicken,
				price: "2200",
				taxRate: "0",
				sortOrder: 4,
			},
			{
				id: PROD.chowmeinFryChicken,
				organizationId: ORG_ID,
				name: "Chowmein/Fry Chicken",
				reportingName: "Chowmein/Fry Chicken",
				reportingCategoryId: DEPT.chicken,
				price: "2200",
				taxRate: "0",
				sortOrder: 5,
			},
			{
				id: PROD.caribbeanRiceBChicken,
				organizationId: ORG_ID,
				name: "Caribbean Rice B/Chicken",
				reportingName: "Caribbean Rice B/Chicken",
				reportingCategoryId: DEPT.chicken,
				price: "2200",
				taxRate: "0",
				sortOrder: 6,
			},
			{
				id: PROD.caribbeanRiceFChicken,
				organizationId: ORG_ID,
				name: "Caribbean Rice F/Chicken",
				reportingName: "Caribbean Rice F/Chicken",
				reportingCategoryId: DEPT.chicken,
				price: "2200",
				taxRate: "0",
				sortOrder: 7,
			},
			{
				id: PROD.cookupBakedChicken,
				organizationId: ORG_ID,
				name: "Cookup/Baked Chicken",
				reportingName: "Cookup/Baked Chicken",
				reportingCategoryId: DEPT.chicken,
				price: "2200",
				taxRate: "0",
				sortOrder: 8,
			},
			{
				id: PROD.curryChicken,
				organizationId: ORG_ID,
				name: "Curry Chicken",
				reportingName: "Curry Chicken",
				reportingCategoryId: DEPT.chicken,
				price: "2000",
				taxRate: "0",
				sortOrder: 9,
			},
			{
				id: PROD.macCheeseBakedChick,
				organizationId: ORG_ID,
				name: "Mac Cheese W/ Baked Chick",
				reportingName: "Mac Cheese W/ Baked Chick",
				reportingCategoryId: DEPT.chicken,
				price: "2200",
				taxRate: "0",
				sortOrder: 10,
			},
		])
		.onConflictDoNothing();
	await db
		.insert(schema.product)
		.values([
			{
				id: PROD.cookupBakedSnapper,
				organizationId: ORG_ID,
				name: "Cookup Baked Snapper",
				reportingName: "Cookup Baked Snapper",
				reportingCategoryId: DEPT.fish,
				price: "2500",
				taxRate: "0",
				sortOrder: 1,
			},
			{
				id: PROD.cookupFrySnapper,
				organizationId: ORG_ID,
				name: "Cookup Fry Snapper",
				reportingName: "Cookup Fry Snapper",
				reportingCategoryId: DEPT.fish,
				price: "2500",
				taxRate: "0",
				sortOrder: 2,
			},
			{
				id: PROD.currySnapper,
				organizationId: ORG_ID,
				name: "Curry Snapper",
				reportingName: "Curry Snapper",
				reportingCategoryId: DEPT.fish,
				price: "2500",
				taxRate: "0",
				sortOrder: 3,
			},
		])
		.onConflictDoNothing();
	await db
		.insert(schema.product)
		.values([
			{
				id: PROD.curryBeef,
				organizationId: ORG_ID,
				name: "Anyrice / Curry Beef",
				reportingName: "Anyrice / Curry Beef",
				reportingCategoryId: DEPT.beef,
				price: "2400",
				taxRate: "0",
				sortOrder: 1,
			},
		])
		.onConflictDoNothing();
	await db
		.insert(schema.product)
		.values([
			{
				id: PROD.vegChowmein,
				organizationId: ORG_ID,
				name: "Veg. Chowmein",
				reportingName: "Veg. Chowmein",
				reportingCategoryId: DEPT.veggie,
				price: "1500",
				taxRate: "0",
				sortOrder: 1,
			},
			{
				id: PROD.vegMealDholl,
				organizationId: ORG_ID,
				name: "Veg. Meal/Dholl",
				reportingName: "Veg. Meal/Dholl",
				reportingCategoryId: DEPT.veggie,
				price: "1500",
				taxRate: "0",
				sortOrder: 2,
			},
			{
				id: PROD.vegRice,
				organizationId: ORG_ID,
				name: "Veg. Rice",
				reportingName: "Veg. Rice",
				reportingCategoryId: DEPT.veggie,
				price: "1200",
				taxRate: "0",
				sortOrder: 3,
			},
			{
				id: PROD.veggieCookup,
				organizationId: ORG_ID,
				name: "Veggie Cookup",
				reportingName: "Veggie Cookup",
				reportingCategoryId: DEPT.veggie,
				price: "1500",
				taxRate: "0",
				sortOrder: 4,
			},
		])
		.onConflictDoNothing();
	await db
		.insert(schema.product)
		.values([
			{
				id: PROD.spongeCake,
				organizationId: ORG_ID,
				name: "Sponge Cake",
				reportingName: "Sponge Cake",
				reportingCategoryId: DEPT.pastries,
				price: "800",
				taxRate: "0",
				sortOrder: 1,
			},
			{
				id: PROD.coconutBuns,
				organizationId: ORG_ID,
				name: "Coconut Buns",
				reportingName: "Coconut Buns",
				reportingCategoryId: DEPT.pastries,
				price: "500",
				taxRate: "0",
				sortOrder: 2,
			},
			{
				id: PROD.bakedCustard,
				organizationId: ORG_ID,
				name: "Baked Custard",
				reportingName: "Baked Custard",
				reportingCategoryId: DEPT.pastries,
				price: "600",
				taxRate: "0",
				sortOrder: 3,
			},
		])
		.onConflictDoNothing();
	await db
		.insert(schema.product)
		.values([
			{
				id: PROD.drink1Lt,
				organizationId: ORG_ID,
				name: "1 Lt Drink",
				reportingName: "1 Lt Drink",
				reportingCategoryId: DEPT.beverages,
				price: "600",
				taxRate: "0",
				sortOrder: 1,
			},
			{
				id: PROD.drink12oz,
				organizationId: ORG_ID,
				name: "12oz Drink",
				reportingName: "12oz Drink",
				reportingCategoryId: DEPT.beverages,
				price: "300",
				taxRate: "0",
				sortOrder: 2,
			},
			{
				id: PROD.drink20oz,
				organizationId: ORG_ID,
				name: "20oz Drink",
				reportingName: "20oz Drink",
				reportingCategoryId: DEPT.beverages,
				price: "400",
				taxRate: "0",
				sortOrder: 3,
			},
			{
				id: PROD.coke,
				organizationId: ORG_ID,
				name: "Coke",
				reportingName: "Coke",
				reportingCategoryId: DEPT.beverages,
				price: "300",
				taxRate: "0",
				sortOrder: 4,
			},
			{
				id: PROD.water,
				organizationId: ORG_ID,
				name: "Water",
				reportingName: "Water",
				reportingCategoryId: DEPT.beverages,
				price: "200",
				taxRate: "0",
				sortOrder: 5,
			},
			{
				id: PROD.vitaMalt,
				organizationId: ORG_ID,
				name: "Vita Malt",
				reportingName: "Vita Malt",
				reportingCategoryId: DEPT.beverages,
				price: "400",
				taxRate: "0",
				sortOrder: 6,
			},
			{
				id: PROD.xlEnergy,
				organizationId: ORG_ID,
				name: "XL Energy",
				reportingName: "XL Energy",
				reportingCategoryId: DEPT.beverages,
				price: "500",
				taxRate: "0",
				sortOrder: 7,
			},
		])
		.onConflictDoNothing();
	await db
		.insert(schema.product)
		.values([
			{
				id: PROD.tamarindJuice,
				organizationId: ORG_ID,
				name: "Tamarind Juice",
				reportingName: "Tamarind Juice",
				reportingCategoryId: DEPT.localJuice,
				price: "500",
				taxRate: "0",
				sortOrder: 1,
			},
		])
		.onConflictDoNothing();
	await db
		.insert(schema.product)
		.values([
			{
				id: PROD.cookUpBBQ,
				organizationId: ORG_ID,
				name: "Cook Up BBQ",
				reportingName: "Cook Up BBQ",
				reportingCategoryId: DEPT.meatCookup,
				price: "2000",
				taxRate: "0",
				sortOrder: 1,
			},
			{
				id: PROD.cookUpFc,
				organizationId: ORG_ID,
				name: "Cook-up Fc",
				reportingName: "Cook-up Fc",
				reportingCategoryId: DEPT.meatCookup,
				price: "2000",
				taxRate: "0",
				sortOrder: 2,
			},
		])
		.onConflictDoNothing();
	await db
		.insert(schema.product)
		.values([
			{
				id: PROD.cupDhal,
				organizationId: ORG_ID,
				name: "Cup Dhal",
				reportingName: "Cup Dhal",
				reportingCategoryId: DEPT.snacks,
				price: "400",
				taxRate: "0",
				sortOrder: 1,
			},
		])
		.onConflictDoNothing();

	// 7. Custom Roles
	console.log("  -> Custom Roles");
	await db
		.insert(schema.customRole)
		.values([
			{
				id: ROLE.executive,
				organizationId: ORG_ID,
				name: "Executive",
				isSystem: true,
				permissions: {
					orders: [
						"create",
						"read",
						"update",
						"delete",
						"void",
						"refund",
						"approve",
						"override",
					],
					products: ["create", "read", "update", "delete"],
					inventory: ["create", "read", "update", "delete"],
					reports: ["read"],
					settings: ["create", "read", "update", "delete"],
					hardware: ["create", "read", "update", "delete"],
					shifts: ["create", "read", "update", "delete", "approve"],
					users: ["create", "read", "update", "delete"],
					audit: ["read"],
					departments: ["create", "read", "update", "delete", "override"],
					discounts: ["create", "apply"],
					prices: ["override"],
					invoices: ["create", "read", "update", "delete"],
					quotations: ["create", "read", "update", "delete"],
					modifiers: ["create", "read", "update", "delete"],
					customers: ["create", "read", "update", "delete"],
				},
			},
			{
				id: ROLE.owner,
				organizationId: ORG_ID,
				name: "Owner",
				isSystem: true,
				permissions: {
					orders: [
						"create",
						"read",
						"update",
						"delete",
						"void",
						"refund",
						"approve",
						"override",
					],
					products: ["create", "read", "update", "delete"],
					inventory: ["create", "read", "update", "delete", "approve"],
					reports: ["read"],
					settings: ["create", "read", "update", "delete"],
					hardware: ["create", "read", "update", "delete"],
					shifts: ["create", "read", "update", "delete", "approve"],
					users: ["create", "read", "update", "delete"],
					audit: ["read"],
					departments: ["create", "read", "update", "delete", "override"],
					discounts: ["create", "apply"],
					prices: ["override"],
					invoices: ["create", "read", "update", "delete"],
					quotations: ["create", "read", "update", "delete"],
					modifiers: ["create", "read", "update", "delete"],
					customers: ["create", "read", "update", "delete"],
				},
			},
			{
				id: ROLE.manager,
				organizationId: ORG_ID,
				name: "Manager",
				isSystem: true,
				permissions: {
					orders: ["create", "read", "update", "void", "refund", "approve"],
					products: ["create", "read", "update"],
					inventory: ["create", "read", "update", "approve"],
					reports: ["read"],
					settings: ["read", "update"],
					hardware: ["read", "update"],
					shifts: ["create", "read", "update", "approve"],
					users: ["create", "read", "update"],
					audit: ["read"],
					departments: ["read", "create", "update", "override"],
					discounts: ["apply"],
					invoices: ["create", "read", "update"],
					quotations: ["create", "read", "update"],
					modifiers: ["create", "read", "update", "delete"],
					customers: ["create", "read", "update", "delete"],
				},
			},
			{
				id: ROLE.cashier,
				organizationId: ORG_ID,
				name: "Cashier",
				isSystem: true,
				permissions: {
					orders: ["create", "read"],
					products: ["read"],
					inventory: [],
					reports: [],
					settings: [],
					hardware: [],
					shifts: ["create", "read"],
					users: [],
					audit: [],
					departments: [],
					discounts: [],
					prices: [],
					modifiers: ["read"],
					customers: ["create", "read", "update", "delete"],
				},
			},
			{
				id: ROLE.server,
				organizationId: ORG_ID,
				name: "Server",
				isSystem: true,
				permissions: {
					orders: ["create", "read", "update"],
					products: ["read"],
					inventory: [],
					reports: [],
					settings: [],
					hardware: [],
					shifts: ["create", "read"],
					users: [],
					audit: [],
				},
			},
			{
				id: ROLE.kitchen,
				organizationId: ORG_ID,
				name: "Kitchen",
				isSystem: true,
				permissions: {
					orders: ["read", "update"],
					products: ["read"],
					inventory: ["read"],
					reports: [],
					settings: [],
					hardware: [],
					shifts: [],
					users: [],
					audit: [],
				},
			},
			{
				id: ROLE.warehouseClerk,
				organizationId: ORG_ID,
				name: "Warehouse Clerk",
				isSystem: true,
				permissions: {
					orders: [],
					products: ["read"],
					inventory: ["create", "read", "update"],
					reports: ["read"],
					settings: [],
					hardware: [],
					shifts: [],
					users: [],
					audit: [],
				},
			},
			{
				id: ROLE.accountant,
				organizationId: ORG_ID,
				name: "Accountant",
				isSystem: true,
				permissions: {
					orders: ["read"],
					products: ["read"],
					inventory: ["read"],
					reports: ["read"],
					settings: [],
					hardware: [],
					shifts: ["read"],
					users: [],
					audit: ["read"],
				},
			},
		])
		.onConflictDoNothing();

	// 8. Users (admin always created; demo users only in full mode)
	console.log("  -> Users");

	if (isProduction) {
		// Production: create a single admin user with a strong random password
		const prodPassword = randomBytes(24).toString("base64url");
		const prodPasswordHash = await hashPassword(prodPassword);
		const prodPinRaw = Math.floor(100000 + Math.random() * 900000).toString();
		const prodPin = createHash("sha256").update(prodPinRaw).digest("hex");
		await db
			.insert(schema.user)
			.values({
				id: USER.admin,
				name: "Admin",
				email: "admin@bettencourt.com",
				emailVerified: true,
				role: "admin",
				organizationId: ORG_ID,
				pinHash: prodPin,
			})
			.onConflictDoNothing();
		await db
			.insert(schema.account)
			.values({
				id: "acc_admin_prod_000001",
				userId: USER.admin,
				accountId: USER.admin,
				providerId: "credential",
				password: prodPasswordHash,
			})
			.onConflictDoNothing();
		await db
			.insert(schema.member)
			.values({
				id: "mem_admin_000000000001",
				organizationId: ORG_ID,
				userId: USER.admin,
				role: "owner",
			})
			.onConflictDoNothing();
		await db
			.insert(schema.userRole)
			.values({
				userId: USER.admin,
				roleId: ROLE.executive,
				locationId: LOC_ID,
			})
			.onConflictDoNothing();

		// Seed receipt config for production
		await db
			.insert(schema.receiptConfig)
			.values({
				organizationId: ORG_ID,
				businessName: "Bettencourt's Food Inc.",
				tagline: "A True Guyanese Gem",
				addressLine1: "Georgetown, Guyana",
				phone: "+592-000-0000",
				footerMessage: "Thank you for choosing Bettencourt's!",
				showLogo: true,
			})
			.onConflictDoNothing();

		console.log("\n========================================");
		console.log("  PRODUCTION SEED COMPLETE");
		console.log("  Admin email:    admin@bettencourt.com");
		console.log(`  Admin password: ${prodPassword}`);
		console.log(`  Admin PIN:      ${prodPinRaw}`);
		console.log("  SAVE THESE CREDENTIALS NOW — not shown again");
		console.log("========================================\n");
		process.exit(0);
	}

	// Full mode: all demo users
	// PINs: Admin=1234, Bonita=5678, Cashier=1111, Production=2222, Anna=3333, Carl=4444, Renatta=5555
	const pinAdmin = createHash("sha256").update("1234").digest("hex");
	const pinBonita = createHash("sha256").update("5678").digest("hex");
	const pinCashier = createHash("sha256").update("1111").digest("hex");
	const pinProduction = createHash("sha256").update("2222").digest("hex");
	const pinAnna = createHash("sha256").update("3333").digest("hex");
	const pinCarl = createHash("sha256").update("4444").digest("hex");
	const pinRenatta = createHash("sha256").update("5555").digest("hex");

	await db
		.insert(schema.user)
		.values([
			{
				id: USER.admin,
				name: "Admin",
				email: "admin@bettencourt.com",
				emailVerified: true,
				role: "admin",
				organizationId: ORG_ID,
				pinHash: pinAdmin,
			},
			{
				id: USER.bonita,
				name: "Bonita",
				email: "bonita@bettencourt.com",
				emailVerified: true,
				role: "admin",
				organizationId: ORG_ID,
				pinHash: pinBonita,
			},
			{
				id: USER.cashier,
				name: "Cashier 1",
				email: "cashier@bettencourt.com",
				emailVerified: true,
				role: "user",
				organizationId: ORG_ID,
				pinHash: pinCashier,
			},
			{
				id: USER.production,
				name: "Production",
				email: "production@bettencourt.com",
				emailVerified: true,
				role: "user",
				organizationId: ORG_ID,
				pinHash: pinProduction,
			},
			{
				id: USER.anna,
				name: "Anna",
				email: "anna@bettencourt.com",
				emailVerified: true,
				role: "user",
				organizationId: ORG_ID,
				pinHash: pinAnna,
			},
			{
				id: USER.carl,
				name: "Carl",
				email: "carl@bettencourt.com",
				emailVerified: true,
				role: "user",
				organizationId: ORG_ID,
				pinHash: pinCarl,
			},
			{
				id: USER.renatta,
				name: "Renatta",
				email: "renatta@bettencourt.com",
				emailVerified: true,
				role: "user",
				organizationId: ORG_ID,
				pinHash: pinRenatta,
			},
		])
		.onConflictDoNothing();
	await db
		.insert(schema.account)
		.values([
			{
				id: "acct_admin_000000000001",
				accountId: USER.admin,
				providerId: "credential",
				userId: USER.admin,
				password: passwordHash,
			},
			{
				id: "acct_bonita_00000000001",
				accountId: USER.bonita,
				providerId: "credential",
				userId: USER.bonita,
				password: passwordHash,
			},
			{
				id: "acct_cashier_0000000001",
				accountId: USER.cashier,
				providerId: "credential",
				userId: USER.cashier,
				password: passwordHash,
			},
			{
				id: "acct_production_000001",
				accountId: USER.production,
				providerId: "credential",
				userId: USER.production,
				password: passwordHash,
			},
			{
				id: "acct_anna_0000000000001",
				accountId: USER.anna,
				providerId: "credential",
				userId: USER.anna,
				password: passwordHash,
			},
			{
				id: "acct_carl_0000000000001",
				accountId: USER.carl,
				providerId: "credential",
				userId: USER.carl,
				password: passwordHash,
			},
			{
				id: "acct_renatta_000000001",
				accountId: USER.renatta,
				providerId: "credential",
				userId: USER.renatta,
				password: passwordHash,
			},
		])
		.onConflictDoNothing();
	await db
		.insert(schema.member)
		.values([
			{
				id: "mem_admin_0000000000001",
				organizationId: ORG_ID,
				userId: USER.admin,
				role: "owner",
			},
			{
				id: "mem_bonita_000000000001",
				organizationId: ORG_ID,
				userId: USER.bonita,
				role: "owner",
			},
			{
				id: "mem_cashier_000000000001",
				organizationId: ORG_ID,
				userId: USER.cashier,
				role: "member",
			},
			{
				id: "mem_production_00000001",
				organizationId: ORG_ID,
				userId: USER.production,
				role: "member",
			},
			{
				id: "mem_anna_00000000000001",
				organizationId: ORG_ID,
				userId: USER.anna,
				role: "member",
			},
			{
				id: "mem_carl_00000000000001",
				organizationId: ORG_ID,
				userId: USER.carl,
				role: "member",
			},
			{
				id: "mem_renatta_0000000001",
				organizationId: ORG_ID,
				userId: USER.renatta,
				role: "member",
			},
		])
		.onConflictDoNothing();
	await db
		.insert(schema.userRole)
		.values([
			{ userId: USER.admin, roleId: ROLE.executive, locationId: LOC_ID },
			{ userId: USER.bonita, roleId: ROLE.executive, locationId: LOC_ID },
			{ userId: USER.cashier, roleId: ROLE.cashier, locationId: LOC_ID },
			{ userId: USER.production, roleId: ROLE.kitchen, locationId: LOC_ID },
			{ userId: USER.anna, roleId: ROLE.cashier, locationId: LOC_ID },
			{ userId: USER.carl, roleId: ROLE.cashier, locationId: LOC_ID },
			{
				userId: USER.renatta,
				roleId: ROLE.cashier,
				locationId: LOC_QUICK_SERVE,
			},
		])
		.onConflictDoNothing();

	// Update existing users (names, PIN hashes) in case they already exist from a prior seed
	console.log("  -> Updating user names & PIN hashes");
	await db
		.update(schema.user)
		.set({ name: "Admin", pinHash: pinAdmin })
		.where(eq(schema.user.id, USER.admin));
	await db
		.update(schema.user)
		.set({ name: "Bonita", pinHash: pinBonita })
		.where(eq(schema.user.id, USER.bonita));
	await db
		.update(schema.user)
		.set({ name: "Cashier 1", pinHash: pinCashier })
		.where(eq(schema.user.id, USER.cashier));
	await db
		.update(schema.user)
		.set({ name: "Production", pinHash: pinProduction })
		.where(eq(schema.user.id, USER.production));
	await db
		.update(schema.user)
		.set({ name: "Anna", pinHash: pinAnna })
		.where(eq(schema.user.id, USER.anna));
	await db
		.update(schema.user)
		.set({ name: "Carl", pinHash: pinCarl })
		.where(eq(schema.user.id, USER.carl));
	await db
		.update(schema.user)
		.set({ name: "Renatta", pinHash: pinRenatta })
		.where(eq(schema.user.id, USER.renatta));

	// 9. Tax Rates
	console.log("  -> Tax Rates");
	await db
		.insert(schema.taxRate)
		.values([
			{
				id: "af000000-0000-4000-8000-000000000001",
				organizationId: ORG_ID,
				name: "Sales Tax",
				rate: "0.0875",
				isDefault: true,
			},
			{
				id: "af000000-0000-4000-8000-000000000002",
				organizationId: ORG_ID,
				name: "Alcohol Tax",
				rate: "0.1200",
				isDefault: false,
			},
		])
		.onConflictDoNothing();

	// 10. Suppliers
	console.log("  -> Suppliers");
	await db
		.insert(schema.supplier)
		.values([
			{
				id: SUPPLIER.freshFoods,
				organizationId: ORG_ID,
				name: "Fresh Foods Supply",
				contactName: "John Smith",
				email: "john@freshfoods.com",
				phone: "555-0101",
			},
			{
				id: SUPPLIER.bevDist,
				organizationId: ORG_ID,
				name: "Beverage Distributors",
				contactName: "Jane Doe",
				email: "jane@bevdist.com",
				phone: "555-0102",
			},
		])
		.onConflictDoNothing();

	// Real vendors from Vendor.xlsx (Bettencourt's actual supplier list)
	await db
		.insert(schema.supplier)
		.values([
			// Food & grocery suppliers (1xxx)
			{
				id: SUPP(1001),
				organizationId: ORG_ID,
				name: "Alabama Trading",
				phone: "592-225-5800",
				address: "21-22 Princess & Hayley Sts",
				categories: ["Food & Beverage"],
			},
			{
				id: SUPP(1002),
				organizationId: ORG_ID,
				name: "Ansa McAl",
				phone: "592-220-0796",
				address: "60-63 Industrial Site",
				categories: ["Food & Beverage", "Cleaning Supplies"],
			},
			{
				id: SUPP(1003),
				organizationId: ORG_ID,
				name: "Rayo Trading",
				phone: "592-681-2897",
				address: "611 Sand Reef",
				categories: ["Food & Beverage"],
			},
			{
				id: SUPP(1004),
				organizationId: ORG_ID,
				name: "Bank DIH Ltd",
				phone: "592-226-2491",
				address: "Thirst Park",
				categories: ["Beverages"],
			},
			{
				id: SUPP(1005),
				organizationId: ORG_ID,
				name: "D.Singh Trading",
				phone: "592-225-9052",
				address: "36 Delph Street & Campbell Ave",
				categories: ["Food & Beverage"],
			},
			{
				id: SUPP(1006),
				organizationId: ORG_ID,
				name: "Acado / DeSinco Limited",
				phone: "592-226-7109",
				address: "47-48 John & Sheriff Sts",
				categories: ["Food & Beverage", "Cleaning Supplies"],
			},
			{
				id: SUPP(1007),
				organizationId: ORG_ID,
				name: "Edward B Beharry Co. Ltd",
				phone: "592-227-0632",
				address: "191 Wellington & Charlott Str",
				categories: ["Food & Beverage"],
			},
			{
				id: SUPP(1008),
				organizationId: ORG_ID,
				name: "Andrews Enterprise",
				phone: "592-226-8652",
				address: "Hadfield St Worthmanville",
				categories: ["Food & Beverage"],
			},
			{
				id: SUPP(1009),
				organizationId: ORG_ID,
				name: "Guyana Beverage Inc.",
				phone: "592-216-1516",
				address: "Plot 4A Area AA1 Plantation",
				categories: ["Beverages"],
			},
			{
				id: SUPP(1010),
				organizationId: ORG_ID,
				name: "Guymex / Imex International",
				phone: "592-226-5247",
				address: "203 Middle Street",
				categories: ["Food & Beverage"],
			},
			{
				id: SUPP(1011),
				organizationId: ORG_ID,
				name: "I&S Trading",
				phone: "592-503-1421",
				address: "218 Charlotte & Oronoque Str",
				categories: ["Food & Beverage"],
			},
			{
				id: SUPP(1012),
				organizationId: ORG_ID,
				name: "J's Business Enterprise",
				phone: "592-225-4314",
				address: "215 South Road",
				categories: ["Food & Beverage"],
			},
			{
				id: SUPP(1013),
				organizationId: ORG_ID,
				name: "K&P Persaud & Daughters",
				phone: "592-254-0067",
				address: "100 New Road",
				categories: ["Food & Beverage"],
			},
			{
				id: SUPP(1014),
				organizationId: ORG_ID,
				name: "King & Regent St Service Centre",
				phone: "592-225-7023",
				address: "Regent & King Street",
				categories: ["Repairs & Maintenance"],
			},
			{
				id: SUPP(1015),
				organizationId: ORG_ID,
				name: "Low's Shell Gas Station",
				phone: "592-226-2734",
				address: "Vlissengen Road",
				categories: ["Delivery & Transport"],
			},
			{
				id: SUPP(1016),
				organizationId: ORG_ID,
				name: "Massy Gas Products",
				phone: "592-223-2728",
				address: "Old Road",
				categories: ["Utilities"],
			},
			{
				id: SUPP(1017),
				organizationId: ORG_ID,
				name: "Royal Chicken-Mohamed Farms",
				phone: "592-266-5382",
				address: "60 Garden Of Eden",
				categories: ["Food & Beverage"],
			},
			{
				id: SUPP(1018),
				organizationId: ORG_ID,
				name: "Mohamed Kassim",
				phone: "592-688-7949",
				address: "130 Third Street",
				categories: ["Food & Beverage"],
			},
			{
				id: SUPP(1019),
				organizationId: ORG_ID,
				name: "Muneshwar's LTD",
				phone: "592-227-7417",
				address: "45-47 Water Street",
				categories: ["Food & Beverage"],
			},
			{
				id: SUPP(1020),
				organizationId: ORG_ID,
				name: "Najab's Trading",
				phone: "592-225-0517",
				address: "38-39 Robb Street",
				categories: ["Food & Beverage"],
			},
			{
				id: SUPP(1021),
				organizationId: ORG_ID,
				name: "Namilco / N&S Prasad Distribution",
				phone: "592-227-6830",
				address: "67 Dowling Street Kitty",
				categories: ["Food & Beverage"],
			},
			{
				id: SUPP(1022),
				organizationId: ORG_ID,
				name: "Sterling Product Limited",
				phone: "592-265-7407",
				address: "Providence",
				categories: ["Food & Beverage"],
			},
			{
				id: SUPP(1023),
				organizationId: ORG_ID,
				name: "Toucan Industries",
				phone: "592-226-1188",
				address: "10 Water Street",
				categories: ["Food & Beverage"],
			},
			{
				id: SUPP(1024),
				organizationId: ORG_ID,
				name: "WJ Enterprise",
				phone: "592-226-6246",
				address: "126 Regent Street",
				categories: ["Food & Beverage"],
			},
			{
				id: SUPP(1025),
				organizationId: ORG_ID,
				name: "Memorex Enterprise",
				phone: "592-333-3900",
				address: "29 Strand, New Amsterdam",
				categories: ["Office Supplies"],
			},
			{
				id: SUPP(1026),
				organizationId: ORG_ID,
				name: "A.Lall Enterprise",
				categories: ["Food & Beverage"],
			},
			{
				id: SUPP(1027),
				organizationId: ORG_ID,
				name: "Hack Halaal",
				phone: "592-223-2685",
				address: "Durban & Hrdina Street",
				categories: ["Food & Beverage"],
			},
			{
				id: SUPP(1028),
				organizationId: ORG_ID,
				name: "Family Food International",
				phone: "592-231-8321",
				address: "47-48 Hadfields Street",
				categories: ["Food & Beverage"],
			},
			{
				id: SUPP(1029),
				organizationId: ORG_ID,
				name: "Gafsons Industries Limited",
				categories: ["Food & Beverage"],
			},
			{
				id: SUPP(1030),
				organizationId: ORG_ID,
				name: "Ricks & Sari",
				phone: "592-225-4230",
				address: "40 Station Street",
				categories: ["Food & Beverage"],
			},
			{
				id: SUPP(1031),
				organizationId: ORG_ID,
				name: "Caribbean Chemicals",
				categories: ["Cleaning Supplies"],
			},
			{
				id: SUPP(1032),
				organizationId: ORG_ID,
				name: "Demerara Distiller Limited",
				phone: "592-265-5000",
				address: "Plantation Diamond",
				categories: ["Beverages"],
			},
			{
				id: SUPP(1033),
				organizationId: ORG_ID,
				name: "Albadar Grocery",
				categories: ["Food & Beverage"],
			},
			{
				id: SUPP(1034),
				organizationId: ORG_ID,
				name: "Narine's Liquor Store",
				phone: "592-226-3663",
				address: "40 Robb Street",
				categories: ["Beverages"],
			},
			{
				id: SUPP(1035),
				organizationId: ORG_ID,
				name: "MD Imports",
				phone: "592-225-7196",
				address: "183 Barr Street",
				categories: ["Food & Beverage"],
			},
			{
				id: SUPP(1036),
				organizationId: ORG_ID,
				name: "Hint of Spice",
				phone: "592-680-7284",
				address: "Lot 4 Independence St",
				categories: ["Food & Beverage"],
			},
			// Service & utility vendors (2xxx)
			{
				id: SUPP(2000),
				organizationId: ORG_ID,
				name: "Evans & Sons Auto Work",
				phone: "592-227-3663",
				address: "184 Fourth Street",
				categories: ["Repairs & Maintenance"],
			},
			{
				id: SUPP(2001),
				organizationId: ORG_ID,
				name: "Guyana Telephone & Telegraph Co.",
				phone: "592-227-4660",
				address: "79 Brickdam",
				categories: ["Utilities"],
			},
			{
				id: SUPP(2002),
				organizationId: ORG_ID,
				name: "Guyana Power & Light",
				phone: "592-226-2606",
				address: "40 Main Street",
				categories: ["Utilities"],
			},
			{
				id: SUPP(2003),
				organizationId: ORG_ID,
				name: "Guyana Water Inc.",
				phone: "592-225-0471",
				address: "Church St & Vlissengen Road",
				categories: ["Utilities"],
			},
			{
				id: SUPP(2004),
				organizationId: ORG_ID,
				name: "Puran's Brother Disposal Inc",
				phone: "592-264-1239",
				address: "7 Bella Street",
				categories: ["Miscellaneous"],
			},
			{
				id: SUPP(2005),
				organizationId: ORG_ID,
				name: "Barko's Trading",
				phone: "592-669-7798",
				address: "38 Durban Street",
				categories: ["Food & Beverage"],
			},
			{
				id: SUPP(2006),
				organizationId: ORG_ID,
				name: "Permaul Trading",
				categories: ["Food & Beverage"],
			},
			{
				id: SUPP(2007),
				organizationId: ORG_ID,
				name: "Kissoon Dyal Enterprise Inc",
				phone: "592-228-5677",
				address: "77 Chelsea Park Mahaica",
				categories: ["Food & Beverage"],
			},
			{
				id: SUPP(2008),
				organizationId: ORG_ID,
				name: "Distribution Services Limited",
				phone: "592-225-5002",
				address: "28 Sheriff Street",
				categories: ["Delivery & Transport"],
			},
			{
				id: SUPP(2009),
				organizationId: ORG_ID,
				name: "V&N Distributions",
				phone: "592-647-7894",
				address: "294 Hope Estate",
				categories: ["Food & Beverage"],
			},
			{
				id: SUPP(2010),
				organizationId: ORG_ID,
				name: "Bounty Farm Ltd",
				categories: ["Food & Beverage"],
			},
			{
				id: SUPP(2011),
				organizationId: ORG_ID,
				name: "Bakewell",
				categories: ["Food & Beverage"],
			},
			{
				id: SUPP(2012),
				organizationId: ORG_ID,
				name: "Massy Stores",
				categories: ["Food & Beverage"],
			},
			{
				id: SUPP(2013),
				organizationId: ORG_ID,
				name: "Massy Trading",
				categories: ["Food & Beverage"],
			},
			{
				id: SUPP(2014),
				organizationId: ORG_ID,
				name: "The Nut Hut",
				categories: ["Food & Beverage"],
			},
			{
				id: SUPP(2015),
				organizationId: ORG_ID,
				name: "Survival Supermarket",
				categories: ["Food & Beverage"],
			},
			{
				id: SUPP(2016),
				organizationId: ORG_ID,
				name: "J&J",
				categories: ["Food & Beverage"],
			},
			{
				id: SUPP(2017),
				organizationId: ORG_ID,
				name: "Andrews Supermarket",
				categories: ["Food & Beverage"],
			},
			{
				id: SUPP(2018),
				organizationId: ORG_ID,
				name: "M.S Imports",
				phone: "592-223-6262",
				address: "154 Regent Road Boarda",
				categories: ["Food & Beverage"],
			},
			{
				id: SUPP(2019),
				organizationId: ORG_ID,
				name: "Guyana Breweries Inc",
				categories: ["Beverages"],
			},
			{
				id: SUPP(2020),
				organizationId: ORG_ID,
				name: "China Trading",
				categories: ["Food & Beverage"],
			},
			{
				id: SUPP(2021),
				organizationId: ORG_ID,
				name: "Aubrey's Bakery",
				categories: ["Food & Beverage"],
			},
			{
				id: SUPP(2022),
				organizationId: ORG_ID,
				name: "M's Service Station",
				categories: ["Delivery & Transport"],
			},
			{
				id: SUPP(2023),
				organizationId: ORG_ID,
				name: "Mattai's",
				categories: ["Food & Beverage"],
			},
			{
				id: SUPP(2024),
				organizationId: ORG_ID,
				name: "Forrester's",
				phone: "592-703-7261",
				address: "Lot 31-32 Bagotstown",
				categories: ["Food & Beverage"],
			},
			{
				id: SUPP(2025),
				organizationId: ORG_ID,
				name: "Beepats",
				categories: ["Food & Beverage"],
			},
			{
				id: SUPP(2026),
				organizationId: ORG_ID,
				name: "Umbrella Investments",
				categories: ["Miscellaneous"],
			},
			// Government & compliance (4xxx)
			{
				id: SUPP(4000),
				organizationId: ORG_ID,
				name: "National Insurance Scheme",
				phone: "592-226-8058",
				address: "6 Camp & Bent Street",
				categories: ["Miscellaneous"],
			},
			{
				id: SUPP(4001),
				organizationId: ORG_ID,
				name: "Guyana Revenue Authority",
				phone: "592-227-8222",
				address: "200-201 Camp Street",
				categories: ["Miscellaneous"],
			},
			{
				id: SUPP(4002),
				organizationId: ORG_ID,
				name: "Demerara Fire & General",
				categories: ["Miscellaneous"],
			},
		])
		.onConflictDoNothing();

	// ── Production seed mode: stop here, create admin user, print credentials ──
	if (seedMode === "production") {
		console.log("\n  [PRODUCTION MODE] Structural data seeded successfully.");
		console.log("  Creating production admin user...");
		const { randomBytes } = await import("node:crypto");
		const adminPassword = randomBytes(16).toString("hex");
		const adminPasswordHash = await hashPassword(adminPassword);
		const adminEmail = "admin@bettencourts.com";
		const adminUserId = `usr_admin_prod_${Date.now()}`;
		await db
			.insert(schema.user)
			.values({
				id: adminUserId,
				name: "Administrator",
				email: adminEmail,
				emailVerified: true,
				role: "admin",
				createdAt: new Date(),
				updatedAt: new Date(),
			})
			.onConflictDoNothing();
		await db
			.insert(schema.account)
			.values({
				id: `acc_admin_prod_${Date.now()}`,
				userId: adminUserId,
				accountId: adminUserId,
				providerId: "credential",
				password: adminPasswordHash,
				createdAt: new Date(),
				updatedAt: new Date(),
			})
			.onConflictDoNothing();
		await db
			.insert(schema.member)
			.values({
				id: `mem_admin_prod_${Date.now()}`,
				organizationId: ORG_ID,
				userId: adminUserId,
				role: "owner",
				createdAt: new Date(),
			})
			.onConflictDoNothing();
		console.log("\n  ╔══════════════════════════════════════════╗");
		console.log("  ║       PRODUCTION ADMIN CREDENTIALS       ║");
		console.log("  ╠══════════════════════════════════════════╣");
		console.log(`  ║  Email:    ${adminEmail.padEnd(30)} ║`);
		console.log(`  ║  Password: ${adminPassword.padEnd(30)} ║`);
		console.log("  ║                                          ║");
		console.log("  ║  SAVE THESE — they will not be shown     ║");
		console.log("  ║  again. Change the password after login. ║");
		console.log("  ╚══════════════════════════════════════════╝\n");
		console.log("Seed complete (production mode)!");
		process.exit(0);
	}

	// ═══════════════════════════════════════════════════════════════════════
	// MOCK TRANSACTIONAL DATA
	// ═══════════════════════════════════════════════════════════════════════
	// On re-seed, delete stale transactional data so timestamps refresh to "now".
	// Static data (org, location, registers, departments, products) uses onConflictDoNothing.
	console.log("  -> Cleaning stale transactional seed data");
	const seedOrderIds = Object.values(ORDER);
	const seedCashIds = Object.values(CASH_SESSION);
	const seedPOIds = Object.values(PO);
	// Delete in reverse-dependency order (children before parents)
	await db.execute(sql`DELETE FROM audit_log WHERE id::text LIKE 'ff000000%'`);
	await db.execute(
		sql`DELETE FROM production_log WHERE id::text LIKE 'fe000000%'`,
	);
	await db.execute(
		sql`DELETE FROM kitchen_order_item WHERE id::text LIKE 'f5100000%'`,
	);
	await db.execute(
		sql`DELETE FROM kitchen_order_ticket WHERE id::text LIKE 'f5000000%'`,
	);
	await db.execute(
		sql`DELETE FROM cash_payout WHERE id::text LIKE 'f4100000%'`,
	);
	await db.execute(sql`DELETE FROM cash_drop WHERE id::text LIKE 'f4000000%'`);
	await db
		.delete(schema.cashSession)
		.where(inArray(schema.cashSession.id, seedCashIds));
	await db.execute(sql`DELETE FROM payment WHERE id::text LIKE 'f3000000%'`);
	await db.execute(
		sql`DELETE FROM order_line_item WHERE id::text LIKE 'f2000000%'`,
	);
	// Clear table references before deleting orders
	await db.execute(
		sql`UPDATE table_layout SET current_order_id = NULL, status = 'available' WHERE current_order_id IS NOT NULL`,
	);
	await db.delete(schema.order).where(inArray(schema.order.id, seedOrderIds));
	await db.execute(
		sql`DELETE FROM purchase_order_line WHERE id::text LIKE 'fd100000%'`,
	);
	await db
		.delete(schema.purchaseOrder)
		.where(inArray(schema.purchaseOrder.id, seedPOIds));
	await db.execute(sql`DELETE FROM waste_log WHERE id::text LIKE 'ec000000%'`);
	await db.execute(sql`DELETE FROM time_entry WHERE id::text LIKE 'ed000000%'`);
	await db.execute(sql`DELETE FROM invoice WHERE id::text LIKE 'ee000000%'`);
	await db.execute(sql`DELETE FROM quotation WHERE id::text LIKE 'ef000000%'`);
	await db.execute(
		sql`DELETE FROM discount_rule WHERE id::text LIKE 'ab000000%'`,
	);
	const seedOrderExtIds = Object.values(ORDER_EXT);
	await db
		.delete(schema.order)
		.where(inArray(schema.order.id, seedOrderExtIds));
	await db.delete(schema.productProductionComponent);
	await db.execute(
		sql`DELETE FROM production_log WHERE id::text LIKE 'fe000000%'`,
	);
	// T8-T10 cleanup: stock alerts, recipe ingredients, menu schedules, barcodes
	await db.execute(
		sql`DELETE FROM stock_alert WHERE id::text LIKE 'a4000000%'`,
	);
	await db.execute(
		sql`DELETE FROM recipe_ingredient WHERE id::text LIKE 'a3000000%'`,
	);
	await db.execute(
		sql`DELETE FROM menu_schedule_product WHERE menu_schedule_id::text LIKE 'ae000000%'`,
	);
	await db.execute(
		sql`DELETE FROM menu_schedule WHERE id::text LIKE 'ae000000%'`,
	);
	await db.execute(
		sql`DELETE FROM product_barcode WHERE id::text LIKE 'a2000000%'`,
	);
	// T2-T6 ELI line items and loyalty transaction
	await db.execute(
		sql`DELETE FROM order_line_item WHERE id::text LIKE 'f6000000%'`,
	);
	// LTXN(16) = GT-032 loyalty redeem transaction
	await db.execute(
		sql`DELETE FROM loyalty_transaction WHERE id = '1d000000-0000-4000-8000-000000000016'`,
	);

	// 11. Table Layouts
	console.log("  -> Table Layouts");
	await db
		.insert(schema.tableLayout)
		.values([
			{
				id: TABLE.t1,
				locationId: LOC_ID,
				name: "Table 1",
				section: "Indoor",
				seats: 4,
				positionX: 100,
				positionY: 100,
				shape: "square",
				status: "available",
			},
			{
				id: TABLE.t2,
				locationId: LOC_ID,
				name: "Table 2",
				section: "Indoor",
				seats: 4,
				positionX: 250,
				positionY: 100,
				shape: "square",
				status: "available",
			},
			{
				id: TABLE.t3,
				locationId: LOC_ID,
				name: "Table 3",
				section: "Indoor",
				seats: 6,
				positionX: 400,
				positionY: 100,
				shape: "rectangle",
				status: "available",
			},
			{
				id: TABLE.t4,
				locationId: LOC_ID,
				name: "Table 4",
				section: "Indoor",
				seats: 2,
				positionX: 100,
				positionY: 250,
				shape: "round",
				status: "available",
			},
			{
				id: TABLE.t5,
				locationId: LOC_ID,
				name: "Table 5",
				section: "Indoor",
				seats: 4,
				positionX: 250,
				positionY: 250,
				shape: "square",
				status: "reserved",
			},
			{
				id: TABLE.t6,
				locationId: LOC_ID,
				name: "Table 6",
				section: "Indoor",
				seats: 8,
				positionX: 400,
				positionY: 250,
				shape: "rectangle",
				status: "available",
			},
			{
				id: TABLE.t7,
				locationId: LOC_ID,
				name: "Patio 1",
				section: "Outdoor",
				seats: 4,
				positionX: 100,
				positionY: 100,
				shape: "round",
				status: "available",
			},
			{
				id: TABLE.t8,
				locationId: LOC_ID,
				name: "Patio 2",
				section: "Outdoor",
				seats: 4,
				positionX: 250,
				positionY: 100,
				shape: "round",
				status: "available",
			},
			{
				id: TABLE.t9,
				locationId: LOC_ID,
				name: "Patio 3",
				section: "Outdoor",
				seats: 6,
				positionX: 400,
				positionY: 100,
				shape: "rectangle",
				status: "available",
			},
			{
				id: TABLE.t10,
				locationId: LOC_ID,
				name: "Bar 1",
				section: "Bar",
				seats: 2,
				positionX: 100,
				positionY: 100,
				shape: "round",
				status: "available",
			},
			{
				id: TABLE.t11,
				locationId: LOC_ID,
				name: "Bar 2",
				section: "Bar",
				seats: 2,
				positionX: 200,
				positionY: 100,
				shape: "round",
				status: "available",
			},
			{
				id: TABLE.t12,
				locationId: LOC_ID,
				name: "Bar 3",
				section: "Bar",
				seats: 2,
				positionX: 300,
				positionY: 100,
				shape: "round",
				status: "available",
			},
		])
		.onConflictDoNothing();

	// 12. Orders (spread across last 7 days)
	console.log("  -> Orders");
	await db
		.insert(schema.order)
		.values([
			{
				id: ORDER.o1,
				organizationId: ORG_ID,
				locationId: LOC_ID,
				registerId: REG.meals,
				userId: USER.cashier,
				orderNumber: "GT-001",
				type: "sale",
				status: "completed",
				subtotal: "6400",
				taxTotal: "0",
				total: "6400",
				createdAt: daysAgo(6, 10),
			},
			{
				id: ORDER.o2,
				organizationId: ORG_ID,
				locationId: LOC_ID,
				registerId: REG.meals,
				userId: USER.cashier,
				orderNumber: "GT-002",
				type: "sale",
				status: "completed",
				subtotal: "4500",
				taxTotal: "0",
				total: "4500",
				createdAt: daysAgo(6, 11),
			},
			{
				id: ORDER.o3,
				organizationId: ORG_ID,
				locationId: LOC_ID,
				registerId: REG.meals,
				userId: USER.admin,
				orderNumber: "GT-003",
				type: "sale",
				status: "completed",
				subtotal: "8800",
				taxTotal: "0",
				total: "8800",
				createdAt: daysAgo(5, 12),
			},
			{
				id: ORDER.o4,
				organizationId: ORG_ID,
				locationId: LOC_ID,
				registerId: REG.pastry,
				userId: USER.cashier,
				orderNumber: "GT-004",
				type: "sale",
				status: "completed",
				subtotal: "2100",
				taxTotal: "0",
				total: "2100",
				createdAt: daysAgo(5, 13),
			},
			{
				id: ORDER.o5,
				organizationId: ORG_ID,
				locationId: LOC_ID,
				registerId: REG.meals,
				userId: USER.cashier,
				orderNumber: "GT-005",
				type: "sale",
				status: "completed",
				subtotal: "7400",
				taxTotal: "0",
				total: "7400",
				createdAt: daysAgo(4, 11),
			},
			{
				id: ORDER.o6,
				organizationId: ORG_ID,
				locationId: LOC_ID,
				registerId: REG.beverage,
				userId: USER.cashier,
				orderNumber: "GT-006",
				type: "sale",
				status: "completed",
				subtotal: "1600",
				taxTotal: "0",
				total: "1600",
				createdAt: daysAgo(4, 14),
			},
			{
				id: ORDER.o7,
				organizationId: ORG_ID,
				locationId: LOC_ID,
				registerId: REG.meals,
				userId: USER.admin,
				orderNumber: "GT-007",
				type: "sale",
				status: "completed",
				subtotal: "9300",
				taxTotal: "0",
				total: "9300",
				createdAt: daysAgo(3, 10),
			},
			{
				id: ORDER.o8,
				organizationId: ORG_ID,
				locationId: LOC_ID,
				registerId: REG.meals,
				userId: USER.cashier,
				orderNumber: "GT-008",
				type: "sale",
				status: "completed",
				subtotal: "4400",
				taxTotal: "0",
				total: "4400",
				createdAt: daysAgo(3, 12),
			},
			{
				id: ORDER.o9,
				organizationId: ORG_ID,
				locationId: LOC_ID,
				registerId: REG.pastry,
				userId: USER.cashier,
				orderNumber: "GT-009",
				type: "sale",
				status: "completed",
				subtotal: "1900",
				taxTotal: "0",
				total: "1900",
				createdAt: daysAgo(3, 15),
			},
			{
				id: ORDER.o10,
				organizationId: ORG_ID,
				locationId: LOC_ID,
				registerId: REG.meals,
				userId: USER.cashier,
				orderNumber: "GT-010",
				type: "sale",
				status: "completed",
				subtotal: "6800",
				taxTotal: "0",
				total: "6800",
				createdAt: daysAgo(2, 11),
			},
			{
				id: ORDER.o11,
				organizationId: ORG_ID,
				locationId: LOC_ID,
				registerId: REG.meals,
				userId: USER.admin,
				orderNumber: "GT-011",
				type: "sale",
				status: "completed",
				subtotal: "5000",
				taxTotal: "0",
				total: "5000",
				createdAt: daysAgo(2, 13),
			},
			{
				id: ORDER.o12,
				organizationId: ORG_ID,
				locationId: LOC_ID,
				registerId: REG.beverage,
				userId: USER.cashier,
				orderNumber: "GT-012",
				type: "sale",
				status: "completed",
				subtotal: "2400",
				taxTotal: "0",
				total: "2400",
				createdAt: daysAgo(2, 14),
			},
			{
				id: ORDER.o13,
				organizationId: ORG_ID,
				locationId: LOC_ID,
				registerId: REG.meals,
				userId: USER.cashier,
				orderNumber: "GT-013",
				type: "sale",
				status: "completed",
				subtotal: "11000",
				taxTotal: "0",
				total: "11000",
				createdAt: daysAgo(1, 10),
			},
			{
				id: ORDER.o14,
				organizationId: ORG_ID,
				locationId: LOC_ID,
				registerId: REG.meals,
				userId: USER.admin,
				orderNumber: "GT-014",
				type: "sale",
				status: "completed",
				subtotal: "5000",
				taxTotal: "0",
				total: "5000",
				createdAt: daysAgo(1, 12),
			},
			{
				id: ORDER.o15,
				organizationId: ORG_ID,
				locationId: LOC_ID,
				registerId: REG.pastry,
				userId: USER.cashier,
				orderNumber: "GT-015",
				type: "sale",
				status: "completed",
				subtotal: "2700",
				taxTotal: "0",
				total: "2700",
				createdAt: daysAgo(1, 14),
			},
			{
				id: ORDER.o16,
				organizationId: ORG_ID,
				locationId: LOC_ID,
				registerId: REG.meals,
				userId: USER.cashier,
				orderNumber: "GT-016",
				type: "sale",
				status: "voided",
				subtotal: "2200",
				taxTotal: "0",
				total: "2200",
				notes: "Customer changed mind",
				createdAt: daysAgo(1, 15),
			},
			{
				id: ORDER.o17,
				organizationId: ORG_ID,
				locationId: LOC_ID,
				registerId: REG.meals,
				userId: USER.cashier,
				orderNumber: "GT-017",
				type: "dine_in",
				status: "open",
				subtotal: "4400",
				taxTotal: "0",
				total: "4400",
				tableId: TABLE.t1,
				createdAt: daysAgo(0, 11),
			},
			{
				id: ORDER.o18,
				organizationId: ORG_ID,
				locationId: LOC_ID,
				registerId: REG.meals,
				userId: USER.admin,
				orderNumber: "GT-018",
				type: "dine_in",
				status: "open",
				subtotal: "7000",
				taxTotal: "0",
				total: "7000",
				tableId: TABLE.t4,
				customerName: "Mr. Singh",
				createdAt: daysAgo(0, 11),
			},
			{
				id: ORDER.o19,
				organizationId: ORG_ID,
				locationId: LOC_ID,
				registerId: REG.meals,
				userId: USER.cashier,
				orderNumber: "GT-019",
				type: "sale",
				status: "completed",
				subtotal: "6600",
				taxTotal: "0",
				total: "6600",
				createdAt: daysAgo(0, 9),
			},
			{
				id: ORDER.o20,
				organizationId: ORG_ID,
				locationId: LOC_ID,
				registerId: REG.beverage,
				userId: USER.cashier,
				orderNumber: "GT-020",
				type: "pickup",
				status: "open",
				subtotal: "3100",
				taxTotal: "0",
				total: "3100",
				customerName: "Maria",
				customerPhone: "592-600-1234",
				fulfillmentStatus: "preparing",
				createdAt: daysAgo(0, 11),
			},
		])
		.onConflictDoNothing();

	// Update tables with current order IDs
	console.log("  -> Table assignments");
	await db
		.update(schema.tableLayout)
		.set({ currentOrderId: ORDER.o17, status: "occupied" })
		.where(eq(schema.tableLayout.id, TABLE.t1));
	await db
		.update(schema.tableLayout)
		.set({ currentOrderId: ORDER.o18, status: "occupied" })
		.where(eq(schema.tableLayout.id, TABLE.t4));
	await db
		.update(schema.tableLayout)
		.set({ currentOrderId: ORDER.o20, status: "occupied" })
		.where(eq(schema.tableLayout.id, TABLE.t8));

	// 13. Order Line Items
	console.log("  -> Order Line Items");
	const LI = (n: number) =>
		`f2000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
	await db
		.insert(schema.orderLineItem)
		.values([
			{
				id: LI(1),
				orderId: ORDER.o1,
				productId: PROD.friedRiceBakedChicken,
				productNameSnapshot: "Fried Rice and Baked Chicken",
				reportingCategorySnapshot: "Chicken",
				quantity: 2,
				unitPrice: "2200",
				total: "4400",
			},
			{
				id: LI(2),
				orderId: ORDER.o1,
				productId: PROD.curryChicken,
				productNameSnapshot: "Curry Chicken",
				reportingCategorySnapshot: "Chicken",
				quantity: 1,
				unitPrice: "2000",
				total: "2000",
			},
			{
				id: LI(3),
				orderId: ORDER.o2,
				productId: PROD.cookupBakedSnapper,
				productNameSnapshot: "Cookup Baked Snapper",
				reportingCategorySnapshot: "Fish",
				quantity: 1,
				unitPrice: "2500",
				total: "2500",
			},
			{
				id: LI(4),
				orderId: ORDER.o2,
				productId: PROD.curryChicken,
				productNameSnapshot: "Curry Chicken",
				reportingCategorySnapshot: "Chicken",
				quantity: 1,
				unitPrice: "2000",
				total: "2000",
			},
			{
				id: LI(5),
				orderId: ORDER.o3,
				productId: PROD.chowmeinBakedChicken,
				productNameSnapshot: "Chowmein/Baked Chicken",
				reportingCategorySnapshot: "Chicken",
				quantity: 2,
				unitPrice: "2200",
				total: "4400",
			},
			{
				id: LI(6),
				orderId: ORDER.o3,
				productId: PROD.curryBeef,
				productNameSnapshot: "Anyrice / Curry Beef",
				reportingCategorySnapshot: "Beef",
				quantity: 1,
				unitPrice: "2400",
				total: "2400",
			},
			{
				id: LI(7),
				orderId: ORDER.o3,
				productId: PROD.curryChicken,
				productNameSnapshot: "Curry Chicken",
				reportingCategorySnapshot: "Chicken",
				quantity: 1,
				unitPrice: "2000",
				total: "2000",
			},
			{
				id: LI(8),
				orderId: ORDER.o4,
				productId: PROD.spongeCake,
				productNameSnapshot: "Sponge Cake",
				reportingCategorySnapshot: "Pastries",
				quantity: 1,
				unitPrice: "800",
				total: "800",
			},
			{
				id: LI(9),
				orderId: ORDER.o4,
				productId: PROD.coconutBuns,
				productNameSnapshot: "Coconut Buns",
				reportingCategorySnapshot: "Pastries",
				quantity: 2,
				unitPrice: "500",
				total: "1000",
			},
			{
				id: LI(10),
				orderId: ORDER.o4,
				productId: PROD.drink12oz,
				productNameSnapshot: "12oz Drink",
				reportingCategorySnapshot: "Beverages",
				quantity: 1,
				unitPrice: "300",
				total: "300",
			},
			{
				id: LI(11),
				orderId: ORDER.o5,
				productId: PROD.cookupBakedSnapper,
				productNameSnapshot: "Cookup Baked Snapper",
				reportingCategorySnapshot: "Fish",
				quantity: 2,
				unitPrice: "2500",
				total: "5000",
			},
			{
				id: LI(12),
				orderId: ORDER.o5,
				productId: PROD.curryBeef,
				productNameSnapshot: "Anyrice / Curry Beef",
				reportingCategorySnapshot: "Beef",
				quantity: 1,
				unitPrice: "2400",
				total: "2400",
			},
			{
				id: LI(13),
				orderId: ORDER.o6,
				productId: PROD.coke,
				productNameSnapshot: "Coke",
				reportingCategorySnapshot: "Beverages",
				quantity: 2,
				unitPrice: "300",
				total: "600",
			},
			{
				id: LI(14),
				orderId: ORDER.o6,
				productId: PROD.tamarindJuice,
				productNameSnapshot: "Tamarind Juice",
				reportingCategorySnapshot: "Local Juice",
				quantity: 2,
				unitPrice: "500",
				total: "1000",
			},
			{
				id: LI(15),
				orderId: ORDER.o7,
				productId: PROD.friedRiceBakedChicken,
				productNameSnapshot: "Fried Rice and Baked Chicken",
				reportingCategorySnapshot: "Chicken",
				quantity: 3,
				unitPrice: "2200",
				total: "6600",
			},
			{
				id: LI(16),
				orderId: ORDER.o7,
				productId: PROD.vegChowmein,
				productNameSnapshot: "Veg. Chowmein",
				reportingCategorySnapshot: "Veggie",
				quantity: 1,
				unitPrice: "1500",
				total: "1500",
			},
			{
				id: LI(17),
				orderId: ORDER.o7,
				productId: PROD.water,
				productNameSnapshot: "Water",
				reportingCategorySnapshot: "Beverages",
				quantity: 4,
				unitPrice: "200",
				total: "800",
			},
			{
				id: LI(18),
				orderId: ORDER.o7,
				productId: PROD.cupDhal,
				productNameSnapshot: "Cup Dhal",
				reportingCategorySnapshot: "Snacks",
				quantity: 1,
				unitPrice: "400",
				total: "400",
			},
			{
				id: LI(19),
				orderId: ORDER.o8,
				productId: PROD.caribbeanRiceBChicken,
				productNameSnapshot: "Caribbean Rice B/Chicken",
				reportingCategorySnapshot: "Chicken",
				quantity: 2,
				unitPrice: "2200",
				total: "4400",
			},
			{
				id: LI(20),
				orderId: ORDER.o9,
				productId: PROD.bakedCustard,
				productNameSnapshot: "Baked Custard",
				reportingCategorySnapshot: "Pastries",
				quantity: 2,
				unitPrice: "600",
				total: "1200",
			},
			{
				id: LI(21),
				orderId: ORDER.o9,
				productId: PROD.coconutBuns,
				productNameSnapshot: "Coconut Buns",
				reportingCategorySnapshot: "Pastries",
				quantity: 1,
				unitPrice: "500",
				total: "500",
			},
			{
				id: LI(22),
				orderId: ORDER.o9,
				productId: PROD.water,
				productNameSnapshot: "Water",
				reportingCategorySnapshot: "Beverages",
				quantity: 1,
				unitPrice: "200",
				total: "200",
			},
			{
				id: LI(23),
				orderId: ORDER.o10,
				productId: PROD.cookUpBBQ,
				productNameSnapshot: "Cook Up BBQ",
				reportingCategorySnapshot: "Meat Cookup",
				quantity: 2,
				unitPrice: "2000",
				total: "4000",
			},
			{
				id: LI(24),
				orderId: ORDER.o10,
				productId: PROD.currySnapper,
				productNameSnapshot: "Curry Snapper",
				reportingCategorySnapshot: "Fish",
				quantity: 1,
				unitPrice: "2500",
				total: "2500",
			},
			{
				id: LI(25),
				orderId: ORDER.o10,
				productId: PROD.drink12oz,
				productNameSnapshot: "12oz Drink",
				reportingCategorySnapshot: "Beverages",
				quantity: 1,
				unitPrice: "300",
				total: "300",
			},
			{
				id: LI(26),
				orderId: ORDER.o11,
				productId: PROD.cookupBakedSnapper,
				productNameSnapshot: "Cookup Baked Snapper",
				reportingCategorySnapshot: "Fish",
				quantity: 2,
				unitPrice: "2500",
				total: "5000",
			},
			{
				id: LI(27),
				orderId: ORDER.o12,
				productId: PROD.drink1Lt,
				productNameSnapshot: "1 Lt Drink",
				reportingCategorySnapshot: "Beverages",
				quantity: 2,
				unitPrice: "600",
				total: "1200",
			},
			{
				id: LI(28),
				orderId: ORDER.o12,
				productId: PROD.xlEnergy,
				productNameSnapshot: "XL Energy",
				reportingCategorySnapshot: "Beverages",
				quantity: 2,
				unitPrice: "500",
				total: "1000",
			},
			{
				id: LI(29),
				orderId: ORDER.o12,
				productId: PROD.water,
				productNameSnapshot: "Water",
				reportingCategorySnapshot: "Beverages",
				quantity: 1,
				unitPrice: "200",
				total: "200",
			},
			{
				id: LI(30),
				orderId: ORDER.o13,
				productId: PROD.friedRiceBakedChicken,
				productNameSnapshot: "Fried Rice and Baked Chicken",
				reportingCategorySnapshot: "Chicken",
				quantity: 5,
				unitPrice: "2200",
				total: "11000",
			},
			{
				id: LI(31),
				orderId: ORDER.o14,
				productId: PROD.vegMealDholl,
				productNameSnapshot: "Veg. Meal/Dholl",
				reportingCategorySnapshot: "Veggie",
				quantity: 2,
				unitPrice: "1500",
				total: "3000",
			},
			{
				id: LI(32),
				orderId: ORDER.o14,
				productId: PROD.cookUpFc,
				productNameSnapshot: "Cook-up Fc",
				reportingCategorySnapshot: "Meat Cookup",
				quantity: 1,
				unitPrice: "2000",
				total: "2000",
			},
			{
				id: LI(33),
				orderId: ORDER.o15,
				productId: PROD.spongeCake,
				productNameSnapshot: "Sponge Cake",
				reportingCategorySnapshot: "Pastries",
				quantity: 2,
				unitPrice: "800",
				total: "1600",
			},
			{
				id: LI(34),
				orderId: ORDER.o15,
				productId: PROD.bakedCustard,
				productNameSnapshot: "Baked Custard",
				reportingCategorySnapshot: "Pastries",
				quantity: 1,
				unitPrice: "600",
				total: "600",
			},
			{
				id: LI(35),
				orderId: ORDER.o15,
				productId: PROD.coke,
				productNameSnapshot: "Coke",
				reportingCategorySnapshot: "Beverages",
				quantity: 1,
				unitPrice: "300",
				total: "300",
			},
			{
				id: LI(36),
				orderId: ORDER.o15,
				productId: PROD.water,
				productNameSnapshot: "Water",
				reportingCategorySnapshot: "Beverages",
				quantity: 1,
				unitPrice: "200",
				total: "200",
			},
			{
				id: LI(37),
				orderId: ORDER.o16,
				productId: PROD.friedRiceBakedChicken,
				productNameSnapshot: "Fried Rice and Baked Chicken",
				reportingCategorySnapshot: "Chicken",
				quantity: 1,
				unitPrice: "2200",
				total: "2200",
				voided: true,
				voidReason: "Customer changed mind",
			},
			{
				id: LI(38),
				orderId: ORDER.o17,
				productId: PROD.friedRiceBakedChicken,
				productNameSnapshot: "Fried Rice and Baked Chicken",
				reportingCategorySnapshot: "Chicken",
				quantity: 1,
				unitPrice: "2200",
				total: "2200",
			},
			{
				id: LI(39),
				orderId: ORDER.o17,
				productId: PROD.chowmeinFryChicken,
				productNameSnapshot: "Chowmein/Fry Chicken",
				reportingCategorySnapshot: "Chicken",
				quantity: 1,
				unitPrice: "2200",
				total: "2200",
			},
			{
				id: LI(40),
				orderId: ORDER.o18,
				productId: PROD.cookupFrySnapper,
				productNameSnapshot: "Cookup Fry Snapper",
				reportingCategorySnapshot: "Fish",
				quantity: 2,
				unitPrice: "2500",
				total: "5000",
			},
			{
				id: LI(41),
				orderId: ORDER.o18,
				productId: PROD.curryChicken,
				productNameSnapshot: "Curry Chicken",
				reportingCategorySnapshot: "Chicken",
				quantity: 1,
				unitPrice: "2000",
				total: "2000",
			},
			{
				id: LI(42),
				orderId: ORDER.o19,
				productId: PROD.raisinRicePineapple,
				productNameSnapshot: "Raisin Rice with Pineapple Chicken",
				reportingCategorySnapshot: "Chicken",
				quantity: 3,
				unitPrice: "2200",
				total: "6600",
			},
			{
				id: LI(43),
				orderId: ORDER.o20,
				productId: PROD.drink1Lt,
				productNameSnapshot: "1 Lt Drink",
				reportingCategorySnapshot: "Beverages",
				quantity: 3,
				unitPrice: "600",
				total: "1800",
			},
			{
				id: LI(44),
				orderId: ORDER.o20,
				productId: PROD.tamarindJuice,
				productNameSnapshot: "Tamarind Juice",
				reportingCategorySnapshot: "Local Juice",
				quantity: 2,
				unitPrice: "500",
				total: "1000",
			},
			{
				id: LI(45),
				orderId: ORDER.o20,
				productId: PROD.coke,
				productNameSnapshot: "Coke",
				reportingCategorySnapshot: "Beverages",
				quantity: 1,
				unitPrice: "300",
				total: "300",
			},
		])
		.onConflictDoNothing();

	// 14. Payments
	console.log("  -> Payments");
	const PM = (n: number) =>
		`f3000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
	await db
		.insert(schema.payment)
		.values([
			{
				id: PM(1),
				orderId: ORDER.o1,
				method: "cash",
				amount: "6600",
				tendered: "7000",
				changeGiven: "400",
				status: "completed",
				createdAt: daysAgo(6, 10),
			},
			{
				id: PM(2),
				orderId: ORDER.o2,
				method: "cash",
				amount: "4700",
				tendered: "5000",
				changeGiven: "300",
				status: "completed",
				createdAt: daysAgo(6, 11),
			},
			{
				id: PM(3),
				orderId: ORDER.o3,
				method: "card",
				amount: "8800",
				reference: "TXN-001",
				status: "completed",
				createdAt: daysAgo(5, 12),
			},
			{
				id: PM(4),
				orderId: ORDER.o4,
				method: "cash",
				amount: "2100",
				tendered: "2500",
				changeGiven: "400",
				status: "completed",
				createdAt: daysAgo(5, 13),
			},
			{
				id: PM(5),
				orderId: ORDER.o5,
				method: "cash",
				amount: "7400",
				tendered: "8000",
				changeGiven: "600",
				status: "completed",
				createdAt: daysAgo(4, 11),
			},
			{
				id: PM(6),
				orderId: ORDER.o6,
				method: "cash",
				amount: "1600",
				tendered: "2000",
				changeGiven: "400",
				status: "completed",
				createdAt: daysAgo(4, 14),
			},
			{
				id: PM(7),
				orderId: ORDER.o7,
				method: "card",
				amount: "9300",
				reference: "TXN-002",
				status: "completed",
				createdAt: daysAgo(3, 10),
			},
			{
				id: PM(8),
				orderId: ORDER.o8,
				method: "cash",
				amount: "4400",
				tendered: "5000",
				changeGiven: "600",
				status: "completed",
				createdAt: daysAgo(3, 12),
			},
			{
				id: PM(9),
				orderId: ORDER.o9,
				method: "cash",
				amount: "1900",
				tendered: "2000",
				changeGiven: "100",
				status: "completed",
				createdAt: daysAgo(3, 15),
			},
			{
				id: PM(10),
				orderId: ORDER.o10,
				method: "cash",
				amount: "6800",
				tendered: "7000",
				changeGiven: "200",
				status: "completed",
				createdAt: daysAgo(2, 11),
			},
			{
				id: PM(11),
				orderId: ORDER.o11,
				method: "card",
				amount: "5000",
				reference: "TXN-003",
				status: "completed",
				createdAt: daysAgo(2, 13),
			},
			{
				id: PM(12),
				orderId: ORDER.o12,
				method: "cash",
				amount: "2400",
				tendered: "2500",
				changeGiven: "100",
				status: "completed",
				createdAt: daysAgo(2, 14),
			},
			{
				id: PM(13),
				orderId: ORDER.o13,
				method: "cash",
				amount: "11000",
				tendered: "11000",
				changeGiven: "0",
				status: "completed",
				createdAt: daysAgo(1, 10),
			},
			{
				id: PM(14),
				orderId: ORDER.o14,
				method: "card",
				amount: "5000",
				reference: "TXN-004",
				status: "completed",
				createdAt: daysAgo(1, 12),
			},
			{
				id: PM(15),
				orderId: ORDER.o15,
				method: "cash",
				amount: "2700",
				tendered: "3000",
				changeGiven: "300",
				status: "completed",
				createdAt: daysAgo(1, 14),
			},
			{
				id: PM(16),
				orderId: ORDER.o19,
				method: "cash",
				amount: "6600",
				tendered: "7000",
				changeGiven: "400",
				status: "completed",
				createdAt: daysAgo(0, 9),
			},
		])
		.onConflictDoNothing();

	// 15. Cash Sessions
	console.log("  -> Cash Sessions");
	await db
		.insert(schema.cashSession)
		.values([
			{
				id: CASH_SESSION.cs1,
				registerId: REG.meals,
				locationId: LOC_ID,
				openedBy: USER.cashier,
				openedAt: daysAgo(1, 8),
				openingFloat: "10000",
				closedBy: USER.cashier,
				closedAt: daysAgo(1, 18),
				closingCount: "35100",
				expectedCash: "34700",
				variance: "400",
				status: "closed",
				notes: "Busy lunch. Minor overage.",
			},
			{
				id: CASH_SESSION.cs2,
				registerId: REG.pastry,
				locationId: LOC_ID,
				openedBy: USER.cashier,
				openedAt: daysAgo(1, 9),
				openingFloat: "5000",
				closedBy: USER.admin,
				closedAt: daysAgo(1, 17),
				closingCount: "7700",
				expectedCash: "7700",
				variance: "0",
				status: "closed",
			},
			{
				id: CASH_SESSION.cs3,
				registerId: REG.meals,
				locationId: LOC_ID,
				openedBy: USER.cashier,
				openedAt: daysAgo(0, 8),
				openingFloat: "10000",
				status: "open",
			},
			{
				id: CASH_SESSION.cs4,
				registerId: REG.beverage,
				locationId: LOC_ID,
				openedBy: USER.cashier,
				openedAt: daysAgo(0, 9),
				openingFloat: "5000",
				status: "open",
			},
		])
		.onConflictDoNothing();

	// Cash drops & payouts
	console.log("  -> Cash Drops & Payouts");
	await db
		.insert(schema.cashDrop)
		.values([
			{
				id: "f4000000-0000-4000-8000-000000000001",
				cashSessionId: CASH_SESSION.cs1,
				amount: "15000",
				userId: USER.cashier,
				reason: "Mid-day cash drop to safe",
				createdAt: daysAgo(1, 13),
			},
		])
		.onConflictDoNothing();
	await db
		.insert(schema.cashPayout)
		.values([
			{
				id: "f4100000-0000-4000-8000-000000000001",
				cashSessionId: CASH_SESSION.cs1,
				amount: "2500",
				userId: USER.admin,
				reason: "Petty cash - market supplies",
				createdAt: daysAgo(1, 14),
			},
		])
		.onConflictDoNothing();

	// 16. Kitchen Order Tickets
	console.log("  -> Kitchen Tickets");
	const KOT = {
		k1: "f5000000-0000-4000-8000-000000000001",
		k2: "f5000000-0000-4000-8000-000000000002",
		k3: "f5000000-0000-4000-8000-000000000003",
		k4: "f5000000-0000-4000-8000-000000000004",
		k5: "f5000000-0000-4000-8000-000000000005",
	};
	await db
		.insert(schema.kitchenOrderTicket)
		.values([
			{
				id: KOT.k1,
				orderId: ORDER.o19,
				locationId: LOC_ID,
				status: "completed",
				createdAt: daysAgo(0, 9),
			},
			{
				id: KOT.k2,
				orderId: ORDER.o17,
				locationId: LOC_ID,
				status: "in_progress",
				createdAt: daysAgo(0, 11),
			},
			{
				id: KOT.k3,
				orderId: ORDER.o18,
				locationId: LOC_ID,
				status: "pending",
				createdAt: daysAgo(0, 11),
			},
			{
				id: KOT.k4,
				orderId: ORDER.o13,
				locationId: LOC_ID,
				status: "completed",
				createdAt: daysAgo(1, 10),
			},
			{
				id: KOT.k5,
				orderId: ORDER.o14,
				locationId: LOC_ID,
				status: "completed",
				createdAt: daysAgo(1, 12),
			},
		])
		.onConflictDoNothing();

	const KI = (n: number) =>
		`f5100000-0000-4000-8000-${String(n).padStart(12, "0")}`;
	await db
		.insert(schema.kitchenOrderItem)
		.values([
			{
				id: KI(1),
				ticketId: KOT.k1,
				orderLineItemId: LI(42),
				productName: "Raisin Rice with Pineapple Chicken",
				quantity: 3,
				status: "completed",
			},
			{
				id: KI(2),
				ticketId: KOT.k2,
				orderLineItemId: LI(38),
				productName: "Fried Rice and Baked Chicken",
				quantity: 1,
				status: "in_progress",
			},
			{
				id: KI(3),
				ticketId: KOT.k2,
				orderLineItemId: LI(39),
				productName: "Chowmein/Fry Chicken",
				quantity: 1,
				status: "pending",
			},
			{
				id: KI(4),
				ticketId: KOT.k3,
				orderLineItemId: LI(40),
				productName: "Cookup Fry Snapper",
				quantity: 2,
				status: "pending",
			},
			{
				id: KI(5),
				ticketId: KOT.k3,
				orderLineItemId: LI(41),
				productName: "Curry Chicken",
				quantity: 1,
				status: "pending",
			},
			{
				id: KI(6),
				ticketId: KOT.k4,
				orderLineItemId: LI(30),
				productName: "Fried Rice and Baked Chicken",
				quantity: 5,
				status: "completed",
			},
			{
				id: KI(7),
				ticketId: KOT.k5,
				orderLineItemId: LI(31),
				productName: "Veg. Meal/Dholl",
				quantity: 2,
				status: "completed",
			},
			{
				id: KI(8),
				ticketId: KOT.k5,
				orderLineItemId: LI(32),
				productName: "Cook-up Fc",
				quantity: 1,
				status: "completed",
			},
		])
		.onConflictDoNothing();

	// 17. Inventory
	console.log("  -> Inventory Items & Stock");
	await db
		.insert(schema.inventoryItem)
		.values([
			{
				id: INV_ITEM.chicken,
				organizationId: ORG_ID,
				sku: "INV-001",
				name: "Whole Chicken",
				category: "Protein",
				unitOfMeasure: "lb",
				preferredSupplierId: SUPPLIER.freshFoods,
				reorderPoint: "50",
				minLevel: "20",
				maxLevel: "200",
				avgCost: "450.0000",
			},
			{
				id: INV_ITEM.rice,
				organizationId: ORG_ID,
				sku: "INV-002",
				name: "White Rice",
				category: "Grains",
				unitOfMeasure: "lb",
				preferredSupplierId: SUPPLIER.freshFoods,
				reorderPoint: "100",
				minLevel: "40",
				maxLevel: "500",
				avgCost: "120.0000",
			},
			{
				id: INV_ITEM.flour,
				organizationId: ORG_ID,
				sku: "INV-003",
				name: "All-Purpose Flour",
				category: "Baking",
				unitOfMeasure: "lb",
				preferredSupplierId: SUPPLIER.freshFoods,
				reorderPoint: "30",
				minLevel: "10",
				maxLevel: "100",
				avgCost: "80.0000",
			},
			{
				id: INV_ITEM.oil,
				organizationId: ORG_ID,
				sku: "INV-004",
				name: "Vegetable Oil",
				category: "Cooking",
				unitOfMeasure: "gal",
				preferredSupplierId: SUPPLIER.freshFoods,
				reorderPoint: "10",
				minLevel: "5",
				maxLevel: "50",
				avgCost: "1200.0000",
			},
			{
				id: INV_ITEM.sugar,
				organizationId: ORG_ID,
				sku: "INV-005",
				name: "Brown Sugar",
				category: "Baking",
				unitOfMeasure: "lb",
				preferredSupplierId: SUPPLIER.freshFoods,
				reorderPoint: "20",
				minLevel: "10",
				maxLevel: "80",
				avgCost: "150.0000",
			},
			{
				id: INV_ITEM.snapper,
				organizationId: ORG_ID,
				sku: "INV-006",
				name: "Red Snapper",
				category: "Protein",
				unitOfMeasure: "lb",
				preferredSupplierId: SUPPLIER.freshFoods,
				reorderPoint: "30",
				minLevel: "10",
				maxLevel: "100",
				avgCost: "800.0000",
			},
			{
				id: INV_ITEM.beef,
				organizationId: ORG_ID,
				sku: "INV-007",
				name: "Stewing Beef",
				category: "Protein",
				unitOfMeasure: "lb",
				preferredSupplierId: SUPPLIER.freshFoods,
				reorderPoint: "20",
				minLevel: "10",
				maxLevel: "80",
				avgCost: "700.0000",
			},
			{
				id: INV_ITEM.coconut,
				organizationId: ORG_ID,
				sku: "INV-008",
				name: "Coconut (dry)",
				category: "Baking",
				unitOfMeasure: "each",
				preferredSupplierId: SUPPLIER.freshFoods,
				reorderPoint: "20",
				minLevel: "10",
				maxLevel: "60",
				avgCost: "200.0000",
			},
			{
				id: INV_ITEM.onions,
				organizationId: ORG_ID,
				sku: "INV-009",
				name: "Yellow Onions",
				category: "Produce",
				unitOfMeasure: "lb",
				preferredSupplierId: SUPPLIER.freshFoods,
				reorderPoint: "25",
				minLevel: "10",
				maxLevel: "80",
				avgCost: "180.0000",
			},
			{
				id: INV_ITEM.garlic,
				organizationId: ORG_ID,
				sku: "INV-010",
				name: "Garlic",
				category: "Produce",
				unitOfMeasure: "lb",
				preferredSupplierId: SUPPLIER.freshFoods,
				reorderPoint: "5",
				minLevel: "2",
				maxLevel: "20",
				avgCost: "400.0000",
			},
			{
				id: INV_ITEM.peppers,
				organizationId: ORG_ID,
				sku: "INV-011",
				name: "Hot Peppers (Wiri Wiri)",
				category: "Produce",
				unitOfMeasure: "lb",
				preferredSupplierId: SUPPLIER.freshFoods,
				reorderPoint: "3",
				minLevel: "1",
				maxLevel: "15",
				avgCost: "600.0000",
			},
			{
				id: INV_ITEM.noodles,
				organizationId: ORG_ID,
				sku: "INV-012",
				name: "Chowmein Noodles",
				category: "Grains",
				unitOfMeasure: "lb",
				preferredSupplierId: SUPPLIER.freshFoods,
				reorderPoint: "30",
				minLevel: "10",
				maxLevel: "100",
				avgCost: "200.0000",
			},
			{
				id: INV_ITEM.tamarind,
				organizationId: ORG_ID,
				sku: "INV-013",
				name: "Tamarind Pulp",
				category: "Produce",
				unitOfMeasure: "lb",
				preferredSupplierId: SUPPLIER.freshFoods,
				reorderPoint: "5",
				minLevel: "2",
				maxLevel: "20",
				avgCost: "350.0000",
			},
			{
				id: INV_ITEM.softDrinks,
				organizationId: ORG_ID,
				sku: "INV-014",
				name: "Soft Drinks (assorted)",
				category: "Beverages",
				unitOfMeasure: "case",
				preferredSupplierId: SUPPLIER.bevDist,
				reorderPoint: "10",
				minLevel: "5",
				maxLevel: "40",
				avgCost: "4800.0000",
			},
			{
				id: INV_ITEM.water,
				organizationId: ORG_ID,
				sku: "INV-015",
				name: "Bottled Water (case)",
				category: "Beverages",
				unitOfMeasure: "case",
				preferredSupplierId: SUPPLIER.bevDist,
				reorderPoint: "10",
				minLevel: "5",
				maxLevel: "30",
				avgCost: "3600.0000",
			},
		])
		.onConflictDoNothing();

	const IS = (n: number) =>
		`fc100000-0000-4000-8000-${String(n).padStart(12, "0")}`;
	await db
		.insert(schema.inventoryStock)
		.values([
			{
				id: IS(1),
				inventoryItemId: INV_ITEM.chicken,
				locationId: LOC_ID,
				quantityOnHand: "85",
			},
			{
				id: IS(2),
				inventoryItemId: INV_ITEM.rice,
				locationId: LOC_ID,
				quantityOnHand: "220",
			},
			{
				id: IS(3),
				inventoryItemId: INV_ITEM.flour,
				locationId: LOC_ID,
				quantityOnHand: "45",
			},
			{
				id: IS(4),
				inventoryItemId: INV_ITEM.oil,
				locationId: LOC_ID,
				quantityOnHand: "18",
			},
			{
				id: IS(5),
				inventoryItemId: INV_ITEM.sugar,
				locationId: LOC_ID,
				quantityOnHand: "35",
			},
			{
				id: IS(6),
				inventoryItemId: INV_ITEM.snapper,
				locationId: LOC_ID,
				quantityOnHand: "28",
			},
			{
				id: IS(7),
				inventoryItemId: INV_ITEM.beef,
				locationId: LOC_ID,
				quantityOnHand: "15",
			},
			{
				id: IS(8),
				inventoryItemId: INV_ITEM.coconut,
				locationId: LOC_ID,
				quantityOnHand: "22",
			},
			{
				id: IS(9),
				inventoryItemId: INV_ITEM.onions,
				locationId: LOC_ID,
				quantityOnHand: "40",
			},
			{
				id: IS(10),
				inventoryItemId: INV_ITEM.garlic,
				locationId: LOC_ID,
				quantityOnHand: "8",
			},
			{
				id: IS(11),
				inventoryItemId: INV_ITEM.peppers,
				locationId: LOC_ID,
				quantityOnHand: "4",
			},
			{
				id: IS(12),
				inventoryItemId: INV_ITEM.noodles,
				locationId: LOC_ID,
				quantityOnHand: "55",
			},
			{
				id: IS(13),
				inventoryItemId: INV_ITEM.tamarind,
				locationId: LOC_ID,
				quantityOnHand: "6",
			},
			{
				id: IS(14),
				inventoryItemId: INV_ITEM.softDrinks,
				locationId: LOC_ID,
				quantityOnHand: "12",
			},
			{
				id: IS(15),
				inventoryItemId: INV_ITEM.water,
				locationId: LOC_ID,
				quantityOnHand: "8",
			},
		])
		.onConflictDoNothing();

	// 18. Purchase Orders
	console.log("  -> Purchase Orders");
	await db
		.insert(schema.purchaseOrder)
		.values([
			{
				id: PO.po1,
				organizationId: ORG_ID,
				locationId: LOC_ID,
				supplierId: SUPPLIER.freshFoods,
				status: "received",
				createdBy: USER.admin,
				approvedBy: USER.admin,
				notes: "Weekly protein and produce delivery",
				total: "104000",
				createdAt: daysAgo(5, 9),
			},
			{
				id: PO.po2,
				organizationId: ORG_ID,
				locationId: LOC_ID,
				supplierId: SUPPLIER.bevDist,
				status: "approved",
				createdBy: USER.admin,
				approvedBy: USER.admin,
				notes: "Beverage restocking order",
				total: "84000",
				createdAt: daysAgo(1, 10),
			},
			{
				id: PO.po3,
				organizationId: ORG_ID,
				locationId: LOC_ID,
				supplierId: SUPPLIER.freshFoods,
				status: "draft",
				createdBy: USER.admin,
				notes: "Next week order - pending review",
				total: "69000",
				createdAt: daysAgo(0, 10),
			},
		])
		.onConflictDoNothing();

	const PL = (n: number) =>
		`fd100000-0000-4000-8000-${String(n).padStart(12, "0")}`;
	await db
		.insert(schema.purchaseOrderLine)
		.values([
			{
				id: PL(1),
				purchaseOrderId: PO.po1,
				inventoryItemId: INV_ITEM.chicken,
				quantityOrdered: "100",
				quantityReceived: "100",
				unitCost: "450.0000",
				total: "45000",
			},
			{
				id: PL(2),
				purchaseOrderId: PO.po1,
				inventoryItemId: INV_ITEM.snapper,
				quantityOrdered: "40",
				quantityReceived: "40",
				unitCost: "800.0000",
				total: "32000",
			},
			{
				id: PL(3),
				purchaseOrderId: PO.po1,
				inventoryItemId: INV_ITEM.onions,
				quantityOrdered: "30",
				quantityReceived: "30",
				unitCost: "180.0000",
				total: "5400",
			},
			{
				id: PL(4),
				purchaseOrderId: PO.po1,
				inventoryItemId: INV_ITEM.garlic,
				quantityOrdered: "10",
				quantityReceived: "10",
				unitCost: "400.0000",
				total: "4000",
			},
			{
				id: PL(5),
				purchaseOrderId: PO.po1,
				inventoryItemId: INV_ITEM.peppers,
				quantityOrdered: "6",
				quantityReceived: "6",
				unitCost: "600.0000",
				total: "3600",
			},
			{
				id: PL(6),
				purchaseOrderId: PO.po1,
				inventoryItemId: INV_ITEM.beef,
				quantityOrdered: "20",
				quantityReceived: "20",
				unitCost: "700.0000",
				total: "14000",
			},
			{
				id: PL(7),
				purchaseOrderId: PO.po2,
				inventoryItemId: INV_ITEM.softDrinks,
				quantityOrdered: "10",
				quantityReceived: "0",
				unitCost: "4800.0000",
				total: "48000",
			},
			{
				id: PL(8),
				purchaseOrderId: PO.po2,
				inventoryItemId: INV_ITEM.water,
				quantityOrdered: "10",
				quantityReceived: "0",
				unitCost: "3600.0000",
				total: "36000",
			},
			{
				id: PL(9),
				purchaseOrderId: PO.po3,
				inventoryItemId: INV_ITEM.chicken,
				quantityOrdered: "80",
				quantityReceived: "0",
				unitCost: "450.0000",
				total: "36000",
			},
			{
				id: PL(10),
				purchaseOrderId: PO.po3,
				inventoryItemId: INV_ITEM.rice,
				quantityOrdered: "150",
				quantityReceived: "0",
				unitCost: "120.0000",
				total: "18000",
			},
			{
				id: PL(11),
				purchaseOrderId: PO.po3,
				inventoryItemId: INV_ITEM.noodles,
				quantityOrdered: "50",
				quantityReceived: "0",
				unitCost: "200.0000",
				total: "10000",
			},
			{
				id: PL(12),
				purchaseOrderId: PO.po3,
				inventoryItemId: INV_ITEM.flour,
				quantityOrdered: "25",
				quantityReceived: "0",
				unitCost: "80.0000",
				total: "2000",
			},
			{
				id: PL(13),
				purchaseOrderId: PO.po3,
				inventoryItemId: INV_ITEM.coconut,
				quantityOrdered: "15",
				quantityReceived: "0",
				unitCost: "200.0000",
				total: "3000",
			},
		])
		.onConflictDoNothing();

	// 19. Production Logs
	console.log("  -> Production Logs");
	const today = new Date().toISOString().split("T")[0]!;
	const yesterday = new Date(Date.now() - 86400000)
		.toISOString()
		.split("T")[0]!;
	const twoDaysAgo = new Date(Date.now() - 2 * 86400000)
		.toISOString()
		.split("T")[0]!;
	const PD = (n: number) =>
		`fe000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
	await db
		.insert(schema.productionLog)
		.values([
			{
				id: PD(1),
				productId: PROD.friedRiceBakedChicken,
				productName: "Fried Rice and Baked Chicken",
				locationId: LOC_ID,
				loggedByUserId: USER.admin,
				entryType: "production",
				quantity: 30,
				notes: "Morning batch",
				logDate: today,
			},
			{
				id: PD(2),
				productId: PROD.curryChicken,
				productName: "Curry Chicken",
				locationId: LOC_ID,
				loggedByUserId: USER.admin,
				entryType: "production",
				quantity: 20,
				notes: "Morning batch",
				logDate: today,
			},
			{
				id: PD(3),
				productId: PROD.chowmeinBakedChicken,
				productName: "Chowmein/Baked Chicken",
				locationId: LOC_ID,
				loggedByUserId: USER.admin,
				entryType: "production",
				quantity: 15,
				logDate: today,
			},
			{
				id: PD(4),
				productId: PROD.cookupBakedSnapper,
				productName: "Cookup Baked Snapper",
				locationId: LOC_ID,
				loggedByUserId: USER.admin,
				entryType: "production",
				quantity: 12,
				logDate: today,
			},
			{
				id: PD(5),
				productId: PROD.spongeCake,
				productName: "Sponge Cake",
				locationId: LOC_ID,
				loggedByUserId: USER.admin,
				entryType: "production",
				quantity: 10,
				notes: "Bakery morning run",
				logDate: today,
			},
			{
				id: PD(6),
				productId: PROD.coconutBuns,
				productName: "Coconut Buns",
				locationId: LOC_ID,
				loggedByUserId: USER.admin,
				entryType: "production",
				quantity: 24,
				notes: "Bakery morning run",
				logDate: today,
			},
			{
				id: PD(7),
				productId: PROD.friedRiceBakedChicken,
				productName: "Fried Rice and Baked Chicken",
				locationId: LOC_ID,
				loggedByUserId: USER.admin,
				entryType: "waste",
				quantity: 2,
				notes: "End of day unsold",
				logDate: yesterday,
			},
			{
				id: PD(8),
				productId: PROD.vegRice,
				productName: "Veg. Rice",
				locationId: LOC_ID,
				loggedByUserId: USER.admin,
				entryType: "waste",
				quantity: 3,
				notes: "Overproduced",
				logDate: yesterday,
			},
			{
				id: PD(9),
				productId: PROD.friedRiceBakedChicken,
				productName: "Fried Rice and Baked Chicken",
				locationId: LOC_ID,
				loggedByUserId: USER.admin,
				entryType: "production",
				quantity: 35,
				logDate: yesterday,
			},
			{
				id: PD(10),
				productId: PROD.curryChicken,
				productName: "Curry Chicken",
				locationId: LOC_ID,
				loggedByUserId: USER.admin,
				entryType: "production",
				quantity: 25,
				logDate: yesterday,
			},
			{
				id: PD(11),
				productId: PROD.cookupBakedSnapper,
				productName: "Cookup Baked Snapper",
				locationId: LOC_ID,
				loggedByUserId: USER.admin,
				entryType: "production",
				quantity: 10,
				logDate: yesterday,
			},
			{
				id: PD(12),
				productId: PROD.curryBeef,
				productName: "Anyrice / Curry Beef",
				locationId: LOC_ID,
				loggedByUserId: USER.admin,
				entryType: "production",
				quantity: 8,
				logDate: yesterday,
			},
			{
				id: PD(13),
				productId: PROD.friedRiceBakedChicken,
				productName: "Fried Rice and Baked Chicken",
				locationId: LOC_ID,
				loggedByUserId: USER.admin,
				entryType: "production",
				quantity: 28,
				logDate: twoDaysAgo,
			},
			{
				id: PD(14),
				productId: PROD.curryChicken,
				productName: "Curry Chicken",
				locationId: LOC_ID,
				loggedByUserId: USER.admin,
				entryType: "production",
				quantity: 22,
				logDate: twoDaysAgo,
			},
		])
		.onConflictDoNothing();

	// 19b. Production Logs — opening/reorder/closing (for Production Report)
	// IMPORTANT: productName MUST match componentName values in product_production_component
	// so getReport can correlate expected (check-off) vs actual (POS sales → components)
	console.log("  -> Production Logs (check-off entries)");
	await db
		.insert(schema.productionLog)
		.values([
			// ─── TODAY — Restaurant workflow (component-based names) ───
			// ── Baked Chicken ──
			{
				id: PD(15),
				productId: null,
				productName: "Baked Chicken",
				locationId: LOC_ID,
				loggedByUserId: USER.admin,
				entryType: "opening",
				quantity: 0,
				workflow: "restaurant",
				logDate: today,
			},
			{
				id: PD(100),
				productId: null,
				productName: "Baked Chicken",
				locationId: LOC_ID,
				loggedByUserId: USER.admin,
				entryType: "reorder",
				quantity: 50,
				notes: "Morning batch",
				workflow: "restaurant",
				logDate: today,
			},
			{
				id: PD(101),
				productId: null,
				productName: "Baked Chicken",
				locationId: LOC_ID,
				loggedByUserId: USER.admin,
				entryType: "closing",
				quantity: 3,
				notes: "EOD count",
				workflow: "restaurant",
				logDate: today,
			},
			// ── Fried Rice ──
			{
				id: PD(16),
				productId: null,
				productName: "Fried Rice",
				locationId: LOC_ID,
				loggedByUserId: USER.admin,
				entryType: "opening",
				quantity: 0,
				workflow: "restaurant",
				logDate: today,
			},
			{
				id: PD(17),
				productId: null,
				productName: "Fried Rice",
				locationId: LOC_ID,
				loggedByUserId: USER.admin,
				entryType: "reorder",
				quantity: 35,
				notes: "Morning batch",
				workflow: "restaurant",
				logDate: today,
			},
			{
				id: PD(18),
				productId: null,
				productName: "Fried Rice",
				locationId: LOC_ID,
				loggedByUserId: USER.admin,
				entryType: "closing",
				quantity: 2,
				notes: "EOD count",
				workflow: "restaurant",
				logDate: today,
			},
			// ── Curry Chicken ──
			{
				id: PD(19),
				productId: PROD.curryChicken,
				productName: "Curry Chicken",
				locationId: LOC_ID,
				loggedByUserId: USER.admin,
				entryType: "opening",
				quantity: 0,
				workflow: "restaurant",
				logDate: today,
			},
			{
				id: PD(20),
				productId: PROD.curryChicken,
				productName: "Curry Chicken",
				locationId: LOC_ID,
				loggedByUserId: USER.admin,
				entryType: "reorder",
				quantity: 25,
				notes: "Morning batch",
				workflow: "restaurant",
				logDate: today,
			},
			{
				id: PD(21),
				productId: PROD.curryChicken,
				productName: "Curry Chicken",
				locationId: LOC_ID,
				loggedByUserId: USER.admin,
				entryType: "closing",
				quantity: 1,
				workflow: "restaurant",
				logDate: today,
			},
			// ── Chowmein ──
			{
				id: PD(22),
				productId: null,
				productName: "Chowmein",
				locationId: LOC_ID,
				loggedByUserId: USER.admin,
				entryType: "opening",
				quantity: 0,
				workflow: "restaurant",
				logDate: today,
			},
			{
				id: PD(23),
				productId: null,
				productName: "Chowmein",
				locationId: LOC_ID,
				loggedByUserId: USER.admin,
				entryType: "reorder",
				quantity: 30,
				workflow: "restaurant",
				logDate: today,
			},
			{
				id: PD(24),
				productId: null,
				productName: "Chowmein",
				locationId: LOC_ID,
				loggedByUserId: USER.admin,
				entryType: "closing",
				quantity: 0,
				workflow: "restaurant",
				logDate: today,
			},
			// ── Cookup ──
			{
				id: PD(25),
				productId: null,
				productName: "Cookup",
				locationId: LOC_ID,
				loggedByUserId: USER.admin,
				entryType: "opening",
				quantity: 0,
				workflow: "restaurant",
				logDate: today,
			},
			{
				id: PD(26),
				productId: null,
				productName: "Cookup",
				locationId: LOC_ID,
				loggedByUserId: USER.admin,
				entryType: "reorder",
				quantity: 35,
				workflow: "restaurant",
				logDate: today,
			},
			{
				id: PD(27),
				productId: null,
				productName: "Cookup",
				locationId: LOC_ID,
				loggedByUserId: USER.admin,
				entryType: "closing",
				quantity: 4,
				notes: "Overproduced",
				workflow: "restaurant",
				logDate: today,
			},
			// ── Fry Chicken ──
			{
				id: PD(28),
				productId: null,
				productName: "Fry Chicken",
				locationId: LOC_ID,
				loggedByUserId: USER.admin,
				entryType: "opening",
				quantity: 0,
				workflow: "restaurant",
				logDate: today,
			},
			{
				id: PD(29),
				productId: null,
				productName: "Fry Chicken",
				locationId: LOC_ID,
				loggedByUserId: USER.admin,
				entryType: "reorder",
				quantity: 40,
				workflow: "restaurant",
				logDate: today,
			},
			{
				id: PD(30),
				productId: null,
				productName: "Fry Chicken",
				locationId: LOC_ID,
				loggedByUserId: USER.admin,
				entryType: "closing",
				quantity: 2,
				workflow: "restaurant",
				logDate: today,
			},
			// ── Curry Beef ──
			{
				id: PD(31),
				productId: null,
				productName: "Curry Beef",
				locationId: LOC_ID,
				loggedByUserId: USER.admin,
				entryType: "opening",
				quantity: 0,
				workflow: "restaurant",
				logDate: today,
			},
			{
				id: PD(32),
				productId: null,
				productName: "Curry Beef",
				locationId: LOC_ID,
				loggedByUserId: USER.admin,
				entryType: "reorder",
				quantity: 12,
				workflow: "restaurant",
				logDate: today,
			},
			{
				id: PD(33),
				productId: null,
				productName: "Curry Beef",
				locationId: LOC_ID,
				loggedByUserId: USER.admin,
				entryType: "closing",
				quantity: 1,
				workflow: "restaurant",
				logDate: today,
			},
			// ── Baked Snapper ──
			{
				id: PD(34),
				productId: null,
				productName: "Baked Snapper",
				locationId: LOC_ID,
				loggedByUserId: USER.admin,
				entryType: "opening",
				quantity: 0,
				workflow: "restaurant",
				logDate: today,
			},
			{
				id: PD(35),
				productId: null,
				productName: "Baked Snapper",
				locationId: LOC_ID,
				loggedByUserId: USER.admin,
				entryType: "reorder",
				quantity: 15,
				workflow: "restaurant",
				logDate: today,
			},
			{
				id: PD(36),
				productId: null,
				productName: "Baked Snapper",
				locationId: LOC_ID,
				loggedByUserId: USER.admin,
				entryType: "closing",
				quantity: 0,
				workflow: "restaurant",
				logDate: today,
			},
			// ── Curry Snapper ──
			{
				id: PD(37),
				productId: PROD.currySnapper,
				productName: "Curry Snapper",
				locationId: LOC_ID,
				loggedByUserId: USER.admin,
				entryType: "opening",
				quantity: 0,
				workflow: "restaurant",
				logDate: today,
			},
			{
				id: PD(38),
				productId: PROD.currySnapper,
				productName: "Curry Snapper",
				locationId: LOC_ID,
				loggedByUserId: USER.admin,
				entryType: "reorder",
				quantity: 10,
				workflow: "restaurant",
				logDate: today,
			},
			{
				id: PD(39),
				productId: PROD.currySnapper,
				productName: "Curry Snapper",
				locationId: LOC_ID,
				loggedByUserId: USER.admin,
				entryType: "closing",
				quantity: 1,
				workflow: "restaurant",
				logDate: today,
			},
			// ─── TODAY — Bakery workflow ───
			{
				id: PD(40),
				productId: PROD.spongeCake,
				productName: "Sponge Cake",
				locationId: LOC_ID,
				loggedByUserId: USER.admin,
				entryType: "opening",
				quantity: 2,
				workflow: "bakery",
				logDate: today,
			},
			{
				id: PD(41),
				productId: PROD.spongeCake,
				productName: "Sponge Cake",
				locationId: LOC_ID,
				loggedByUserId: USER.admin,
				entryType: "reorder",
				quantity: 10,
				notes: "Morning bake",
				workflow: "bakery",
				logDate: today,
			},
			{
				id: PD(42),
				productId: PROD.spongeCake,
				productName: "Sponge Cake",
				locationId: LOC_ID,
				loggedByUserId: USER.admin,
				entryType: "closing",
				quantity: 1,
				workflow: "bakery",
				logDate: today,
			},
			{
				id: PD(43),
				productId: PROD.coconutBuns,
				productName: "Coconut Buns",
				locationId: LOC_ID,
				loggedByUserId: USER.admin,
				entryType: "opening",
				quantity: 4,
				workflow: "bakery",
				logDate: today,
			},
			{
				id: PD(44),
				productId: PROD.coconutBuns,
				productName: "Coconut Buns",
				locationId: LOC_ID,
				loggedByUserId: USER.admin,
				entryType: "reorder",
				quantity: 24,
				notes: "Morning bake",
				workflow: "bakery",
				logDate: today,
			},
			{
				id: PD(45),
				productId: PROD.coconutBuns,
				productName: "Coconut Buns",
				locationId: LOC_ID,
				loggedByUserId: USER.admin,
				entryType: "closing",
				quantity: 3,
				workflow: "bakery",
				logDate: today,
			},
			{
				id: PD(46),
				productId: PROD.bakedCustard,
				productName: "Baked Custard",
				locationId: LOC_ID,
				loggedByUserId: USER.admin,
				entryType: "opening",
				quantity: 0,
				workflow: "bakery",
				logDate: today,
			},
			{
				id: PD(47),
				productId: PROD.bakedCustard,
				productName: "Baked Custard",
				locationId: LOC_ID,
				loggedByUserId: USER.admin,
				entryType: "reorder",
				quantity: 6,
				workflow: "bakery",
				logDate: today,
			},
			{
				id: PD(48),
				productId: PROD.bakedCustard,
				productName: "Baked Custard",
				locationId: LOC_ID,
				loggedByUserId: USER.admin,
				entryType: "closing",
				quantity: 0,
				workflow: "bakery",
				logDate: today,
			},
			// ─── YESTERDAY — Restaurant workflow ───
			{
				id: PD(49),
				productId: null,
				productName: "Baked Chicken",
				locationId: LOC_ID,
				loggedByUserId: USER.admin,
				entryType: "opening",
				quantity: 0,
				workflow: "restaurant",
				logDate: yesterday,
			},
			{
				id: PD(50),
				productId: null,
				productName: "Baked Chicken",
				locationId: LOC_ID,
				loggedByUserId: USER.admin,
				entryType: "reorder",
				quantity: 50,
				workflow: "restaurant",
				logDate: yesterday,
			},
			{
				id: PD(51),
				productId: null,
				productName: "Baked Chicken",
				locationId: LOC_ID,
				loggedByUserId: USER.admin,
				entryType: "closing",
				quantity: 2,
				notes: "EOD unsold",
				workflow: "restaurant",
				logDate: yesterday,
			},
			{
				id: PD(52),
				productId: null,
				productName: "Fried Rice",
				locationId: LOC_ID,
				loggedByUserId: USER.admin,
				entryType: "opening",
				quantity: 0,
				workflow: "restaurant",
				logDate: yesterday,
			},
			{
				id: PD(53),
				productId: null,
				productName: "Fried Rice",
				locationId: LOC_ID,
				loggedByUserId: USER.admin,
				entryType: "reorder",
				quantity: 35,
				workflow: "restaurant",
				logDate: yesterday,
			},
			{
				id: PD(54),
				productId: null,
				productName: "Fried Rice",
				locationId: LOC_ID,
				loggedByUserId: USER.admin,
				entryType: "closing",
				quantity: 1,
				notes: "EOD unsold",
				workflow: "restaurant",
				logDate: yesterday,
			},
			{
				id: PD(55),
				productId: null,
				productName: "Fry Chicken",
				locationId: LOC_ID,
				loggedByUserId: USER.admin,
				entryType: "opening",
				quantity: 0,
				workflow: "restaurant",
				logDate: yesterday,
			},
			{
				id: PD(56),
				productId: null,
				productName: "Fry Chicken",
				locationId: LOC_ID,
				loggedByUserId: USER.admin,
				entryType: "reorder",
				quantity: 40,
				workflow: "restaurant",
				logDate: yesterday,
			},
			{
				id: PD(57),
				productId: null,
				productName: "Fry Chicken",
				locationId: LOC_ID,
				loggedByUserId: USER.admin,
				entryType: "closing",
				quantity: 3,
				workflow: "restaurant",
				logDate: yesterday,
			},
			{
				id: PD(58),
				productId: PROD.curryChicken,
				productName: "Curry Chicken",
				locationId: LOC_ID,
				loggedByUserId: USER.admin,
				entryType: "opening",
				quantity: 0,
				workflow: "restaurant",
				logDate: yesterday,
			},
			{
				id: PD(59),
				productId: PROD.curryChicken,
				productName: "Curry Chicken",
				locationId: LOC_ID,
				loggedByUserId: USER.admin,
				entryType: "reorder",
				quantity: 25,
				workflow: "restaurant",
				logDate: yesterday,
			},
			{
				id: PD(60),
				productId: PROD.curryChicken,
				productName: "Curry Chicken",
				locationId: LOC_ID,
				loggedByUserId: USER.admin,
				entryType: "closing",
				quantity: 1,
				workflow: "restaurant",
				logDate: yesterday,
			},
			{
				id: PD(61),
				productId: null,
				productName: "Cookup",
				locationId: LOC_ID,
				loggedByUserId: USER.admin,
				entryType: "opening",
				quantity: 0,
				workflow: "restaurant",
				logDate: yesterday,
			},
			{
				id: PD(62),
				productId: null,
				productName: "Cookup",
				locationId: LOC_ID,
				loggedByUserId: USER.admin,
				entryType: "reorder",
				quantity: 35,
				workflow: "restaurant",
				logDate: yesterday,
			},
			{
				id: PD(63),
				productId: null,
				productName: "Cookup",
				locationId: LOC_ID,
				loggedByUserId: USER.admin,
				entryType: "closing",
				quantity: 2,
				workflow: "restaurant",
				logDate: yesterday,
			},
			{
				id: PD(64),
				productId: PROD.currySnapper,
				productName: "Curry Snapper",
				locationId: LOC_ID,
				loggedByUserId: USER.admin,
				entryType: "opening",
				quantity: 0,
				workflow: "restaurant",
				logDate: yesterday,
			},
			{
				id: PD(65),
				productId: PROD.currySnapper,
				productName: "Curry Snapper",
				locationId: LOC_ID,
				loggedByUserId: USER.admin,
				entryType: "reorder",
				quantity: 10,
				workflow: "restaurant",
				logDate: yesterday,
			},
			{
				id: PD(66),
				productId: PROD.currySnapper,
				productName: "Curry Snapper",
				locationId: LOC_ID,
				loggedByUserId: USER.admin,
				entryType: "closing",
				quantity: 0,
				workflow: "restaurant",
				logDate: yesterday,
			},
		])
		.onConflictDoNothing();

	// 19c. Production Logs — 14-day historical check-off data
	console.log("  -> Production Logs (14-day history)");
	{
		// Component-based items — names MUST match componentName values in product_production_component
		// so that getReport can correlate expected (check-off) vs actual (POS sales expanded by mapping)
		const restaurantItems: Array<{
			id: string | null;
			name: string;
			reorderQty: number;
			closingVariance: number[];
		}> = [
			// ── Proteins ──
			{
				id: null,
				name: "Baked Chicken",
				reorderQty: 50,
				closingVariance: [-2, 0, 3, 0, -1, 0, 2, 0, -3, 1, 0, -1, 0, 2],
			},
			{
				id: null,
				name: "Fry Chicken",
				reorderQty: 40,
				closingVariance: [0, -1, 0, 2, 0, -2, 1, 0, 0, -1, 3, 0, -1, 0],
			},
			{
				id: PROD.curryChicken,
				name: "Curry Chicken",
				reorderQty: 25,
				closingVariance: [0, 1, 0, -1, 2, 0, 0, -2, 1, 0, 3, 0, -1, 0],
			},
			{
				id: PROD.currySnapper,
				name: "Curry Snapper",
				reorderQty: 10,
				closingVariance: [0, 1, 0, -1, 0, 0, 1, 0, 2, 0, -1, 0, 0, 1],
			},
			{
				id: null,
				name: "Baked Snapper",
				reorderQty: 15,
				closingVariance: [0, 2, 0, -1, 0, 0, 1, 0, 0, -2, 0, 1, 0, 0],
			},
			{
				id: null,
				name: "Fry Snapper",
				reorderQty: 12,
				closingVariance: [-1, 0, 0, 1, 0, 2, 0, -1, 0, 0, 1, 0, -2, 0],
			},
			{
				id: PROD.curryBeef,
				name: "Curry Beef",
				reorderQty: 12,
				closingVariance: [0, 0, 1, 0, 0, -1, 0, 2, 0, 0, 0, -1, 1, 0],
			},
			{
				id: null,
				name: "Pineapple Chicken",
				reorderQty: 18,
				closingVariance: [0, 0, -1, 0, 1, 0, 0, -2, 0, 1, 0, 0, 2, 0],
			},
			{
				id: null,
				name: "BBQ Chicken",
				reorderQty: 14,
				closingVariance: [1, 0, -1, 0, 2, 0, 0, 1, -2, 0, 0, -1, 0, 1],
			},
			// ── Bases / Starches ──
			{
				id: null,
				name: "Fried Rice",
				reorderQty: 35,
				closingVariance: [-2, 1, 0, -1, 0, 2, 0, -3, 1, 0, 0, 2, -1, 0],
			},
			{
				id: null,
				name: "Chowmein",
				reorderQty: 30,
				closingVariance: [0, 0, -1, 2, 0, 1, 0, 0, -2, 0, 0, 1, 0, -1],
			},
			{
				id: null,
				name: "Cookup",
				reorderQty: 35,
				closingVariance: [1, -1, 0, 0, -2, 1, 0, 2, 0, -1, 0, 0, 1, -1],
			},
			{
				id: null,
				name: "Raisin Rice",
				reorderQty: 18,
				closingVariance: [0, -1, 1, 0, 0, -1, 2, 0, 0, 1, -2, 0, 0, 1],
			},
			{
				id: null,
				name: "Caribbean Rice",
				reorderQty: 20,
				closingVariance: [0, 2, 0, -1, 1, 0, -1, 0, 2, 0, -2, 1, 0, 0],
			},
			{
				id: null,
				name: "Rice",
				reorderQty: 12,
				closingVariance: [1, 0, 0, -1, 0, 1, -1, 0, 0, 2, 0, -1, 0, 1],
			},
		];
		const bakeryItems = [
			{
				id: PROD.spongeCake,
				name: "Sponge Cake",
				reorderQty: 10,
				closingVariance: [0, 1, 0, -1, 2, 0, 0, 1, 0, -1, 0, 2, 0, 0],
			},
			{
				id: PROD.coconutBuns,
				name: "Coconut Buns",
				reorderQty: 24,
				closingVariance: [2, 0, 0, -1, 0, 3, 0, 0, -2, 0, 1, 0, 0, -1],
			},
			{
				id: PROD.bakedCustard,
				name: "Baked Custard",
				reorderQty: 6,
				closingVariance: [0, -1, 1, 0, 0, 1, 0, -1, 0, 0, 2, 0, -1, 0],
			},
		] as const;

		const PD_HIST = (n: number) =>
			`fe000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
		let pdN = 200; // starts at 200 to avoid collision with static PD(1)-PD(99)

		for (let daysBack = 2; daysBack <= 15; daysBack++) {
			const dayIdx = daysBack - 2;
			const histDate = new Date(Date.now() - daysBack * 86400000)
				.toISOString()
				.split("T")[0]!;

			for (const item of restaurantItems) {
				const opening = dayIdx % 3 === 0 ? 1 : 0;
				const reorder = item.reorderQty + (dayIdx % 5 === 0 ? 5 : 0);
				const closingBase = Math.max(0, Math.floor(reorder * 0.1));
				const closing = Math.max(
					0,
					closingBase + item.closingVariance[dayIdx]!,
				);

				await db
					.insert(schema.productionLog)
					.values([
						{
							id: PD_HIST(pdN++),
							productId: item.id,
							productName: item.name,
							locationId: LOC_ID,
							loggedByUserId: USER.admin,
							entryType: "opening",
							quantity: opening,
							workflow: "restaurant",
							logDate: histDate,
						},
						{
							id: PD_HIST(pdN++),
							productId: item.id,
							productName: item.name,
							locationId: LOC_ID,
							loggedByUserId: USER.admin,
							entryType: "reorder",
							quantity: reorder,
							notes: dayIdx % 5 === 0 ? "High demand day" : null,
							workflow: "restaurant",
							logDate: histDate,
						},
						{
							id: PD_HIST(pdN++),
							productId: item.id,
							productName: item.name,
							locationId: LOC_ID,
							loggedByUserId: USER.admin,
							entryType: "closing",
							quantity: closing,
							notes: closing > 3 ? "Overproduced" : null,
							workflow: "restaurant",
							logDate: histDate,
						},
					])
					.onConflictDoNothing();
			}

			for (const item of bakeryItems) {
				const opening = dayIdx % 4 === 0 ? 2 : 0;
				const reorder = item.reorderQty + (dayIdx % 7 === 0 ? 4 : 0);
				const closing = Math.max(0, 1 + item.closingVariance[dayIdx]!);

				await db
					.insert(schema.productionLog)
					.values([
						{
							id: PD_HIST(pdN++),
							productId: item.id,
							productName: item.name,
							locationId: LOC_ID,
							loggedByUserId: USER.admin,
							entryType: "opening",
							quantity: opening,
							workflow: "bakery",
							logDate: histDate,
						},
						{
							id: PD_HIST(pdN++),
							productId: item.id,
							productName: item.name,
							locationId: LOC_ID,
							loggedByUserId: USER.admin,
							entryType: "reorder",
							quantity: reorder,
							workflow: "bakery",
							logDate: histDate,
						},
						{
							id: PD_HIST(pdN++),
							productId: item.id,
							productName: item.name,
							locationId: LOC_ID,
							loggedByUserId: USER.admin,
							entryType: "closing",
							quantity: closing,
							workflow: "bakery",
							logDate: histDate,
						},
					])
					.onConflictDoNothing();
			}
		}
	}

	// 19d. Waste Log — 30 days of varied entries
	console.log("  -> Waste Log");
	const WL = (n: number) =>
		`ec000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
	await db
		.insert(schema.wasteLog)
		.values([
			{
				id: WL(1),
				organizationId: ORG_ID,
				inventoryItemId: INV_ITEM.chicken,
				productName: "Curry Chicken",
				quantity: "2",
				unit: "each",
				estimatedCost: "1200",
				reason: "spoilage",
				notes: "Left out too long",
				loggedBy: USER.admin,
				createdAt: daysAgo(0, 15),
			},
			{
				id: WL(2),
				organizationId: ORG_ID,
				inventoryItemId: INV_ITEM.rice,
				productName: "White Rice",
				quantity: "1.5",
				unit: "lb",
				estimatedCost: "180",
				reason: "over_prep",
				loggedBy: USER.admin,
				createdAt: daysAgo(0, 16),
			},
			{
				id: WL(3),
				organizationId: ORG_ID,
				inventoryItemId: INV_ITEM.chicken,
				productName: "Fried Rice/Baked Chicken",
				quantity: "3",
				unit: "each",
				estimatedCost: "1800",
				reason: "over_prep",
				notes: "Overproduced",
				loggedBy: USER.admin,
				createdAt: daysAgo(1, 17),
			},
			{
				id: WL(4),
				organizationId: ORG_ID,
				inventoryItemId: INV_ITEM.coconut,
				productName: "Coconut Buns",
				quantity: "6",
				unit: "each",
				estimatedCost: "360",
				reason: "expired",
				loggedBy: USER.admin,
				createdAt: daysAgo(1, 18),
			},
			{
				id: WL(5),
				organizationId: ORG_ID,
				inventoryItemId: INV_ITEM.chicken,
				productName: "Whole Chicken",
				quantity: "1",
				unit: "lb",
				estimatedCost: "450",
				reason: "spoilage",
				loggedBy: USER.admin,
				createdAt: daysAgo(2, 14),
			},
			{
				id: WL(6),
				organizationId: ORG_ID,
				inventoryItemId: null,
				productName: "Sponge Cake",
				quantity: "2",
				unit: "each",
				estimatedCost: "480",
				reason: "dropped",
				notes: "Staff accident",
				loggedBy: USER.admin,
				createdAt: daysAgo(2, 16),
			},
			{
				id: WL(7),
				organizationId: ORG_ID,
				inventoryItemId: null,
				productName: "Tamarind Juice",
				quantity: "1",
				unit: "each",
				estimatedCost: "300",
				reason: "expired",
				loggedBy: USER.admin,
				createdAt: daysAgo(2, 17),
			},
			{
				id: WL(8),
				organizationId: ORG_ID,
				inventoryItemId: INV_ITEM.snapper,
				productName: "Red Snapper",
				quantity: "0.5",
				unit: "lb",
				estimatedCost: "400",
				reason: "spoilage",
				loggedBy: USER.admin,
				createdAt: daysAgo(3, 15),
			},
			{
				id: WL(9),
				organizationId: ORG_ID,
				inventoryItemId: null,
				productName: "Cookup Fry Snapper",
				quantity: "2",
				unit: "each",
				estimatedCost: "1400",
				reason: "over_prep",
				loggedBy: USER.admin,
				createdAt: daysAgo(3, 17),
			},
			{
				id: WL(10),
				organizationId: ORG_ID,
				inventoryItemId: null,
				productName: "Veg. Rice",
				quantity: "4",
				unit: "each",
				estimatedCost: "480",
				reason: "over_prep",
				notes: "Made too much for lunch",
				loggedBy: USER.admin,
				createdAt: daysAgo(4, 16),
			},
			{
				id: WL(11),
				organizationId: ORG_ID,
				inventoryItemId: INV_ITEM.oil,
				productName: "Vegetable Oil",
				quantity: "0.5",
				unit: "gal",
				estimatedCost: "600",
				reason: "other",
				notes: "Spilled during cooking",
				loggedBy: USER.admin,
				createdAt: daysAgo(4, 14),
			},
			{
				id: WL(12),
				organizationId: ORG_ID,
				inventoryItemId: INV_ITEM.chicken,
				productName: "Curry Chicken",
				quantity: "4",
				unit: "each",
				estimatedCost: "2400",
				reason: "over_prep",
				loggedBy: USER.admin,
				createdAt: daysAgo(5, 17),
			},
			{
				id: WL(13),
				organizationId: ORG_ID,
				inventoryItemId: null,
				productName: "Baked Custard",
				quantity: "3",
				unit: "each",
				estimatedCost: "720",
				reason: "expired",
				loggedBy: USER.admin,
				createdAt: daysAgo(5, 18),
			},
			{
				id: WL(14),
				organizationId: ORG_ID,
				inventoryItemId: INV_ITEM.rice,
				productName: "White Rice",
				quantity: "2",
				unit: "lb",
				estimatedCost: "240",
				reason: "spoilage",
				loggedBy: USER.admin,
				createdAt: daysAgo(6, 15),
			},
			{
				id: WL(15),
				organizationId: ORG_ID,
				inventoryItemId: INV_ITEM.noodles,
				productName: "Chowmein Noodles",
				quantity: "0.5",
				unit: "lb",
				estimatedCost: "100",
				reason: "expired",
				loggedBy: USER.admin,
				createdAt: daysAgo(6, 17),
			},
			{
				id: WL(16),
				organizationId: ORG_ID,
				inventoryItemId: null,
				productName: "Fried Rice/Baked Chicken",
				quantity: "2",
				unit: "each",
				estimatedCost: "1200",
				reason: "over_prep",
				loggedBy: USER.admin,
				createdAt: daysAgo(7, 14),
			},
			{
				id: WL(17),
				organizationId: ORG_ID,
				inventoryItemId: INV_ITEM.coconut,
				productName: "Coconut Buns",
				quantity: "8",
				unit: "each",
				estimatedCost: "480",
				reason: "over_prep",
				loggedBy: USER.admin,
				createdAt: daysAgo(7, 16),
			},
			{
				id: WL(18),
				organizationId: ORG_ID,
				inventoryItemId: INV_ITEM.beef,
				productName: "Stewing Beef",
				quantity: "0.3",
				unit: "lb",
				estimatedCost: "210",
				reason: "spoilage",
				loggedBy: USER.admin,
				createdAt: daysAgo(7, 18),
			},
			{
				id: WL(19),
				organizationId: ORG_ID,
				inventoryItemId: null,
				productName: "Curry Snapper",
				quantity: "3",
				unit: "each",
				estimatedCost: "2100",
				reason: "over_prep",
				loggedBy: USER.admin,
				createdAt: daysAgo(9, 15),
			},
			{
				id: WL(20),
				organizationId: ORG_ID,
				inventoryItemId: INV_ITEM.onions,
				productName: "Yellow Onions",
				quantity: "1",
				unit: "lb",
				estimatedCost: "180",
				reason: "spoilage",
				loggedBy: USER.admin,
				createdAt: daysAgo(9, 17),
			},
			{
				id: WL(21),
				organizationId: ORG_ID,
				inventoryItemId: null,
				productName: "Sponge Cake",
				quantity: "1",
				unit: "each",
				estimatedCost: "240",
				reason: "dropped",
				notes: "Customer rejected",
				loggedBy: USER.admin,
				createdAt: daysAgo(11, 16),
			},
			{
				id: WL(22),
				organizationId: ORG_ID,
				inventoryItemId: INV_ITEM.chicken,
				productName: "Whole Chicken",
				quantity: "2",
				unit: "lb",
				estimatedCost: "900",
				reason: "expired",
				loggedBy: USER.admin,
				createdAt: daysAgo(11, 17),
			},
			{
				id: WL(23),
				organizationId: ORG_ID,
				inventoryItemId: null,
				productName: "Curry Beef",
				quantity: "5",
				unit: "each",
				estimatedCost: "1500",
				reason: "over_prep",
				loggedBy: USER.admin,
				createdAt: daysAgo(14, 14),
			},
			{
				id: WL(24),
				organizationId: ORG_ID,
				inventoryItemId: INV_ITEM.flour,
				productName: "All-Purpose Flour",
				quantity: "1",
				unit: "lb",
				estimatedCost: "80",
				reason: "spoilage",
				loggedBy: USER.admin,
				createdAt: daysAgo(14, 16),
			},
			{
				id: WL(25),
				organizationId: ORG_ID,
				inventoryItemId: null,
				productName: "Veg. Meal/Dholl",
				quantity: "3",
				unit: "each",
				estimatedCost: "360",
				reason: "over_prep",
				loggedBy: USER.admin,
				createdAt: daysAgo(17, 15),
			},
			{
				id: WL(26),
				organizationId: ORG_ID,
				inventoryItemId: INV_ITEM.snapper,
				productName: "Red Snapper",
				quantity: "1",
				unit: "lb",
				estimatedCost: "800",
				reason: "spoilage",
				loggedBy: USER.admin,
				createdAt: daysAgo(17, 17),
			},
			{
				id: WL(27),
				organizationId: ORG_ID,
				inventoryItemId: INV_ITEM.coconut,
				productName: "Coconut Buns",
				quantity: "12",
				unit: "each",
				estimatedCost: "720",
				reason: "expired",
				loggedBy: USER.admin,
				createdAt: daysAgo(20, 16),
			},
			{
				id: WL(28),
				organizationId: ORG_ID,
				inventoryItemId: INV_ITEM.sugar,
				productName: "Brown Sugar",
				quantity: "0.5",
				unit: "lb",
				estimatedCost: "75",
				reason: "other",
				notes: "Contaminated by moisture",
				loggedBy: USER.admin,
				createdAt: daysAgo(20, 18),
			},
			{
				id: WL(29),
				organizationId: ORG_ID,
				inventoryItemId: null,
				productName: "Chowmein/Fry Chicken",
				quantity: "4",
				unit: "each",
				estimatedCost: "2400",
				reason: "over_prep",
				loggedBy: USER.admin,
				createdAt: daysAgo(23, 14),
			},
			{
				id: WL(30),
				organizationId: ORG_ID,
				inventoryItemId: INV_ITEM.tamarind,
				productName: "Tamarind Pulp",
				quantity: "0.5",
				unit: "lb",
				estimatedCost: "175",
				reason: "spoilage",
				loggedBy: USER.admin,
				createdAt: daysAgo(26, 16),
			},
		])
		.onConflictDoNothing();

	// 19e. Time Entries (Timeclock shifts) — 14 days
	console.log("  -> Time Entries");
	const TE = (n: number) =>
		`ed000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
	await db
		.insert(schema.timeEntry)
		.values([
			// Today — 3 active shifts (no clockOut)
			{
				id: TE(1),
				userId: USER.cashier,
				locationId: LOC_ID,
				organizationId: ORG_ID,
				clockIn: daysAgo(0, 8),
				clockOut: null,
				breakMinutes: "0",
				status: "active",
			},
			{
				id: TE(2),
				userId: USER.anna,
				locationId: LOC_ID,
				organizationId: ORG_ID,
				clockIn: daysAgo(0, 8),
				clockOut: null,
				breakMinutes: "0",
				status: "active",
			},
			{
				id: TE(3),
				userId: USER.production,
				locationId: LOC_ID,
				organizationId: ORG_ID,
				clockIn: daysAgo(0, 7),
				clockOut: null,
				breakMinutes: "0",
				status: "active",
			},
			// Day 1
			{
				id: TE(4),
				userId: USER.cashier,
				locationId: LOC_ID,
				organizationId: ORG_ID,
				clockIn: daysAgo(1, 8),
				clockOut: daysAgo(1, 17),
				breakMinutes: "30",
				status: "completed",
			},
			{
				id: TE(5),
				userId: USER.anna,
				locationId: LOC_ID,
				organizationId: ORG_ID,
				clockIn: daysAgo(1, 8),
				clockOut: daysAgo(1, 16),
				breakMinutes: "30",
				status: "completed",
			},
			{
				id: TE(6),
				userId: USER.production,
				locationId: LOC_ID,
				organizationId: ORG_ID,
				clockIn: daysAgo(1, 7),
				clockOut: daysAgo(1, 15),
				breakMinutes: "0",
				status: "completed",
			},
			{
				id: TE(7),
				userId: USER.carl,
				locationId: LOC_ID,
				organizationId: ORG_ID,
				clockIn: daysAgo(1, 12),
				clockOut: daysAgo(1, 20),
				breakMinutes: "30",
				status: "completed",
			},
			// Day 2
			{
				id: TE(8),
				userId: USER.cashier,
				locationId: LOC_ID,
				organizationId: ORG_ID,
				clockIn: daysAgo(2, 8),
				clockOut: daysAgo(2, 17),
				breakMinutes: "30",
				status: "completed",
			},
			{
				id: TE(9),
				userId: USER.production,
				locationId: LOC_ID,
				organizationId: ORG_ID,
				clockIn: daysAgo(2, 7),
				clockOut: daysAgo(2, 15),
				breakMinutes: "0",
				status: "completed",
			},
			{
				id: TE(10),
				userId: USER.bonita,
				locationId: LOC_ID,
				organizationId: ORG_ID,
				clockIn: daysAgo(2, 9),
				clockOut: daysAgo(2, 17),
				breakMinutes: "60",
				status: "completed",
			},
			// Day 3
			{
				id: TE(11),
				userId: USER.cashier,
				locationId: LOC_ID,
				organizationId: ORG_ID,
				clockIn: daysAgo(3, 8),
				clockOut: daysAgo(3, 18),
				breakMinutes: "30",
				status: "completed",
			},
			{
				id: TE(12),
				userId: USER.anna,
				locationId: LOC_ID,
				organizationId: ORG_ID,
				clockIn: daysAgo(3, 8),
				clockOut: daysAgo(3, 16),
				breakMinutes: "30",
				status: "completed",
			},
			{
				id: TE(13),
				userId: USER.production,
				locationId: LOC_ID,
				organizationId: ORG_ID,
				clockIn: daysAgo(3, 7),
				clockOut: daysAgo(3, 15),
				breakMinutes: "0",
				status: "completed",
			},
			{
				id: TE(14),
				userId: USER.renatta,
				locationId: LOC_ID,
				organizationId: ORG_ID,
				clockIn: daysAgo(3, 10),
				clockOut: daysAgo(3, 18),
				breakMinutes: "30",
				status: "completed",
			},
			// Day 4
			{
				id: TE(15),
				userId: USER.carl,
				locationId: LOC_ID,
				organizationId: ORG_ID,
				clockIn: daysAgo(4, 8),
				clockOut: daysAgo(4, 17),
				breakMinutes: "30",
				status: "completed",
			},
			{
				id: TE(16),
				userId: USER.production,
				locationId: LOC_ID,
				organizationId: ORG_ID,
				clockIn: daysAgo(4, 7),
				clockOut: daysAgo(4, 14),
				breakMinutes: "0",
				status: "completed",
			},
			{
				id: TE(17),
				userId: USER.anna,
				locationId: LOC_ID,
				organizationId: ORG_ID,
				clockIn: daysAgo(4, 9),
				clockOut: daysAgo(4, 17),
				breakMinutes: "30",
				status: "completed",
			},
			// Day 5
			{
				id: TE(18),
				userId: USER.cashier,
				locationId: LOC_ID,
				organizationId: ORG_ID,
				clockIn: daysAgo(5, 8),
				clockOut: daysAgo(5, 17),
				breakMinutes: "30",
				status: "completed",
			},
			{
				id: TE(19),
				userId: USER.production,
				locationId: LOC_ID,
				organizationId: ORG_ID,
				clockIn: daysAgo(5, 7),
				clockOut: daysAgo(5, 15),
				breakMinutes: "0",
				status: "completed",
			},
			{
				id: TE(20),
				userId: USER.bonita,
				locationId: LOC_ID,
				organizationId: ORG_ID,
				clockIn: daysAgo(5, 9),
				clockOut: daysAgo(5, 18),
				breakMinutes: "60",
				status: "completed",
			},
			{
				id: TE(21),
				userId: USER.carl,
				locationId: LOC_ID,
				organizationId: ORG_ID,
				clockIn: daysAgo(5, 12),
				clockOut: daysAgo(5, 20),
				breakMinutes: "30",
				status: "completed",
			},
			// Day 6
			{
				id: TE(22),
				userId: USER.cashier,
				locationId: LOC_ID,
				organizationId: ORG_ID,
				clockIn: daysAgo(6, 8),
				clockOut: daysAgo(6, 17),
				breakMinutes: "30",
				status: "completed",
			},
			{
				id: TE(23),
				userId: USER.anna,
				locationId: LOC_ID,
				organizationId: ORG_ID,
				clockIn: daysAgo(6, 8),
				clockOut: daysAgo(6, 16),
				breakMinutes: "30",
				status: "completed",
			},
			// Day 7
			{
				id: TE(24),
				userId: USER.cashier,
				locationId: LOC_ID,
				organizationId: ORG_ID,
				clockIn: daysAgo(7, 8),
				clockOut: daysAgo(7, 17),
				breakMinutes: "30",
				status: "completed",
			},
			{
				id: TE(25),
				userId: USER.production,
				locationId: LOC_ID,
				organizationId: ORG_ID,
				clockIn: daysAgo(7, 7),
				clockOut: daysAgo(7, 15),
				breakMinutes: "0",
				status: "completed",
			},
			{
				id: TE(26),
				userId: USER.renatta,
				locationId: LOC_ID,
				organizationId: ORG_ID,
				clockIn: daysAgo(7, 10),
				clockOut: daysAgo(7, 19),
				breakMinutes: "30",
				status: "completed",
			},
			// Day 8
			{
				id: TE(27),
				userId: USER.carl,
				locationId: LOC_ID,
				organizationId: ORG_ID,
				clockIn: daysAgo(8, 8),
				clockOut: daysAgo(8, 17),
				breakMinutes: "30",
				status: "completed",
			},
			{
				id: TE(28),
				userId: USER.production,
				locationId: LOC_ID,
				organizationId: ORG_ID,
				clockIn: daysAgo(8, 7),
				clockOut: daysAgo(8, 14),
				breakMinutes: "0",
				status: "completed",
			},
			// Day 9
			{
				id: TE(29),
				userId: USER.cashier,
				locationId: LOC_ID,
				organizationId: ORG_ID,
				clockIn: daysAgo(9, 8),
				clockOut: daysAgo(9, 17),
				breakMinutes: "30",
				status: "completed",
			},
			{
				id: TE(30),
				userId: USER.anna,
				locationId: LOC_ID,
				organizationId: ORG_ID,
				clockIn: daysAgo(9, 8),
				clockOut: daysAgo(9, 16),
				breakMinutes: "30",
				status: "completed",
			},
			{
				id: TE(31),
				userId: USER.production,
				locationId: LOC_ID,
				organizationId: ORG_ID,
				clockIn: daysAgo(9, 7),
				clockOut: daysAgo(9, 15),
				breakMinutes: "0",
				status: "completed",
			},
			// Day 10
			{
				id: TE(32),
				userId: USER.bonita,
				locationId: LOC_ID,
				organizationId: ORG_ID,
				clockIn: daysAgo(10, 9),
				clockOut: daysAgo(10, 17),
				breakMinutes: "60",
				status: "completed",
			},
			{
				id: TE(33),
				userId: USER.carl,
				locationId: LOC_ID,
				organizationId: ORG_ID,
				clockIn: daysAgo(10, 12),
				clockOut: daysAgo(10, 20),
				breakMinutes: "30",
				status: "completed",
			},
			// Day 11
			{
				id: TE(34),
				userId: USER.cashier,
				locationId: LOC_ID,
				organizationId: ORG_ID,
				clockIn: daysAgo(11, 8),
				clockOut: daysAgo(11, 18),
				breakMinutes: "30",
				status: "completed",
				notes: "Stayed late",
			},
			{
				id: TE(35),
				userId: USER.production,
				locationId: LOC_ID,
				organizationId: ORG_ID,
				clockIn: daysAgo(11, 7),
				clockOut: daysAgo(11, 15),
				breakMinutes: "0",
				status: "completed",
			},
			// Day 12
			{
				id: TE(36),
				userId: USER.anna,
				locationId: LOC_ID,
				organizationId: ORG_ID,
				clockIn: daysAgo(12, 8),
				clockOut: daysAgo(12, 16),
				breakMinutes: "30",
				status: "completed",
			},
			{
				id: TE(37),
				userId: USER.renatta,
				locationId: LOC_ID,
				organizationId: ORG_ID,
				clockIn: daysAgo(12, 10),
				clockOut: daysAgo(12, 18),
				breakMinutes: "30",
				status: "completed",
			},
			// Day 13
			{
				id: TE(38),
				userId: USER.cashier,
				locationId: LOC_ID,
				organizationId: ORG_ID,
				clockIn: daysAgo(13, 8),
				clockOut: daysAgo(13, 17),
				breakMinutes: "30",
				status: "completed",
			},
			{
				id: TE(39),
				userId: USER.production,
				locationId: LOC_ID,
				organizationId: ORG_ID,
				clockIn: daysAgo(13, 7),
				clockOut: daysAgo(13, 15),
				breakMinutes: "0",
				status: "completed",
			},
			// Day 14
			{
				id: TE(40),
				userId: USER.carl,
				locationId: LOC_ID,
				organizationId: ORG_ID,
				clockIn: daysAgo(14, 8),
				clockOut: daysAgo(14, 17),
				breakMinutes: "30",
				status: "completed",
			},
			{
				id: TE(41),
				userId: USER.anna,
				locationId: LOC_ID,
				organizationId: ORG_ID,
				clockIn: daysAgo(14, 8),
				clockOut: daysAgo(14, 16),
				breakMinutes: "30",
				status: "completed",
			},
		])
		.onConflictDoNothing();

	// 19f. Invoices
	console.log("  -> Invoices");
	const INV = (n: number) =>
		`ee000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
	// Reset counter
	await db.execute(
		sql`INSERT INTO invoice_counter (organization_id, last_number) VALUES (${ORG_ID}, 8) ON CONFLICT (organization_id) DO UPDATE SET last_number = GREATEST(invoice_counter.last_number, 8)`,
	);
	await db
		.insert(schema.invoice)
		.values([
			{
				id: INV(1),
				organizationId: ORG_ID,
				locationId: LOC_ID,
				invoiceNumber: "INV-0001",
				customerId: CUST(3),
				customerName: "Anita Ramsaroop",
				customerPhone: "592-600-1003",
				items: JSON.stringify([
					{
						description: "Catering - Office Lunch (15 pax)",
						quantity: 15,
						unitPrice: 2200,
						total: 33000,
					},
					{
						description: "Assorted Beverages",
						quantity: 15,
						unitPrice: 300,
						total: 4500,
					},
				]),
				subtotal: "37500",
				taxTotal: "0",
				total: "37500",
				status: "paid",
				amountPaid: "37500",
				dueDate: daysAgo(20, 12),
				datePaid: daysAgo(18, 10),
				createdBy: USER.admin,
				createdAt: daysAgo(25, 9),
			},
			{
				id: INV(2),
				organizationId: ORG_ID,
				locationId: LOC_ID,
				invoiceNumber: "INV-0002",
				customerName: "Ministry of Education",
				customerAddress: "Carifesta Avenue, Georgetown",
				items: JSON.stringify([
					{
						description: "Staff Appreciation Lunch (30 pax)",
						quantity: 30,
						unitPrice: 2200,
						total: 66000,
					},
					{
						description: "Dessert Trays",
						quantity: 5,
						unitPrice: 2400,
						total: 12000,
					},
				]),
				subtotal: "78000",
				taxTotal: "0",
				total: "78000",
				status: "paid",
				amountPaid: "78000",
				dueDate: daysAgo(15, 12),
				datePaid: daysAgo(14, 14),
				createdBy: USER.admin,
				createdAt: daysAgo(20, 10),
			},
			{
				id: INV(3),
				organizationId: ORG_ID,
				locationId: LOC_ID,
				invoiceNumber: "INV-0003",
				customerId: CUST(1),
				customerName: "Priya Singh",
				customerPhone: "592-600-1001",
				items: JSON.stringify([
					{
						description: "Birthday Party Catering (20 pax)",
						quantity: 20,
						unitPrice: 2500,
						total: 50000,
					},
					{
						description: "Sponge Cake (large)",
						quantity: 2,
						unitPrice: 3500,
						total: 7000,
					},
				]),
				subtotal: "57000",
				taxTotal: "0",
				total: "57000",
				status: "partial",
				amountPaid: "30000",
				dueDate: daysAgo(5, 12),
				createdBy: USER.admin,
				createdAt: daysAgo(12, 10),
			},
			{
				id: INV(4),
				organizationId: ORG_ID,
				locationId: LOC_ID,
				invoiceNumber: "INV-0004",
				customerName: "Guyana Revenue Authority",
				customerAddress: "200-201 Camp Street, Georgetown",
				items: JSON.stringify([
					{
						description: "Corporate Lunch (50 pax)",
						quantity: 50,
						unitPrice: 2200,
						total: 110000,
					},
					{
						description: "Beverages (assorted)",
						quantity: 50,
						unitPrice: 300,
						total: 15000,
					},
				]),
				subtotal: "125000",
				taxTotal: "0",
				total: "125000",
				status: "sent",
				amountPaid: "0",
				dueDate: daysAgo(-7, 12),
				createdBy: USER.admin,
				createdAt: daysAgo(3, 9),
			},
			{
				id: INV(5),
				organizationId: ORG_ID,
				locationId: LOC_ID,
				invoiceNumber: "INV-0005",
				customerName: "Banks DIH Limited",
				customerAddress: "Thirst Park, Georgetown",
				items: JSON.stringify([
					{
						description: "Monthly Cafeteria Service - Feb 2026",
						quantity: 1,
						unitPrice: 280000,
						total: 280000,
					},
				]),
				subtotal: "280000",
				taxTotal: "0",
				total: "280000",
				status: "overdue",
				amountPaid: "0",
				dueDate: daysAgo(10, 12),
				createdBy: USER.admin,
				createdAt: daysAgo(40, 9),
			},
			{
				id: INV(6),
				organizationId: ORG_ID,
				locationId: LOC_ID,
				invoiceNumber: "INV-0006",
				customerId: CUST(2),
				customerName: "Rajesh Persaud",
				customerPhone: "592-600-1002",
				items: JSON.stringify([
					{
						description: "Wedding Reception Catering (80 pax)",
						quantity: 80,
						unitPrice: 3500,
						total: 280000,
					},
					{
						description: "Wedding Cake (3-tier)",
						quantity: 1,
						unitPrice: 25000,
						total: 25000,
					},
					{
						description: "Bar Package",
						quantity: 80,
						unitPrice: 500,
						total: 40000,
					},
				]),
				subtotal: "345000",
				taxTotal: "0",
				total: "345000",
				status: "draft",
				amountPaid: "0",
				dueDate: daysAgo(-14, 12),
				createdBy: USER.admin,
				createdAt: daysAgo(1, 14),
			},
			{
				id: INV(7),
				organizationId: ORG_ID,
				locationId: LOC_ID,
				invoiceNumber: "INV-0007",
				customerName: "University of Guyana",
				items: JSON.stringify([
					{
						description: "Graduation Dinner (120 pax)",
						quantity: 120,
						unitPrice: 2800,
						total: 336000,
					},
				]),
				subtotal: "336000",
				taxTotal: "0",
				total: "336000",
				status: "paid",
				amountPaid: "336000",
				datePaid: daysAgo(30, 14),
				dueDate: daysAgo(35, 12),
				createdBy: USER.admin,
				createdAt: daysAgo(50, 9),
			},
			{
				id: INV(8),
				organizationId: ORG_ID,
				locationId: LOC_ID,
				invoiceNumber: "INV-0008",
				customerName: "Digicel Guyana",
				items: JSON.stringify([
					{
						description: "Staff Lunch x 25 - Weekly (4 weeks)",
						quantity: 100,
						unitPrice: 2200,
						total: 220000,
					},
				]),
				subtotal: "220000",
				taxTotal: "0",
				total: "220000",
				status: "partial",
				amountPaid: "110000",
				dueDate: daysAgo(3, 12),
				createdBy: USER.admin,
				createdAt: daysAgo(30, 9),
			},
		])
		.onConflictDoNothing();

	// 19g. Quotations
	console.log("  -> Quotations");
	const QUOT = (n: number) =>
		`ef000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
	await db.execute(
		sql`INSERT INTO quotation_counter (organization_id, last_number) VALUES (${ORG_ID}, 5) ON CONFLICT (organization_id) DO UPDATE SET last_number = GREATEST(quotation_counter.last_number, 5)`,
	);
	await db
		.insert(schema.quotation)
		.values([
			{
				id: QUOT(1),
				organizationId: ORG_ID,
				locationId: LOC_ID,
				quotationNumber: "QUO-0001",
				customerName: "Guyana Power & Light",
				items: JSON.stringify([
					{
						description: "Corporate Lunch Package (40 pax/day, 22 days)",
						quantity: 880,
						unitPrice: 2200,
						total: 1936000,
					},
				]),
				subtotal: "1936000",
				taxTotal: "0",
				total: "1936000",
				status: "sent",
				validUntil: daysAgo(-10, 12),
				createdBy: USER.admin,
				createdAt: daysAgo(5, 10),
			},
			{
				id: QUOT(2),
				organizationId: ORG_ID,
				locationId: LOC_ID,
				quotationNumber: "QUO-0002",
				customerId: CUST(4),
				customerName: "Khalid Khan",
				items: JSON.stringify([
					{
						description: "Anniversary Dinner (30 pax)",
						quantity: 30,
						unitPrice: 3000,
						total: 90000,
					},
					{
						description: "Custom Anniversary Cake",
						quantity: 1,
						unitPrice: 15000,
						total: 15000,
					},
				]),
				subtotal: "105000",
				taxTotal: "0",
				total: "105000",
				status: "draft",
				validUntil: daysAgo(-7, 12),
				createdBy: USER.admin,
				createdAt: daysAgo(1, 11),
			},
			{
				id: QUOT(3),
				organizationId: ORG_ID,
				locationId: LOC_ID,
				quotationNumber: "QUO-0003",
				customerName: "Hand-in-Hand Insurance",
				items: JSON.stringify([
					{
						description: "Team Building Lunch (60 pax)",
						quantity: 60,
						unitPrice: 2500,
						total: 150000,
					},
				]),
				subtotal: "150000",
				taxTotal: "0",
				total: "150000",
				status: "accepted",
				validUntil: daysAgo(-5, 12),
				createdBy: USER.admin,
				createdAt: daysAgo(7, 9),
			},
			{
				id: QUOT(4),
				organizationId: ORG_ID,
				locationId: LOC_ID,
				quotationNumber: "QUO-0004",
				customerName: "GTT (Guyana Telephone & Telegraph)",
				items: JSON.stringify([
					{
						description: "Monthly Staff Catering - 35 pax",
						quantity: 770,
						unitPrice: 2200,
						total: 1694000,
					},
				]),
				subtotal: "1694000",
				taxTotal: "0",
				total: "1694000",
				status: "declined",
				validUntil: daysAgo(2, 12),
				notes: "Client went with competitor",
				createdBy: USER.admin,
				createdAt: daysAgo(15, 9),
			},
			{
				id: QUOT(5),
				organizationId: ORG_ID,
				locationId: LOC_ID,
				quotationNumber: "QUO-0005",
				customerName: "Private Client - Wedding",
				items: JSON.stringify([
					{
						description: "Wedding Buffet (150 pax)",
						quantity: 150,
						unitPrice: 4000,
						total: 600000,
					},
					{
						description: "3-tier Wedding Cake",
						quantity: 1,
						unitPrice: 35000,
						total: 35000,
					},
					{
						description: "Beverages Package",
						quantity: 150,
						unitPrice: 500,
						total: 75000,
					},
				]),
				subtotal: "710000",
				taxTotal: "0",
				total: "710000",
				status: "sent",
				validUntil: daysAgo(-21, 12),
				createdBy: USER.admin,
				createdAt: daysAgo(2, 14),
			},
		])
		.onConflictDoNothing();

	// 19h. Discount Rules
	console.log("  -> Discount Rules");
	const DR = (n: number) =>
		`ab000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
	await db
		.insert(schema.discountRule)
		.values([
			{
				id: DR(1),
				organizationId: ORG_ID,
				name: "Happy Hour 10% Off",
				type: "percentage",
				value: "10",
				applyTo: "order",
				isAutoApply: true,
				scheduleType: "time_window",
				startTime: "14:00",
				endTime: "16:00",
				daysOfWeek: "mon,tue,wed,thu,fri",
				isActive: true,
			},
			{
				id: DR(2),
				organizationId: ORG_ID,
				name: "Senior Citizen Discount",
				type: "percentage",
				value: "15",
				applyTo: "order",
				isAutoApply: false,
				scheduleType: "always",
				promoCode: "SENIOR15",
				isActive: true,
			},
			{
				id: DR(3),
				organizationId: ORG_ID,
				name: "Large Order $500 Off",
				type: "fixed",
				value: "500",
				applyTo: "order",
				minOrderTotal: "10000",
				isAutoApply: true,
				scheduleType: "always",
				isActive: true,
			},
			{
				id: DR(4),
				organizationId: ORG_ID,
				name: "Staff Meal Discount",
				type: "percentage",
				value: "50",
				applyTo: "order",
				promoCode: "STAFF50",
				isAutoApply: false,
				scheduleType: "always",
				isActive: true,
			},
			{
				id: DR(5),
				organizationId: ORG_ID,
				name: "Weekend Special 5% Off",
				type: "percentage",
				value: "5",
				applyTo: "order",
				isAutoApply: true,
				scheduleType: "time_window",
				daysOfWeek: "sat,sun",
				isActive: true,
			},
			{
				id: DR(6),
				organizationId: ORG_ID,
				name: "Buy 5 Meals Get 1 Free",
				type: "bogo",
				value: "100",
				applyTo: "item",
				buyQuantity: 5,
				getQuantity: 1,
				isAutoApply: false,
				scheduleType: "always",
				isActive: false,
			},
			{
				id: DR(7),
				organizationId: ORG_ID,
				name: "Loyalty VIP $200 Off",
				type: "fixed",
				value: "200",
				applyTo: "order",
				promoCode: "VIP200",
				minOrderTotal: "5000",
				maxUses: 100,
				currentUses: 23,
				isAutoApply: false,
				scheduleType: "always",
				isActive: true,
			},
			{
				id: DR(8),
				organizationId: ORG_ID,
				name: "Grand Opening 20% Off",
				type: "percentage",
				value: "20",
				applyTo: "order",
				isAutoApply: false,
				scheduleType: "date_range",
				startDate: "2026-01-01",
				endDate: "2026-01-31",
				isActive: false,
			},
		])
		.onConflictDoNothing();

	// 20. Audit Logs
	console.log("  -> Audit Logs");
	const AL = (n: number) =>
		`ff000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
	await db
		.insert(schema.auditLog)
		.values([
			{
				id: AL(1),
				userId: USER.admin,
				userNameSnapshot: "Admin",
				roleSnapshot: "Executive",
				locationId: LOC_ID,
				entityType: "order",
				entityId: ORDER.o16,
				actionType: "void",
				afterData: { reason: "Customer changed mind" },
				createdAt: daysAgo(1, 15),
			},
			{
				id: AL(2),
				userId: USER.admin,
				userNameSnapshot: "Admin",
				roleSnapshot: "Executive",
				locationId: LOC_ID,
				entityType: "product",
				entityId: PROD.friedRiceBakedChicken,
				actionType: "price_update",
				beforeData: { price: "2000" },
				afterData: { price: "2200" },
				reason: "Annual price adjustment",
				createdAt: daysAgo(5, 9),
			},
			{
				id: AL(3),
				userId: USER.admin,
				userNameSnapshot: "Admin",
				roleSnapshot: "Executive",
				locationId: LOC_ID,
				entityType: "cash_session",
				entityId: CASH_SESSION.cs1,
				actionType: "close",
				afterData: {
					closingCount: "35100",
					expectedCash: "34700",
					variance: "400",
				},
				createdAt: daysAgo(1, 18),
			},
			{
				id: AL(4),
				userId: USER.cashier,
				userNameSnapshot: "Cashier Demo",
				roleSnapshot: "Cashier",
				locationId: LOC_ID,
				entityType: "cash_session",
				entityId: CASH_SESSION.cs3,
				actionType: "open",
				afterData: { openingFloat: "10000" },
				createdAt: daysAgo(0, 8),
			},
			{
				id: AL(5),
				userId: USER.admin,
				userNameSnapshot: "Admin",
				roleSnapshot: "Executive",
				locationId: LOC_ID,
				entityType: "purchase_order",
				entityId: PO.po1,
				actionType: "approve",
				afterData: { total: "104000", supplier: "Fresh Foods Supply" },
				createdAt: daysAgo(5, 10),
			},
			{
				id: AL(6),
				userId: USER.admin,
				userNameSnapshot: "Admin",
				roleSnapshot: "Executive",
				locationId: LOC_ID,
				entityType: "purchase_order",
				entityId: PO.po2,
				actionType: "approve",
				afterData: { total: "84000", supplier: "Beverage Distributors" },
				createdAt: daysAgo(1, 11),
			},
			{
				id: AL(7),
				userId: USER.admin,
				userNameSnapshot: "Admin",
				roleSnapshot: "Executive",
				locationId: LOC_ID,
				entityType: "inventory",
				entityId: INV_ITEM.chicken,
				actionType: "stock_receipt",
				afterData: { quantity: 100 },
				createdAt: daysAgo(3, 8),
			},
			{
				id: AL(8),
				userId: USER.cashier,
				userNameSnapshot: "Cashier Demo",
				roleSnapshot: "Cashier",
				locationId: LOC_ID,
				entityType: "order",
				entityId: ORDER.o1,
				actionType: "create",
				afterData: { total: "6600", items: 3 },
				createdAt: daysAgo(6, 10),
			},
			{
				id: AL(9),
				userId: USER.admin,
				userNameSnapshot: "Admin",
				roleSnapshot: "Executive",
				locationId: LOC_ID,
				entityType: "cash_session",
				entityId: CASH_SESSION.cs1,
				actionType: "payout",
				afterData: { amount: "2500", reason: "Petty cash" },
				createdAt: daysAgo(1, 14),
			},
			{
				id: AL(10),
				userId: USER.admin,
				userNameSnapshot: "Admin",
				roleSnapshot: "Executive",
				locationId: LOC_ID,
				entityType: "user",
				entityId: USER.cashier,
				actionType: "create",
				afterData: { name: "Cashier Demo", email: "cashier@bettencourt.com" },
				createdAt: daysAgo(6, 8),
			},
			{
				id: AL(11),
				userId: USER.cashier,
				userNameSnapshot: "Cashier Demo",
				roleSnapshot: "Cashier",
				locationId: LOC_ID,
				entityType: "cash_session",
				entityId: CASH_SESSION.cs1,
				actionType: "cash_drop",
				afterData: { amount: "15000" },
				createdAt: daysAgo(1, 13),
			},
			{
				id: AL(12),
				userId: USER.admin,
				userNameSnapshot: "Admin",
				roleSnapshot: "Executive",
				locationId: LOC_ID,
				entityType: "production",
				entityId: PROD.friedRiceBakedChicken,
				actionType: "log_production",
				afterData: { quantity: 30 },
				createdAt: daysAgo(0, 7),
			},
		])
		.onConflictDoNothing();

	// ── Phase 4: Extended Mock Data ────────────────────────────────────

	// 21. Customers
	console.log("  -> Customers");
	await db
		.insert(schema.customer)
		.values([
			{
				id: CUST(1),
				organizationId: ORG_ID,
				name: "Priya Singh",
				phone: "592-600-1001",
				email: "priya.singh@gmail.com",
				totalSpent: "47500",
				visitCount: 18,
				lastVisitAt: daysAgo(1, 12),
			},
			{
				id: CUST(2),
				organizationId: ORG_ID,
				name: "Rajesh Persaud",
				phone: "592-600-1002",
				totalSpent: "32000",
				visitCount: 12,
				lastVisitAt: daysAgo(3, 13),
			},
			{
				id: CUST(3),
				organizationId: ORG_ID,
				name: "Anita Ramsaroop",
				phone: "592-600-1003",
				email: "anita.r@hotmail.com",
				totalSpent: "89200",
				visitCount: 34,
				lastVisitAt: daysAgo(0, 11),
			},
			{
				id: CUST(4),
				organizationId: ORG_ID,
				name: "Khalid Khan",
				phone: "592-600-1004",
				totalSpent: "15600",
				visitCount: 6,
				lastVisitAt: daysAgo(7, 14),
			},
			{
				id: CUST(5),
				organizationId: ORG_ID,
				name: "Maria Rodrigues",
				phone: "592-600-1234",
				email: "maria.rod@yahoo.com",
				totalSpent: "63400",
				visitCount: 25,
				lastVisitAt: daysAgo(2, 12),
			},
			{
				id: CUST(6),
				organizationId: ORG_ID,
				name: "Devon Williams",
				phone: "592-600-1006",
				totalSpent: "28900",
				visitCount: 11,
				lastVisitAt: daysAgo(5, 15),
			},
			{
				id: CUST(7),
				organizationId: ORG_ID,
				name: "Sheila Bacchus",
				phone: "592-600-1007",
				email: "sheila.b@gmail.com",
				totalSpent: "112000",
				visitCount: 45,
				lastVisitAt: daysAgo(0, 13),
			},
			{
				id: CUST(8),
				organizationId: ORG_ID,
				name: "Ravi Ramkhelawan",
				phone: "592-600-1008",
				totalSpent: "9800",
				visitCount: 4,
				lastVisitAt: daysAgo(14, 12),
			},
			{
				id: CUST(9),
				organizationId: ORG_ID,
				name: "Geeta Harripaul",
				phone: "592-600-1009",
				email: "geeta.h@gmail.com",
				totalSpent: "54300",
				visitCount: 21,
				lastVisitAt: daysAgo(1, 10),
			},
			{
				id: CUST(10),
				organizationId: ORG_ID,
				name: "Marcus De Souza",
				phone: "592-600-1010",
				totalSpent: "71800",
				visitCount: 29,
				lastVisitAt: daysAgo(0, 14),
			},
		])
		.onConflictDoNothing();

	// 22. Loyalty Program + Tiers
	console.log("  -> Loyalty Program");
	const LOYALTY_PROG = "1a000000-0000-4000-8000-000000000001";
	const LTIER = (n: number) =>
		`1b000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
	await db
		.insert(schema.loyaltyProgram)
		.values({
			id: LOYALTY_PROG,
			organizationId: ORG_ID,
			name: "Bettencourt's Rewards",
			pointsPerDollar: 1,
			isActive: true,
		})
		.onConflictDoNothing();
	await db
		.insert(schema.loyaltyTier)
		.values([
			{
				id: LTIER(1),
				programId: LOYALTY_PROG,
				name: "Bronze",
				pointsRequired: 0,
				rewardType: "percentage_discount",
				rewardValue: "2",
				sortOrder: 1,
			},
			{
				id: LTIER(2),
				programId: LOYALTY_PROG,
				name: "Silver",
				pointsRequired: 500,
				rewardType: "percentage_discount",
				rewardValue: "5",
				sortOrder: 2,
			},
			{
				id: LTIER(3),
				programId: LOYALTY_PROG,
				name: "Gold",
				pointsRequired: 2000,
				rewardType: "percentage_discount",
				rewardValue: "10",
				sortOrder: 3,
			},
		])
		.onConflictDoNothing();

	// 23. Customer Loyalty enrollments
	console.log("  -> Customer Loyalty");
	const CLOY = (n: number) =>
		`1c000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
	await db
		.insert(schema.customerLoyalty)
		.values([
			{
				id: CLOY(1),
				customerId: CUST(1),
				programId: LOYALTY_PROG,
				currentPoints: 475,
				lifetimePoints: 1200,
			},
			{
				id: CLOY(2),
				customerId: CUST(2),
				programId: LOYALTY_PROG,
				currentPoints: 320,
				lifetimePoints: 700,
			},
			{
				id: CLOY(3),
				customerId: CUST(3),
				programId: LOYALTY_PROG,
				currentPoints: 2150,
				lifetimePoints: 8920,
			},
			{
				id: CLOY(4),
				customerId: CUST(4),
				programId: LOYALTY_PROG,
				currentPoints: 156,
				lifetimePoints: 400,
			},
			{
				id: CLOY(5),
				customerId: CUST(5),
				programId: LOYALTY_PROG,
				currentPoints: 634,
				lifetimePoints: 3200,
			},
			{
				id: CLOY(6),
				customerId: CUST(6),
				programId: LOYALTY_PROG,
				currentPoints: 289,
				lifetimePoints: 850,
			},
			{
				id: CLOY(7),
				customerId: CUST(7),
				programId: LOYALTY_PROG,
				currentPoints: 3800,
				lifetimePoints: 11200,
			},
			{
				id: CLOY(8),
				customerId: CUST(8),
				programId: LOYALTY_PROG,
				currentPoints: 98,
				lifetimePoints: 200,
			},
			{
				id: CLOY(9),
				customerId: CUST(9),
				programId: LOYALTY_PROG,
				currentPoints: 543,
				lifetimePoints: 2700,
			},
			{
				id: CLOY(10),
				customerId: CUST(10),
				programId: LOYALTY_PROG,
				currentPoints: 1820,
				lifetimePoints: 5900,
			},
		])
		.onConflictDoNothing();

	// 24. Loyalty Transactions
	console.log("  -> Loyalty Transactions");
	const LTXN = (n: number) =>
		`1d000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
	await db
		.insert(schema.loyaltyTransaction)
		.values([
			{
				id: LTXN(1),
				customerLoyaltyId: CLOY(3),
				type: "earn",
				points: 850,
				description: "Purchase — $850 order",
				createdAt: daysAgo(1, 12),
			},
			{
				id: LTXN(2),
				customerLoyaltyId: CLOY(3),
				type: "redeem",
				points: -500,
				description: "Redeemed Gold reward",
				createdAt: daysAgo(1, 12),
			},
			{
				id: LTXN(3),
				customerLoyaltyId: CLOY(7),
				type: "earn",
				points: 1120,
				description: "Purchase — catering order",
				createdAt: daysAgo(2, 11),
			},
			{
				id: LTXN(4),
				customerLoyaltyId: CLOY(7),
				type: "redeem",
				points: -1000,
				description: "Redeemed Gold reward",
				createdAt: daysAgo(2, 12),
			},
			{
				id: LTXN(5),
				customerLoyaltyId: CLOY(1),
				type: "earn",
				points: 475,
				description: "Accumulated purchases",
				createdAt: daysAgo(5, 14),
			},
			{
				id: LTXN(6),
				customerLoyaltyId: CLOY(5),
				type: "earn",
				points: 634,
				description: "Regular visits",
				createdAt: daysAgo(3, 13),
			},
			{
				id: LTXN(7),
				customerLoyaltyId: CLOY(5),
				type: "redeem",
				points: -200,
				description: "Redeemed Silver discount",
				createdAt: daysAgo(3, 14),
			},
			{
				id: LTXN(8),
				customerLoyaltyId: CLOY(9),
				type: "earn",
				points: 543,
				description: "Multiple visits",
				createdAt: daysAgo(4, 12),
			},
			{
				id: LTXN(9),
				customerLoyaltyId: CLOY(10),
				type: "earn",
				points: 718,
				description: "Large family order",
				createdAt: daysAgo(2, 13),
			},
			{
				id: LTXN(10),
				customerLoyaltyId: CLOY(10),
				type: "adjust",
				points: 100,
				description: "Birthday bonus points",
				createdAt: daysAgo(7, 9),
			},
			{
				id: LTXN(11),
				customerLoyaltyId: CLOY(2),
				type: "earn",
				points: 320,
				description: "Regular visits",
				createdAt: daysAgo(6, 11),
			},
			{
				id: LTXN(12),
				customerLoyaltyId: CLOY(4),
				type: "earn",
				points: 156,
				description: "First visits",
				createdAt: daysAgo(10, 12),
			},
			{
				id: LTXN(13),
				customerLoyaltyId: CLOY(6),
				type: "earn",
				points: 289,
				description: "Weekend visits",
				createdAt: daysAgo(4, 14),
			},
			{
				id: LTXN(14),
				customerLoyaltyId: CLOY(8),
				type: "earn",
				points: 98,
				description: "Lunch visits",
				createdAt: daysAgo(14, 12),
			},
			{
				id: LTXN(15),
				customerLoyaltyId: CLOY(3),
				type: "earn",
				points: 420,
				description: "Group order",
				createdAt: daysAgo(7, 12),
			},
		])
		.onConflictDoNothing();

	// 25. Gift Cards
	console.log("  -> Gift Cards");
	const GCARD = (n: number) =>
		`1e000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
	await db
		.insert(schema.giftCard)
		.values([
			{
				id: GCARD(1),
				organizationId: ORG_ID,
				code: "BETT-1001-XMAS",
				initialBalance: "5000",
				currentBalance: "3200",
				customerId: CUST(1),
				purchasedBy: "Priya Singh",
				isActive: true,
				createdAt: daysAgo(30, 10),
			},
			{
				id: GCARD(2),
				organizationId: ORG_ID,
				code: "BETT-1002-GIFT",
				initialBalance: "10000",
				currentBalance: "10000",
				customerId: CUST(5),
				purchasedBy: "Maria Rodrigues",
				isActive: true,
				createdAt: daysAgo(14, 11),
			},
			{
				id: GCARD(3),
				organizationId: ORG_ID,
				code: "BETT-1003-BDAY",
				initialBalance: "2500",
				currentBalance: "0",
				purchasedBy: "Rajesh Persaud",
				isActive: false,
				createdAt: daysAgo(60, 10),
			},
			{
				id: GCARD(4),
				organizationId: ORG_ID,
				code: "BETT-1004-CORP",
				initialBalance: "25000",
				currentBalance: "18500",
				purchasedBy: "Corporate - Khan Enterprises",
				isActive: true,
				createdAt: daysAgo(20, 9),
			},
			{
				id: GCARD(5),
				organizationId: ORG_ID,
				code: "BETT-1005-VDAY",
				initialBalance: "3000",
				currentBalance: "1500",
				customerId: CUST(9),
				purchasedBy: "Geeta Harripaul",
				isActive: true,
				createdAt: daysAgo(25, 12),
			},
			{
				id: GCARD(6),
				organizationId: ORG_ID,
				code: "BETT-1006-GRAD",
				initialBalance: "7500",
				currentBalance: "7500",
				isActive: true,
				createdAt: daysAgo(5, 14),
			},
			{
				id: GCARD(7),
				organizationId: ORG_ID,
				code: "BETT-1007-ANNV",
				initialBalance: "5000",
				currentBalance: "200",
				customerId: CUST(7),
				purchasedBy: "Sheila Bacchus",
				isActive: true,
				createdAt: daysAgo(45, 10),
			},
			{
				id: GCARD(8),
				organizationId: ORG_ID,
				code: "BETT-1008-HOLI",
				initialBalance: "1500",
				currentBalance: "0",
				isActive: false,
				createdAt: daysAgo(90, 11),
			},
			{
				id: GCARD(9),
				organizationId: ORG_ID,
				code: "BETT-1009-EMAS",
				initialBalance: "20000",
				currentBalance: "15000",
				isActive: true,
				createdAt: daysAgo(10, 8),
			},
			{
				id: GCARD(10),
				organizationId: ORG_ID,
				code: "BETT-1010-NEWYR",
				initialBalance: "3500",
				currentBalance: "3500",
				isActive: true,
				createdAt: daysAgo(3, 13),
			},
		])
		.onConflictDoNothing();

	// 26. Gift Card Transactions
	console.log("  -> Gift Card Transactions");
	const GCTXN = (n: number) =>
		`1f000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
	await db
		.insert(schema.giftCardTransaction)
		.values([
			{
				id: GCTXN(1),
				giftCardId: GCARD(1),
				type: "purchase",
				amount: "5000",
				balanceAfter: "5000",
				processedBy: USER.cashier,
				createdAt: daysAgo(30, 10),
			},
			{
				id: GCTXN(2),
				giftCardId: GCARD(1),
				type: "redeem",
				amount: "1200",
				balanceAfter: "3800",
				processedBy: USER.cashier,
				createdAt: daysAgo(20, 12),
			},
			{
				id: GCTXN(3),
				giftCardId: GCARD(1),
				type: "redeem",
				amount: "600",
				balanceAfter: "3200",
				processedBy: USER.cashier,
				createdAt: daysAgo(10, 13),
			},
			{
				id: GCTXN(4),
				giftCardId: GCARD(3),
				type: "purchase",
				amount: "2500",
				balanceAfter: "2500",
				processedBy: USER.cashier,
				createdAt: daysAgo(60, 10),
			},
			{
				id: GCTXN(5),
				giftCardId: GCARD(3),
				type: "redeem",
				amount: "1800",
				balanceAfter: "700",
				processedBy: USER.cashier,
				createdAt: daysAgo(45, 12),
			},
			{
				id: GCTXN(6),
				giftCardId: GCARD(3),
				type: "redeem",
				amount: "700",
				balanceAfter: "0",
				processedBy: USER.cashier,
				createdAt: daysAgo(30, 11),
			},
			{
				id: GCTXN(7),
				giftCardId: GCARD(4),
				type: "purchase",
				amount: "25000",
				balanceAfter: "25000",
				processedBy: USER.admin,
				createdAt: daysAgo(20, 9),
			},
			{
				id: GCTXN(8),
				giftCardId: GCARD(4),
				type: "redeem",
				amount: "4200",
				balanceAfter: "20800",
				processedBy: USER.cashier,
				createdAt: daysAgo(15, 12),
			},
			{
				id: GCTXN(9),
				giftCardId: GCARD(4),
				type: "redeem",
				amount: "2300",
				balanceAfter: "18500",
				processedBy: USER.cashier,
				createdAt: daysAgo(8, 13),
			},
			{
				id: GCTXN(10),
				giftCardId: GCARD(5),
				type: "purchase",
				amount: "3000",
				balanceAfter: "3000",
				processedBy: USER.cashier,
				createdAt: daysAgo(25, 12),
			},
			{
				id: GCTXN(11),
				giftCardId: GCARD(5),
				type: "redeem",
				amount: "1500",
				balanceAfter: "1500",
				processedBy: USER.cashier,
				createdAt: daysAgo(15, 13),
			},
			{
				id: GCTXN(12),
				giftCardId: GCARD(7),
				type: "purchase",
				amount: "5000",
				balanceAfter: "5000",
				processedBy: USER.cashier,
				createdAt: daysAgo(45, 10),
			},
			{
				id: GCTXN(13),
				giftCardId: GCARD(7),
				type: "redeem",
				amount: "4800",
				balanceAfter: "200",
				processedBy: USER.cashier,
				createdAt: daysAgo(30, 12),
			},
			{
				id: GCTXN(14),
				giftCardId: GCARD(8),
				type: "purchase",
				amount: "1500",
				balanceAfter: "1500",
				processedBy: USER.cashier,
				createdAt: daysAgo(90, 11),
			},
			{
				id: GCTXN(15),
				giftCardId: GCARD(8),
				type: "redeem",
				amount: "1500",
				balanceAfter: "0",
				processedBy: USER.cashier,
				createdAt: daysAgo(60, 14),
			},
		])
		.onConflictDoNothing();

	// 27. Expenses
	console.log("  -> Expenses");
	const EXPEN = (n: number) =>
		`da000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
	await db
		.insert(schema.expense)
		.values([
			{
				id: EXPEN(1),
				organizationId: ORG_ID,
				cashSessionId: CASH_SESSION.cs1,
				amount: "12500",
				category: "Food Cost",
				description: "Chicken delivery - weekly stock",
				supplierId: SUPPLIER.freshFoods,
				authorizedBy: USER.admin,
				createdBy: USER.cashier,
				createdAt: daysAgo(1, 9),
			},
			{
				id: EXPEN(2),
				organizationId: ORG_ID,
				cashSessionId: CASH_SESSION.cs1,
				amount: "4800",
				category: "Food Cost",
				description: "Snapper - fresh catch",
				supplierId: SUPPLIER.freshFoods,
				authorizedBy: USER.admin,
				createdBy: USER.cashier,
				createdAt: daysAgo(1, 10),
			},
			{
				id: EXPEN(3),
				organizationId: ORG_ID,
				cashSessionId: CASH_SESSION.cs2,
				amount: "7200",
				category: "Beverages",
				description: "Soft drinks restock - cases",
				supplierId: SUPPLIER.bevDist,
				authorizedBy: USER.admin,
				createdBy: USER.bonita,
				createdAt: daysAgo(2, 9),
			},
			{
				id: EXPEN(4),
				organizationId: ORG_ID,
				amount: "3500",
				category: "Supplies",
				description: "Takeaway containers - bulk order",
				authorizedBy: USER.admin,
				createdBy: USER.admin,
				createdAt: daysAgo(3, 11),
			},
			{
				id: EXPEN(5),
				organizationId: ORG_ID,
				amount: "1800",
				category: "Utilities",
				description: "LP gas cylinders x3",
				authorizedBy: USER.admin,
				createdBy: USER.admin,
				createdAt: daysAgo(3, 14),
			},
			{
				id: EXPEN(6),
				organizationId: ORG_ID,
				cashSessionId: CASH_SESSION.cs3,
				amount: "9600",
				category: "Food Cost",
				description: "Beef - bulk purchase",
				supplierId: SUPPLIER.freshFoods,
				authorizedBy: USER.admin,
				createdBy: USER.bonita,
				createdAt: daysAgo(5, 9),
			},
			{
				id: EXPEN(7),
				organizationId: ORG_ID,
				amount: "2200",
				category: "Maintenance",
				description: "Refrigerator compressor repair",
				authorizedBy: USER.admin,
				createdBy: USER.admin,
				createdAt: daysAgo(6, 10),
			},
			{
				id: EXPEN(8),
				organizationId: ORG_ID,
				cashSessionId: CASH_SESSION.cs3,
				amount: "5500",
				category: "Food Cost",
				description: "Rice, flour, cooking oil - weekly",
				supplierId: SUPPLIER.freshFoods,
				authorizedBy: USER.admin,
				createdBy: USER.cashier,
				createdAt: daysAgo(7, 9),
			},
			{
				id: EXPEN(9),
				organizationId: ORG_ID,
				amount: "1500",
				category: "Supplies",
				description: "Disposable gloves, cleaning supplies",
				authorizedBy: USER.admin,
				createdBy: USER.admin,
				createdAt: daysAgo(8, 14),
			},
			{
				id: EXPEN(10),
				organizationId: ORG_ID,
				amount: "4200",
				category: "Utilities",
				description: "Electricity bill - partial payment",
				authorizedBy: USER.admin,
				createdBy: USER.admin,
				createdAt: daysAgo(10, 11),
			},
			{
				id: EXPEN(11),
				organizationId: ORG_ID,
				cashSessionId: CASH_SESSION.cs4,
				amount: "6800",
				category: "Beverages",
				description: "Vita Malt, XL Energy - restocking",
				supplierId: SUPPLIER.bevDist,
				authorizedBy: USER.admin,
				createdBy: USER.bonita,
				createdAt: daysAgo(12, 9),
			},
			{
				id: EXPEN(12),
				organizationId: ORG_ID,
				amount: "3000",
				category: "Labor",
				description: "Weekend event overtime pay",
				authorizedBy: USER.admin,
				createdBy: USER.admin,
				createdAt: daysAgo(14, 16),
			},
			{
				id: EXPEN(13),
				organizationId: ORG_ID,
				amount: "950",
				category: "Maintenance",
				description: "POS receipt paper rolls x20",
				authorizedBy: USER.admin,
				createdBy: USER.cashier,
				createdAt: daysAgo(15, 10),
			},
			{
				id: EXPEN(14),
				organizationId: ORG_ID,
				cashSessionId: CASH_SESSION.cs4,
				amount: "8900",
				category: "Food Cost",
				description: "Bakery ingredients - flour, eggs, butter",
				supplierId: SUPPLIER.freshFoods,
				authorizedBy: USER.admin,
				createdBy: USER.bonita,
				createdAt: daysAgo(18, 9),
			},
			{
				id: EXPEN(15),
				organizationId: ORG_ID,
				amount: "2400",
				category: "Supplies",
				description: "Takeaway bags, napkins, straws",
				authorizedBy: USER.admin,
				createdBy: USER.admin,
				createdAt: daysAgo(20, 11),
			},
			{
				id: EXPEN(16),
				organizationId: ORG_ID,
				amount: "1200",
				category: "Maintenance",
				description: "Pest control - monthly service",
				authorizedBy: USER.admin,
				createdBy: USER.admin,
				createdAt: daysAgo(22, 9),
			},
			{
				id: EXPEN(17),
				organizationId: ORG_ID,
				cashSessionId: CASH_SESSION.cs2,
				amount: "11200",
				category: "Food Cost",
				description: "Weekly chicken + vegetables top-up",
				supplierId: SUPPLIER.freshFoods,
				authorizedBy: USER.admin,
				createdBy: USER.cashier,
				createdAt: daysAgo(25, 9),
			},
			{
				id: EXPEN(18),
				organizationId: ORG_ID,
				amount: "3600",
				category: "Utilities",
				description: "Water bill + generator fuel",
				authorizedBy: USER.admin,
				createdBy: USER.admin,
				createdAt: daysAgo(28, 14),
			},
			{
				id: EXPEN(19),
				organizationId: ORG_ID,
				amount: "2800",
				category: "Marketing",
				description: "Facebook ads - monthly campaign",
				authorizedBy: USER.admin,
				createdBy: USER.admin,
				createdAt: daysAgo(30, 10),
			},
			{
				id: EXPEN(20),
				organizationId: ORG_ID,
				amount: "5000",
				category: "Labor",
				description: "Staff uniform allowance",
				authorizedBy: USER.admin,
				createdBy: USER.admin,
				createdAt: daysAgo(35, 11),
			},
			// Vehicle Maintenance mock entries
			{
				id: EXPEN(21),
				organizationId: ORG_ID,
				amount: "8500",
				category: "Vehicle Maintenance",
				description: "Delivery van oil change & tire rotation",
				supplierId: SUPP(1014),
				paymentMethod: "cash",
				authorizedBy: USER.admin,
				createdBy: USER.admin,
				createdAt: daysAgo(4, 10),
			},
			{
				id: EXPEN(22),
				organizationId: ORG_ID,
				amount: "22000",
				category: "Vehicle Maintenance",
				description: "Van brake pad replacement + alignment",
				supplierId: SUPP(2000),
				paymentMethod: "card",
				referenceNumber: "EVS-2026-0412",
				authorizedBy: USER.admin,
				createdBy: USER.admin,
				createdAt: daysAgo(18, 14),
			},
			// CEO Drawings
			{
				id: EXPEN(23),
				organizationId: ORG_ID,
				amount: "150000",
				category: "CEO Drawings",
				description: "CEO monthly drawings — March 2026",
				paymentMethod: "bank_transfer",
				referenceNumber: "DRAW-CEO-2026-03",
				authorizedBy: USER.admin,
				createdBy: USER.admin,
				createdAt: daysAgo(5, 9),
			},
			// GM Drawings
			{
				id: EXPEN(24),
				organizationId: ORG_ID,
				amount: "80000",
				category: "GM Drawings",
				description: "GM monthly drawings — March 2026",
				paymentMethod: "bank_transfer",
				referenceNumber: "DRAW-GM-2026-03",
				authorizedBy: USER.admin,
				createdBy: USER.admin,
				createdAt: daysAgo(5, 10),
			},
			// Owner Drawings
			{
				id: EXPEN(25),
				organizationId: ORG_ID,
				amount: "200000",
				category: "Owner Drawings",
				description: "Owner personal drawings — March 2026",
				paymentMethod: "bank_transfer",
				referenceNumber: "DRAW-OWN-2026-03",
				authorizedBy: USER.admin,
				createdBy: USER.admin,
				createdAt: daysAgo(5, 11),
			},
			// COO Drawings
			{
				id: EXPEN(26),
				organizationId: ORG_ID,
				amount: "75000",
				category: "COO Drawings",
				description: "COO monthly drawings — March 2026",
				paymentMethod: "bank_transfer",
				referenceNumber: "DRAW-COO-2026-03",
				authorizedBy: USER.admin,
				createdBy: USER.admin,
				createdAt: daysAgo(5, 12),
			},
		])
		.onConflictDoNothing();

	// Historical expense data — 11 months (Jan 2026 → Mar 2025)
	// RSUPP: real vendor helper — IDs are seeded as 1000+n (e.g. RSUPP(1) → cc…000000001001)
	const RSUPP = (n: number) =>
		`cc000000-0000-4000-8000-${String(1000 + n).padStart(12, "0")}`;
	console.log("  -> Historical Expenses (12mo)");
	await db
		.insert(schema.expense)
		.values([
			// ── Jan 2026 ─────────────────────────────────────────────
			{
				id: EXPEN(27),
				organizationId: ORG_ID,
				amount: "18500",
				category: "Food Cost",
				description: "Chicken & pork delivery — Jan wk1",
				supplierId: SUPPLIER.freshFoods,
				paymentMethod: "cash",
				authorizedBy: USER.admin,
				createdBy: USER.bonita,
				createdAt: daysAgo(53, 9),
			},
			{
				id: EXPEN(28),
				organizationId: ORG_ID,
				amount: "9200",
				category: "Food Cost",
				description: "Snapper, shrimp, crab — fresh catch Jan",
				supplierId: RSUPP(1),
				paymentMethod: "cash",
				authorizedBy: USER.admin,
				createdBy: USER.cashier,
				createdAt: daysAgo(49, 10),
			},
			{
				id: EXPEN(29),
				organizationId: ORG_ID,
				amount: "8800",
				category: "Beverages",
				description: "Soft drinks, juices, water — Jan restock",
				supplierId: SUPPLIER.bevDist,
				paymentMethod: "card",
				authorizedBy: USER.admin,
				createdBy: USER.bonita,
				createdAt: daysAgo(51, 9),
			},
			{
				id: EXPEN(30),
				organizationId: ORG_ID,
				amount: "5200",
				category: "Utilities",
				description: "GPL electricity — January bill",
				paymentMethod: "bank_transfer",
				referenceNumber: "GPL-2026-01",
				authorizedBy: USER.admin,
				createdBy: USER.admin,
				createdAt: daysAgo(45, 11),
			},
			{
				id: EXPEN(31),
				organizationId: ORG_ID,
				amount: "2800",
				category: "Supplies",
				description: "Takeaway containers, napkins, straws — Jan",
				paymentMethod: "cash",
				authorizedBy: USER.admin,
				createdBy: USER.admin,
				createdAt: daysAgo(47, 14),
			},
			{
				id: EXPEN(32),
				organizationId: ORG_ID,
				amount: "6500",
				category: "Labor",
				description: "New Year overtime pay — staff bonuses Jan",
				paymentMethod: "cash",
				authorizedBy: USER.admin,
				createdBy: USER.admin,
				createdAt: daysAgo(62, 16),
			},
			{
				id: EXPEN(33),
				organizationId: ORG_ID,
				amount: "150000",
				category: "CEO Drawings",
				description: "CEO monthly drawings — January 2026",
				paymentMethod: "bank_transfer",
				referenceNumber: "DRAW-CEO-2026-01",
				authorizedBy: USER.admin,
				createdBy: USER.admin,
				createdAt: daysAgo(55, 9),
			},
			{
				id: EXPEN(34),
				organizationId: ORG_ID,
				amount: "200000",
				category: "Owner Drawings",
				description: "Owner personal drawings — January 2026",
				paymentMethod: "bank_transfer",
				referenceNumber: "DRAW-OWN-2026-01",
				authorizedBy: USER.admin,
				createdBy: USER.admin,
				createdAt: daysAgo(55, 10),
			},
			// ── Dec 2025 ─────────────────────────────────────────────
			{
				id: EXPEN(35),
				organizationId: ORG_ID,
				amount: "22000",
				category: "Food Cost",
				description: "Christmas stock — chicken, beef, pork",
				supplierId: SUPPLIER.freshFoods,
				paymentMethod: "card",
				authorizedBy: USER.admin,
				createdBy: USER.bonita,
				createdAt: daysAgo(83, 9),
			},
			{
				id: EXPEN(36),
				organizationId: ORG_ID,
				amount: "11500",
				category: "Food Cost",
				description: "Seafood platter ingredients — Dec season",
				supplierId: RSUPP(1),
				paymentMethod: "cash",
				authorizedBy: USER.admin,
				createdBy: USER.cashier,
				createdAt: daysAgo(78, 10),
			},
			{
				id: EXPEN(37),
				organizationId: ORG_ID,
				amount: "12000",
				category: "Beverages",
				description: "Festive drinks — sorrel, ginger beer, imported",
				supplierId: SUPPLIER.bevDist,
				paymentMethod: "card",
				authorizedBy: USER.admin,
				createdBy: USER.bonita,
				createdAt: daysAgo(80, 9),
			},
			{
				id: EXPEN(38),
				organizationId: ORG_ID,
				amount: "5800",
				category: "Utilities",
				description: "GPL electricity — December (higher AC usage)",
				paymentMethod: "bank_transfer",
				referenceNumber: "GPL-2025-12",
				authorizedBy: USER.admin,
				createdBy: USER.admin,
				createdAt: daysAgo(75, 11),
			},
			{
				id: EXPEN(39),
				organizationId: ORG_ID,
				amount: "4200",
				category: "Supplies",
				description: "Gift packaging, festive disposables — Dec",
				paymentMethod: "cash",
				authorizedBy: USER.admin,
				createdBy: USER.admin,
				createdAt: daysAgo(77, 14),
			},
			{
				id: EXPEN(40),
				organizationId: ORG_ID,
				amount: "18000",
				category: "Marketing",
				description: "Christmas promotions — banners, social media, flyers",
				paymentMethod: "card",
				referenceNumber: "MKT-DEC-2025",
				authorizedBy: USER.admin,
				createdBy: USER.admin,
				createdAt: daysAgo(90, 10),
			},
			{
				id: EXPEN(41),
				organizationId: ORG_ID,
				amount: "150000",
				category: "CEO Drawings",
				description: "CEO monthly drawings — December 2025",
				paymentMethod: "bank_transfer",
				referenceNumber: "DRAW-CEO-2025-12",
				authorizedBy: USER.admin,
				createdBy: USER.admin,
				createdAt: daysAgo(85, 9),
			},
			{
				id: EXPEN(42),
				organizationId: ORG_ID,
				amount: "200000",
				category: "Owner Drawings",
				description: "Owner personal drawings — December 2025",
				paymentMethod: "bank_transfer",
				referenceNumber: "DRAW-OWN-2025-12",
				authorizedBy: USER.admin,
				createdBy: USER.admin,
				createdAt: daysAgo(85, 10),
			},
			// ── Nov 2025 ─────────────────────────────────────────────
			{
				id: EXPEN(43),
				organizationId: ORG_ID,
				amount: "16800",
				category: "Food Cost",
				description: "Weekly chicken & beef top-up — Nov",
				supplierId: SUPPLIER.freshFoods,
				paymentMethod: "cash",
				authorizedBy: USER.admin,
				createdBy: USER.bonita,
				createdAt: daysAgo(113, 9),
			},
			{
				id: EXPEN(44),
				organizationId: ORG_ID,
				amount: "8600",
				category: "Food Cost",
				description: "Fresh snapper & vegetables — Nov market",
				supplierId: RSUPP(2),
				paymentMethod: "cash",
				authorizedBy: USER.admin,
				createdBy: USER.cashier,
				createdAt: daysAgo(108, 10),
			},
			{
				id: EXPEN(45),
				organizationId: ORG_ID,
				amount: "9400",
				category: "Beverages",
				description: "Vita Malt, XL Energy, soft drinks — Nov",
				supplierId: SUPPLIER.bevDist,
				paymentMethod: "card",
				authorizedBy: USER.admin,
				createdBy: USER.bonita,
				createdAt: daysAgo(110, 9),
			},
			{
				id: EXPEN(46),
				organizationId: ORG_ID,
				amount: "4600",
				category: "Utilities",
				description: "GPL electricity + water bill — November",
				paymentMethod: "bank_transfer",
				referenceNumber: "GPL-2025-11",
				authorizedBy: USER.admin,
				createdBy: USER.admin,
				createdAt: daysAgo(104, 11),
			},
			{
				id: EXPEN(47),
				organizationId: ORG_ID,
				amount: "2500",
				category: "Supplies",
				description: "Cleaning supplies + cooking consumables — Nov",
				paymentMethod: "cash",
				authorizedBy: USER.admin,
				createdBy: USER.admin,
				createdAt: daysAgo(106, 14),
			},
			{
				id: EXPEN(48),
				organizationId: ORG_ID,
				amount: "14000",
				category: "Maintenance",
				description: "Commercial refrigerator full service + new gaskets",
				supplierId: RSUPP(36),
				paymentMethod: "card",
				referenceNumber: "MAINT-NOV-2025",
				authorizedBy: USER.admin,
				createdBy: USER.admin,
				createdAt: daysAgo(120, 10),
			},
			{
				id: EXPEN(49),
				organizationId: ORG_ID,
				amount: "150000",
				category: "CEO Drawings",
				description: "CEO monthly drawings — November 2025",
				paymentMethod: "bank_transfer",
				referenceNumber: "DRAW-CEO-2025-11",
				authorizedBy: USER.admin,
				createdBy: USER.admin,
				createdAt: daysAgo(115, 9),
			},
			{
				id: EXPEN(50),
				organizationId: ORG_ID,
				amount: "200000",
				category: "Owner Drawings",
				description: "Owner personal drawings — November 2025",
				paymentMethod: "bank_transfer",
				referenceNumber: "DRAW-OWN-2025-11",
				authorizedBy: USER.admin,
				createdBy: USER.admin,
				createdAt: daysAgo(115, 10),
			},
			// ── Oct 2025 ─────────────────────────────────────────────
			{
				id: EXPEN(51),
				organizationId: ORG_ID,
				amount: "17200",
				category: "Food Cost",
				description: "Monthly chicken delivery — bulk order Oct",
				supplierId: SUPPLIER.freshFoods,
				paymentMethod: "cash",
				authorizedBy: USER.admin,
				createdBy: USER.bonita,
				createdAt: daysAgo(143, 9),
			},
			{
				id: EXPEN(52),
				organizationId: ORG_ID,
				amount: "7800",
				category: "Food Cost",
				description: "Pork & duck for October specials",
				supplierId: RSUPP(5),
				paymentMethod: "cash",
				authorizedBy: USER.admin,
				createdBy: USER.cashier,
				createdAt: daysAgo(138, 10),
			},
			{
				id: EXPEN(53),
				organizationId: ORG_ID,
				amount: "8200",
				category: "Beverages",
				description: "Beverage distributor — Oct weekly stock",
				supplierId: SUPPLIER.bevDist,
				paymentMethod: "card",
				authorizedBy: USER.admin,
				createdBy: USER.bonita,
				createdAt: daysAgo(140, 9),
			},
			{
				id: EXPEN(54),
				organizationId: ORG_ID,
				amount: "5400",
				category: "Utilities",
				description: "GPL electricity — October (AC season)",
				paymentMethod: "bank_transfer",
				referenceNumber: "GPL-2025-10",
				authorizedBy: USER.admin,
				createdBy: USER.admin,
				createdAt: daysAgo(135, 11),
			},
			{
				id: EXPEN(55),
				organizationId: ORG_ID,
				amount: "3100",
				category: "Supplies",
				description: "Paper towels, soap, disposable containers — Oct",
				paymentMethod: "cash",
				authorizedBy: USER.admin,
				createdBy: USER.admin,
				createdAt: daysAgo(137, 14),
			},
			{
				id: EXPEN(56),
				organizationId: ORG_ID,
				amount: "8500",
				category: "Vehicle Maintenance",
				description: "Delivery van 6-month service + tire replacement",
				supplierId: RSUPP(14),
				paymentMethod: "card",
				referenceNumber: "VEH-OCT-2025",
				authorizedBy: USER.admin,
				createdBy: USER.admin,
				createdAt: daysAgo(150, 10),
			},
			{
				id: EXPEN(57),
				organizationId: ORG_ID,
				amount: "150000",
				category: "CEO Drawings",
				description: "CEO monthly drawings — October 2025",
				paymentMethod: "bank_transfer",
				referenceNumber: "DRAW-CEO-2025-10",
				authorizedBy: USER.admin,
				createdBy: USER.admin,
				createdAt: daysAgo(145, 9),
			},
			{
				id: EXPEN(58),
				organizationId: ORG_ID,
				amount: "200000",
				category: "Owner Drawings",
				description: "Owner personal drawings — October 2025",
				paymentMethod: "bank_transfer",
				referenceNumber: "DRAW-OWN-2025-10",
				authorizedBy: USER.admin,
				createdBy: USER.admin,
				createdAt: daysAgo(145, 10),
			},
			// ── Sep 2025 ─────────────────────────────────────────────
			{
				id: EXPEN(59),
				organizationId: ORG_ID,
				amount: "15600",
				category: "Food Cost",
				description: "Chicken, beef, rice — September delivery",
				supplierId: SUPPLIER.freshFoods,
				paymentMethod: "cash",
				authorizedBy: USER.admin,
				createdBy: USER.bonita,
				createdAt: daysAgo(173, 9),
			},
			{
				id: EXPEN(60),
				organizationId: ORG_ID,
				amount: "9000",
				category: "Food Cost",
				description: "Fresh snapper + coconuts — Sep market run",
				supplierId: RSUPP(3),
				paymentMethod: "cash",
				authorizedBy: USER.admin,
				createdBy: USER.cashier,
				createdAt: daysAgo(168, 10),
			},
			{
				id: EXPEN(61),
				organizationId: ORG_ID,
				amount: "7600",
				category: "Beverages",
				description: "Juices, water, soft drinks — Sep stock",
				supplierId: SUPPLIER.bevDist,
				paymentMethod: "card",
				authorizedBy: USER.admin,
				createdBy: USER.bonita,
				createdAt: daysAgo(170, 9),
			},
			{
				id: EXPEN(62),
				organizationId: ORG_ID,
				amount: "6200",
				category: "Utilities",
				description: "GPL electricity — September (peak heat)",
				paymentMethod: "bank_transfer",
				referenceNumber: "GPL-2025-09",
				authorizedBy: USER.admin,
				createdBy: USER.admin,
				createdAt: daysAgo(165, 11),
			},
			{
				id: EXPEN(63),
				organizationId: ORG_ID,
				amount: "2900",
				category: "Supplies",
				description: "Kitchen consumables + gloves + aprons — Sep",
				paymentMethod: "cash",
				authorizedBy: USER.admin,
				createdBy: USER.admin,
				createdAt: daysAgo(167, 14),
			},
			{
				id: EXPEN(64),
				organizationId: ORG_ID,
				amount: "4800",
				category: "Marketing",
				description: "Independence Day weekend promo — social ads + banners",
				paymentMethod: "card",
				referenceNumber: "MKT-SEP-2025",
				authorizedBy: USER.admin,
				createdBy: USER.admin,
				createdAt: daysAgo(180, 10),
			},
			{
				id: EXPEN(65),
				organizationId: ORG_ID,
				amount: "150000",
				category: "CEO Drawings",
				description: "CEO monthly drawings — September 2025",
				paymentMethod: "bank_transfer",
				referenceNumber: "DRAW-CEO-2025-09",
				authorizedBy: USER.admin,
				createdBy: USER.admin,
				createdAt: daysAgo(175, 9),
			},
			{
				id: EXPEN(66),
				organizationId: ORG_ID,
				amount: "200000",
				category: "Owner Drawings",
				description: "Owner personal drawings — September 2025",
				paymentMethod: "bank_transfer",
				referenceNumber: "DRAW-OWN-2025-09",
				authorizedBy: USER.admin,
				createdBy: USER.admin,
				createdAt: daysAgo(175, 10),
			},
			// ── Aug 2025 ─────────────────────────────────────────────
			{
				id: EXPEN(67),
				organizationId: ORG_ID,
				amount: "19200",
				category: "Food Cost",
				description: "Monthly bulk delivery — chicken, pork, beef Aug",
				supplierId: SUPPLIER.freshFoods,
				paymentMethod: "cash",
				authorizedBy: USER.admin,
				createdBy: USER.bonita,
				createdAt: daysAgo(203, 9),
			},
			{
				id: EXPEN(68),
				organizationId: ORG_ID,
				amount: "10500",
				category: "Food Cost",
				description: "Seafood + produce top-up — August",
				supplierId: RSUPP(4),
				paymentMethod: "cash",
				authorizedBy: USER.admin,
				createdBy: USER.cashier,
				createdAt: daysAgo(198, 10),
			},
			{
				id: EXPEN(69),
				organizationId: ORG_ID,
				amount: "9800",
				category: "Beverages",
				description: "Cases of soft drinks, water, juices — Aug",
				supplierId: SUPPLIER.bevDist,
				paymentMethod: "card",
				authorizedBy: USER.admin,
				createdBy: USER.bonita,
				createdAt: daysAgo(200, 9),
			},
			{
				id: EXPEN(70),
				organizationId: ORG_ID,
				amount: "6800",
				category: "Utilities",
				description: "GPL electricity — August (highest heat month)",
				paymentMethod: "bank_transfer",
				referenceNumber: "GPL-2025-08",
				authorizedBy: USER.admin,
				createdBy: USER.admin,
				createdAt: daysAgo(195, 11),
			},
			{
				id: EXPEN(71),
				organizationId: ORG_ID,
				amount: "3400",
				category: "Supplies",
				description: "Takeaway packaging, straws — Aug bulk buy",
				paymentMethod: "cash",
				authorizedBy: USER.admin,
				createdBy: USER.admin,
				createdAt: daysAgo(197, 14),
			},
			{
				id: EXPEN(72),
				organizationId: ORG_ID,
				amount: "12000",
				category: "Maintenance",
				description: "AC unit full service + filter replacement x4",
				supplierId: RSUPP(36),
				paymentMethod: "cash",
				referenceNumber: "MAINT-AUG-2025",
				authorizedBy: USER.admin,
				createdBy: USER.admin,
				createdAt: daysAgo(210, 10),
			},
			{
				id: EXPEN(73),
				organizationId: ORG_ID,
				amount: "150000",
				category: "CEO Drawings",
				description: "CEO monthly drawings — August 2025",
				paymentMethod: "bank_transfer",
				referenceNumber: "DRAW-CEO-2025-08",
				authorizedBy: USER.admin,
				createdBy: USER.admin,
				createdAt: daysAgo(205, 9),
			},
			{
				id: EXPEN(74),
				organizationId: ORG_ID,
				amount: "200000",
				category: "Owner Drawings",
				description: "Owner personal drawings — August 2025",
				paymentMethod: "bank_transfer",
				referenceNumber: "DRAW-OWN-2025-08",
				authorizedBy: USER.admin,
				createdBy: USER.admin,
				createdAt: daysAgo(205, 10),
			},
			// ── Jul 2025 ─────────────────────────────────────────────
			{
				id: EXPEN(75),
				organizationId: ORG_ID,
				amount: "16000",
				category: "Food Cost",
				description: "Weekly chicken & rice — July delivery",
				supplierId: SUPPLIER.freshFoods,
				paymentMethod: "cash",
				authorizedBy: USER.admin,
				createdBy: USER.bonita,
				createdAt: daysAgo(234, 9),
			},
			{
				id: EXPEN(76),
				organizationId: ORG_ID,
				amount: "8400",
				category: "Food Cost",
				description: "Snapper + bora + pumpkin — July produce",
				supplierId: RSUPP(6),
				paymentMethod: "cash",
				authorizedBy: USER.admin,
				createdBy: USER.cashier,
				createdAt: daysAgo(229, 10),
			},
			{
				id: EXPEN(77),
				organizationId: ORG_ID,
				amount: "8600",
				category: "Beverages",
				description: "Rum cream, juices, soft drinks — Jul",
				supplierId: SUPPLIER.bevDist,
				paymentMethod: "card",
				authorizedBy: USER.admin,
				createdBy: USER.bonita,
				createdAt: daysAgo(231, 9),
			},
			{
				id: EXPEN(78),
				organizationId: ORG_ID,
				amount: "5000",
				category: "Utilities",
				description: "GPL electricity + generator fuel — July",
				paymentMethod: "bank_transfer",
				referenceNumber: "GPL-2025-07",
				authorizedBy: USER.admin,
				createdBy: USER.admin,
				createdAt: daysAgo(226, 11),
			},
			{
				id: EXPEN(79),
				organizationId: ORG_ID,
				amount: "2600",
				category: "Supplies",
				description: "Paper goods, disposables — July",
				paymentMethod: "cash",
				authorizedBy: USER.admin,
				createdBy: USER.admin,
				createdAt: daysAgo(228, 14),
			},
			{
				id: EXPEN(80),
				organizationId: ORG_ID,
				amount: "8000",
				category: "Labor",
				description: "Caricom Day overtime + Mashramani staff bonuses",
				paymentMethod: "cash",
				authorizedBy: USER.admin,
				createdBy: USER.admin,
				createdAt: daysAgo(240, 16),
			},
			{
				id: EXPEN(81),
				organizationId: ORG_ID,
				amount: "150000",
				category: "CEO Drawings",
				description: "CEO monthly drawings — July 2025",
				paymentMethod: "bank_transfer",
				referenceNumber: "DRAW-CEO-2025-07",
				authorizedBy: USER.admin,
				createdBy: USER.admin,
				createdAt: daysAgo(236, 9),
			},
			{
				id: EXPEN(82),
				organizationId: ORG_ID,
				amount: "200000",
				category: "Owner Drawings",
				description: "Owner personal drawings — July 2025",
				paymentMethod: "bank_transfer",
				referenceNumber: "DRAW-OWN-2025-07",
				authorizedBy: USER.admin,
				createdBy: USER.admin,
				createdAt: daysAgo(236, 10),
			},
			// ── Jun 2025 ─────────────────────────────────────────────
			{
				id: EXPEN(83),
				organizationId: ORG_ID,
				amount: "17500",
				category: "Food Cost",
				description: "Monthly chicken + beef stock — June",
				supplierId: SUPPLIER.freshFoods,
				paymentMethod: "cash",
				authorizedBy: USER.admin,
				createdBy: USER.bonita,
				createdAt: daysAgo(264, 9),
			},
			{
				id: EXPEN(84),
				organizationId: ORG_ID,
				amount: "7900",
				category: "Food Cost",
				description: "Fresh fish + vegetables — June market",
				supplierId: RSUPP(7),
				paymentMethod: "cash",
				authorizedBy: USER.admin,
				createdBy: USER.cashier,
				createdAt: daysAgo(259, 10),
			},
			{
				id: EXPEN(85),
				organizationId: ORG_ID,
				amount: "7200",
				category: "Beverages",
				description: "Soft drinks + water deliveries — June",
				supplierId: SUPPLIER.bevDist,
				paymentMethod: "card",
				authorizedBy: USER.admin,
				createdBy: USER.bonita,
				createdAt: daysAgo(261, 9),
			},
			{
				id: EXPEN(86),
				organizationId: ORG_ID,
				amount: "4800",
				category: "Utilities",
				description: "GPL electricity — June bill",
				paymentMethod: "bank_transfer",
				referenceNumber: "GPL-2025-06",
				authorizedBy: USER.admin,
				createdBy: USER.admin,
				createdAt: daysAgo(256, 11),
			},
			{
				id: EXPEN(87),
				organizationId: ORG_ID,
				amount: "3000",
				category: "Supplies",
				description: "Takeaway containers + kitchen consumables — Jun",
				paymentMethod: "cash",
				authorizedBy: USER.admin,
				createdBy: USER.admin,
				createdAt: daysAgo(258, 14),
			},
			{
				id: EXPEN(88),
				organizationId: ORG_ID,
				amount: "3200",
				category: "Marketing",
				description: "Mid-year promo — online ads + printed menus refresh",
				paymentMethod: "card",
				referenceNumber: "MKT-JUN-2025",
				authorizedBy: USER.admin,
				createdBy: USER.admin,
				createdAt: daysAgo(270, 10),
			},
			{
				id: EXPEN(89),
				organizationId: ORG_ID,
				amount: "150000",
				category: "CEO Drawings",
				description: "CEO monthly drawings — June 2025",
				paymentMethod: "bank_transfer",
				referenceNumber: "DRAW-CEO-2025-06",
				authorizedBy: USER.admin,
				createdBy: USER.admin,
				createdAt: daysAgo(266, 9),
			},
			{
				id: EXPEN(90),
				organizationId: ORG_ID,
				amount: "200000",
				category: "Owner Drawings",
				description: "Owner personal drawings — June 2025",
				paymentMethod: "bank_transfer",
				referenceNumber: "DRAW-OWN-2025-06",
				authorizedBy: USER.admin,
				createdBy: USER.admin,
				createdAt: daysAgo(266, 10),
			},
			// ── May 2025 ─────────────────────────────────────────────
			{
				id: EXPEN(91),
				organizationId: ORG_ID,
				amount: "14800",
				category: "Food Cost",
				description: "Chicken, beef, rice — May monthly stock",
				supplierId: SUPPLIER.freshFoods,
				paymentMethod: "cash",
				authorizedBy: USER.admin,
				createdBy: USER.bonita,
				createdAt: daysAgo(295, 9),
			},
			{
				id: EXPEN(92),
				organizationId: ORG_ID,
				amount: "8200",
				category: "Food Cost",
				description: "Snapper + fresh produce — May harvest",
				supplierId: RSUPP(8),
				paymentMethod: "cash",
				authorizedBy: USER.admin,
				createdBy: USER.cashier,
				createdAt: daysAgo(290, 10),
			},
			{
				id: EXPEN(93),
				organizationId: ORG_ID,
				amount: "6800",
				category: "Beverages",
				description: "Beverages + Kool-Aid stock — May",
				supplierId: SUPPLIER.bevDist,
				paymentMethod: "card",
				authorizedBy: USER.admin,
				createdBy: USER.bonita,
				createdAt: daysAgo(292, 9),
			},
			{
				id: EXPEN(94),
				organizationId: ORG_ID,
				amount: "4200",
				category: "Utilities",
				description: "GPL electricity — May bill",
				paymentMethod: "bank_transfer",
				referenceNumber: "GPL-2025-05",
				authorizedBy: USER.admin,
				createdBy: USER.admin,
				createdAt: daysAgo(287, 11),
			},
			{
				id: EXPEN(95),
				organizationId: ORG_ID,
				amount: "2200",
				category: "Supplies",
				description: "Kitchen gloves, paper goods, soap — May",
				paymentMethod: "cash",
				authorizedBy: USER.admin,
				createdBy: USER.admin,
				createdAt: daysAgo(289, 14),
			},
			{
				id: EXPEN(96),
				organizationId: ORG_ID,
				amount: "18000",
				category: "Maintenance",
				description: "Walk-in freezer emergency repair + new compressor",
				supplierId: RSUPP(36),
				paymentMethod: "card",
				referenceNumber: "MAINT-MAY-2025",
				authorizedBy: USER.admin,
				createdBy: USER.admin,
				createdAt: daysAgo(305, 10),
			},
			{
				id: EXPEN(97),
				organizationId: ORG_ID,
				amount: "150000",
				category: "CEO Drawings",
				description: "CEO monthly drawings — May 2025",
				paymentMethod: "bank_transfer",
				referenceNumber: "DRAW-CEO-2025-05",
				authorizedBy: USER.admin,
				createdBy: USER.admin,
				createdAt: daysAgo(297, 9),
			},
			{
				id: EXPEN(98),
				organizationId: ORG_ID,
				amount: "200000",
				category: "Owner Drawings",
				description: "Owner personal drawings — May 2025",
				paymentMethod: "bank_transfer",
				referenceNumber: "DRAW-OWN-2025-05",
				authorizedBy: USER.admin,
				createdBy: USER.admin,
				createdAt: daysAgo(297, 10),
			},
			// ── Apr 2025 ─────────────────────────────────────────────
			{
				id: EXPEN(99),
				organizationId: ORG_ID,
				amount: "15400",
				category: "Food Cost",
				description: "April chicken & pork delivery — weekly",
				supplierId: SUPPLIER.freshFoods,
				paymentMethod: "cash",
				authorizedBy: USER.admin,
				createdBy: USER.bonita,
				createdAt: daysAgo(325, 9),
			},
			{
				id: EXPEN(100),
				organizationId: ORG_ID,
				amount: "7200",
				category: "Food Cost",
				description: "Seasonal seafood + vegetables — April",
				supplierId: RSUPP(9),
				paymentMethod: "cash",
				authorizedBy: USER.admin,
				createdBy: USER.cashier,
				createdAt: daysAgo(320, 10),
			},
			{
				id: EXPEN(101),
				organizationId: ORG_ID,
				amount: "7800",
				category: "Beverages",
				description: "Beverages restock — Easter weekend Apr",
				supplierId: SUPPLIER.bevDist,
				paymentMethod: "card",
				authorizedBy: USER.admin,
				createdBy: USER.bonita,
				createdAt: daysAgo(322, 9),
			},
			{
				id: EXPEN(102),
				organizationId: ORG_ID,
				amount: "4400",
				category: "Utilities",
				description: "GPL electricity — April bill",
				paymentMethod: "bank_transfer",
				referenceNumber: "GPL-2025-04",
				authorizedBy: USER.admin,
				createdBy: USER.admin,
				createdAt: daysAgo(317, 11),
			},
			{
				id: EXPEN(103),
				organizationId: ORG_ID,
				amount: "2700",
				category: "Supplies",
				description: "Takeaway packaging + cleaning supplies — Apr",
				paymentMethod: "cash",
				authorizedBy: USER.admin,
				createdBy: USER.admin,
				createdAt: daysAgo(319, 14),
			},
			{
				id: EXPEN(104),
				organizationId: ORG_ID,
				amount: "5000",
				category: "Labor",
				description: "Easter weekend overtime — all staff double pay",
				paymentMethod: "cash",
				authorizedBy: USER.admin,
				createdBy: USER.admin,
				createdAt: daysAgo(330, 16),
			},
			{
				id: EXPEN(105),
				organizationId: ORG_ID,
				amount: "150000",
				category: "CEO Drawings",
				description: "CEO monthly drawings — April 2025",
				paymentMethod: "bank_transfer",
				referenceNumber: "DRAW-CEO-2025-04",
				authorizedBy: USER.admin,
				createdBy: USER.admin,
				createdAt: daysAgo(327, 9),
			},
			{
				id: EXPEN(106),
				organizationId: ORG_ID,
				amount: "200000",
				category: "Owner Drawings",
				description: "Owner personal drawings — April 2025",
				paymentMethod: "bank_transfer",
				referenceNumber: "DRAW-OWN-2025-04",
				authorizedBy: USER.admin,
				createdBy: USER.admin,
				createdAt: daysAgo(327, 10),
			},
			// ── Mar 2025 ─────────────────────────────────────────────
			{
				id: EXPEN(107),
				organizationId: ORG_ID,
				amount: "16200",
				category: "Food Cost",
				description: "March chicken & beef stock — opening month delivery",
				supplierId: SUPPLIER.freshFoods,
				paymentMethod: "cash",
				authorizedBy: USER.admin,
				createdBy: USER.bonita,
				createdAt: daysAgo(356, 9),
			},
			{
				id: EXPEN(108),
				organizationId: ORG_ID,
				amount: "8800",
				category: "Food Cost",
				description: "Fresh produce + seafood — March market",
				supplierId: RSUPP(10),
				paymentMethod: "cash",
				authorizedBy: USER.admin,
				createdBy: USER.cashier,
				createdAt: daysAgo(351, 10),
			},
			{
				id: EXPEN(109),
				organizationId: ORG_ID,
				amount: "8000",
				category: "Beverages",
				description: "Opening stock — beverages full inventory Mar",
				supplierId: SUPPLIER.bevDist,
				paymentMethod: "card",
				authorizedBy: USER.admin,
				createdBy: USER.bonita,
				createdAt: daysAgo(353, 9),
			},
			{
				id: EXPEN(110),
				organizationId: ORG_ID,
				amount: "4000",
				category: "Utilities",
				description: "GPL electricity — March bill",
				paymentMethod: "bank_transfer",
				referenceNumber: "GPL-2025-03",
				authorizedBy: USER.admin,
				createdBy: USER.admin,
				createdAt: daysAgo(348, 11),
			},
			{
				id: EXPEN(111),
				organizationId: ORG_ID,
				amount: "3500",
				category: "Supplies",
				description: "Initial consumables stock — kitchen + front-of-house",
				paymentMethod: "cash",
				authorizedBy: USER.admin,
				createdBy: USER.admin,
				createdAt: daysAgo(350, 14),
			},
			{
				id: EXPEN(112),
				organizationId: ORG_ID,
				amount: "22000",
				category: "Vehicle Maintenance",
				description: "Delivery van purchase accessories + registration",
				supplierId: RSUPP(14),
				paymentMethod: "bank_transfer",
				referenceNumber: "VEH-MAR-2025",
				authorizedBy: USER.admin,
				createdBy: USER.admin,
				createdAt: daysAgo(360, 10),
			},
			{
				id: EXPEN(113),
				organizationId: ORG_ID,
				amount: "150000",
				category: "CEO Drawings",
				description: "CEO monthly drawings — March 2025",
				paymentMethod: "bank_transfer",
				referenceNumber: "DRAW-CEO-2025-03",
				authorizedBy: USER.admin,
				createdBy: USER.admin,
				createdAt: daysAgo(358, 9),
			},
			{
				id: EXPEN(114),
				organizationId: ORG_ID,
				amount: "200000",
				category: "Owner Drawings",
				description: "Owner personal drawings — March 2025",
				paymentMethod: "bank_transfer",
				referenceNumber: "DRAW-OWN-2025-03",
				authorizedBy: USER.admin,
				createdBy: USER.admin,
				createdAt: daysAgo(358, 10),
			},
			// ── Feb 2026 (supplement — drawings) ─────────────────────
			{
				id: EXPEN(115),
				organizationId: ORG_ID,
				amount: "150000",
				category: "CEO Drawings",
				description: "CEO monthly drawings — February 2026",
				paymentMethod: "bank_transfer",
				referenceNumber: "DRAW-CEO-2026-02",
				authorizedBy: USER.admin,
				createdBy: USER.admin,
				createdAt: daysAgo(24, 9),
			},
			{
				id: EXPEN(116),
				organizationId: ORG_ID,
				amount: "200000",
				category: "Owner Drawings",
				description: "Owner personal drawings — February 2026",
				paymentMethod: "bank_transfer",
				referenceNumber: "DRAW-OWN-2026-02",
				authorizedBy: USER.admin,
				createdBy: USER.admin,
				createdAt: daysAgo(24, 10),
			},
			{
				id: EXPEN(117),
				organizationId: ORG_ID,
				amount: "16500",
				category: "Food Cost",
				description: "February chicken & beef weekly delivery",
				supplierId: SUPPLIER.freshFoods,
				paymentMethod: "cash",
				authorizedBy: USER.admin,
				createdBy: USER.bonita,
				createdAt: daysAgo(22, 9),
			},
			{
				id: EXPEN(118),
				organizationId: ORG_ID,
				amount: "7400",
				category: "Food Cost",
				description: "Valentine week seafood special — snapper, shrimp",
				supplierId: RSUPP(1),
				paymentMethod: "cash",
				authorizedBy: USER.admin,
				createdBy: USER.cashier,
				createdAt: daysAgo(22, 10),
			},
			{
				id: EXPEN(119),
				organizationId: ORG_ID,
				amount: "5800",
				category: "Utilities",
				description: "GPL electricity — February 2026",
				paymentMethod: "bank_transfer",
				referenceNumber: "GPL-2026-02",
				authorizedBy: USER.admin,
				createdBy: USER.admin,
				createdAt: daysAgo(18, 11),
			},
			{
				id: EXPEN(120),
				organizationId: ORG_ID,
				amount: "3500",
				category: "Maintenance",
				description: "POS system software update + hardware check",
				supplierId: RSUPP(36),
				paymentMethod: "card",
				referenceNumber: "MAINT-FEB-2026",
				authorizedBy: USER.admin,
				createdBy: USER.admin,
				createdAt: daysAgo(26, 10),
			},
		])
		.onConflictDoNothing();

	// 28. Stock Ledger movements
	console.log("  -> Stock Ledger");
	const SLEDGER = (n: number) =>
		`db000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
	await db
		.insert(schema.stockLedger)
		.values([
			{
				id: SLEDGER(1),
				inventoryItemId: INV_ITEM.chicken,
				locationId: LOC_ID,
				movementType: "purchase",
				quantityChange: "50",
				beforeQuantity: "20",
				afterQuantity: "70",
				userId: USER.admin,
				reason: "Weekly delivery from Fresh Foods",
				createdAt: daysAgo(1, 9),
			},
			{
				id: SLEDGER(2),
				inventoryItemId: INV_ITEM.rice,
				locationId: LOC_ID,
				movementType: "purchase",
				quantityChange: "100",
				beforeQuantity: "30",
				afterQuantity: "130",
				userId: USER.admin,
				reason: "Bulk purchase",
				createdAt: daysAgo(1, 9),
			},
			{
				id: SLEDGER(3),
				inventoryItemId: INV_ITEM.snapper,
				locationId: LOC_ID,
				movementType: "purchase",
				quantityChange: "30",
				beforeQuantity: "5",
				afterQuantity: "35",
				userId: USER.admin,
				reason: "Fresh catch delivery",
				createdAt: daysAgo(1, 10),
			},
			{
				id: SLEDGER(4),
				inventoryItemId: INV_ITEM.softDrinks,
				locationId: LOC_ID,
				movementType: "purchase",
				quantityChange: "120",
				beforeQuantity: "48",
				afterQuantity: "168",
				userId: USER.admin,
				reason: "Bev Dist weekly order",
				createdAt: daysAgo(2, 9),
			},
			{
				id: SLEDGER(5),
				inventoryItemId: INV_ITEM.flour,
				locationId: LOC_ID,
				movementType: "purchase",
				quantityChange: "25",
				beforeQuantity: "8",
				afterQuantity: "33",
				userId: USER.admin,
				reason: "Bakery restock",
				createdAt: daysAgo(3, 9),
			},
			{
				id: SLEDGER(6),
				inventoryItemId: INV_ITEM.chicken,
				locationId: LOC_ID,
				movementType: "sale",
				quantityChange: "-8",
				beforeQuantity: "70",
				afterQuantity: "62",
				userId: USER.cashier,
				reason: "Daily sales consumption",
				createdAt: daysAgo(0, 13),
			},
			{
				id: SLEDGER(7),
				inventoryItemId: INV_ITEM.rice,
				locationId: LOC_ID,
				movementType: "sale",
				quantityChange: "-15",
				beforeQuantity: "130",
				afterQuantity: "115",
				userId: USER.cashier,
				reason: "Daily sales consumption",
				createdAt: daysAgo(0, 13),
			},
			{
				id: SLEDGER(8),
				inventoryItemId: INV_ITEM.snapper,
				locationId: LOC_ID,
				movementType: "sale",
				quantityChange: "-6",
				beforeQuantity: "35",
				afterQuantity: "29",
				userId: USER.cashier,
				reason: "Daily sales",
				createdAt: daysAgo(0, 14),
			},
			{
				id: SLEDGER(9),
				inventoryItemId: INV_ITEM.softDrinks,
				locationId: LOC_ID,
				movementType: "sale",
				quantityChange: "-24",
				beforeQuantity: "168",
				afterQuantity: "144",
				userId: USER.cashier,
				reason: "Daily beverage sales",
				createdAt: daysAgo(0, 15),
			},
			{
				id: SLEDGER(10),
				inventoryItemId: INV_ITEM.oil,
				locationId: LOC_ID,
				movementType: "adjustment",
				quantityChange: "-2",
				beforeQuantity: "12",
				afterQuantity: "10",
				userId: USER.admin,
				reason: "Stock count correction - spoilage",
				createdAt: daysAgo(3, 16),
			},
			{
				id: SLEDGER(11),
				inventoryItemId: INV_ITEM.sugar,
				locationId: LOC_ID,
				movementType: "adjustment",
				quantityChange: "3",
				beforeQuantity: "7",
				afterQuantity: "10",
				userId: USER.admin,
				reason: "Found miscounted bags in storeroom",
				createdAt: daysAgo(4, 10),
			},
			{
				id: SLEDGER(12),
				inventoryItemId: INV_ITEM.garlic,
				locationId: LOC_ID,
				movementType: "adjustment",
				quantityChange: "-1",
				beforeQuantity: "5",
				afterQuantity: "4",
				userId: USER.admin,
				reason: "Spoiled - humidity damage",
				createdAt: daysAgo(5, 11),
			},
			{
				id: SLEDGER(13),
				inventoryItemId: INV_ITEM.chicken,
				locationId: LOC_ID,
				movementType: "waste",
				quantityChange: "-3",
				beforeQuantity: "62",
				afterQuantity: "59",
				userId: USER.admin,
				reason: "End-of-day unsold - exceeded safe temp",
				createdAt: daysAgo(1, 20),
			},
			{
				id: SLEDGER(14),
				inventoryItemId: INV_ITEM.snapper,
				locationId: LOC_ID,
				movementType: "waste",
				quantityChange: "-2",
				beforeQuantity: "29",
				afterQuantity: "27",
				userId: USER.admin,
				reason: "Not sold by closing - discarded",
				createdAt: daysAgo(2, 21),
			},
			{
				id: SLEDGER(15),
				inventoryItemId: INV_ITEM.beef,
				locationId: LOC_ID,
				movementType: "waste",
				quantityChange: "-1",
				beforeQuantity: "15",
				afterQuantity: "14",
				userId: USER.admin,
				reason: "Freezer outage - partial loss",
				createdAt: daysAgo(6, 8),
			},
			{
				id: SLEDGER(16),
				inventoryItemId: INV_ITEM.rice,
				locationId: LOC_ID,
				movementType: "transfer_out",
				quantityChange: "-10",
				beforeQuantity: "115",
				afterQuantity: "105",
				userId: USER.admin,
				reason: "Transfer to Quick Serve location",
				createdAt: daysAgo(2, 10),
			},
			{
				id: SLEDGER(17),
				inventoryItemId: INV_ITEM.rice,
				locationId: LOC_QUICK_SERVE,
				movementType: "transfer_in",
				quantityChange: "10",
				beforeQuantity: "5",
				afterQuantity: "15",
				userId: USER.admin,
				reason: "Received from Main location",
				createdAt: daysAgo(2, 10),
			},
			{
				id: SLEDGER(18),
				inventoryItemId: INV_ITEM.softDrinks,
				locationId: LOC_ID,
				movementType: "transfer_out",
				quantityChange: "-24",
				beforeQuantity: "144",
				afterQuantity: "120",
				userId: USER.admin,
				reason: "Transfer to Quick Serve",
				createdAt: daysAgo(3, 11),
			},
			{
				id: SLEDGER(19),
				inventoryItemId: INV_ITEM.beef,
				locationId: LOC_ID,
				movementType: "purchase",
				quantityChange: "20",
				beforeQuantity: "14",
				afterQuantity: "34",
				userId: USER.admin,
				reason: "Bulk beef - weekend prep",
				createdAt: daysAgo(5, 9),
			},
			{
				id: SLEDGER(20),
				inventoryItemId: INV_ITEM.coconut,
				locationId: LOC_ID,
				movementType: "purchase",
				quantityChange: "50",
				beforeQuantity: "10",
				afterQuantity: "60",
				userId: USER.admin,
				reason: "Coconut buns production stock",
				createdAt: daysAgo(4, 9),
			},
			{
				id: SLEDGER(21),
				inventoryItemId: INV_ITEM.noodles,
				locationId: LOC_ID,
				movementType: "purchase",
				quantityChange: "30",
				beforeQuantity: "12",
				afterQuantity: "42",
				userId: USER.admin,
				reason: "Chowmein restock",
				createdAt: daysAgo(7, 9),
			},
			{
				id: SLEDGER(22),
				inventoryItemId: INV_ITEM.onions,
				locationId: LOC_ID,
				movementType: "purchase",
				quantityChange: "40",
				beforeQuantity: "8",
				afterQuantity: "48",
				userId: USER.admin,
				reason: "Weekly veg delivery",
				createdAt: daysAgo(7, 10),
			},
			{
				id: SLEDGER(23),
				inventoryItemId: INV_ITEM.peppers,
				locationId: LOC_ID,
				movementType: "purchase",
				quantityChange: "20",
				beforeQuantity: "3",
				afterQuantity: "23",
				userId: USER.admin,
				reason: "Weekly veg delivery",
				createdAt: daysAgo(7, 10),
			},
		])
		.onConflictDoNothing();

	// ── Section 19j: Production Component Mappings ──────────────────────────
	console.log("  -> Production Component Mappings");
	await db
		.insert(schema.productProductionComponent)
		.values([
			// Fried Rice and Baked Chicken
			{
				productId: PROD.friedRiceBakedChicken,
				componentName: "Fried Rice",
				quantity: "1",
			},
			{
				productId: PROD.friedRiceBakedChicken,
				componentName: "Baked Chicken",
				quantity: "1",
			},
			// Raisin Rice with Pineapple Chicken
			{
				productId: PROD.raisinRicePineapple,
				componentName: "Raisin Rice",
				quantity: "1",
			},
			{
				productId: PROD.raisinRicePineapple,
				componentName: "Pineapple Chicken",
				quantity: "1",
			},
			// Vegetable Rice with Sweet and Sour Chicken
			{
				productId: PROD.vegRiceSweetSour,
				componentName: "Veg Rice",
				quantity: "1",
			},
			{
				productId: PROD.vegRiceSweetSour,
				componentName: "Sweet & Sour Chicken",
				quantity: "1",
			},
			// Chowmein/Baked Chicken
			{
				productId: PROD.chowmeinBakedChicken,
				componentName: "Chowmein",
				quantity: "1",
			},
			{
				productId: PROD.chowmeinBakedChicken,
				componentName: "Baked Chicken",
				quantity: "1",
			},
			// Chowmein/Fry Chicken
			{
				productId: PROD.chowmeinFryChicken,
				componentName: "Chowmein",
				quantity: "1",
			},
			{
				productId: PROD.chowmeinFryChicken,
				componentName: "Fry Chicken",
				quantity: "1",
			},
			// Caribbean Rice B/Chicken
			{
				productId: PROD.caribbeanRiceBChicken,
				componentName: "Caribbean Rice",
				quantity: "1",
			},
			{
				productId: PROD.caribbeanRiceBChicken,
				componentName: "Baked Chicken",
				quantity: "1",
			},
			// Caribbean Rice F/Chicken
			{
				productId: PROD.caribbeanRiceFChicken,
				componentName: "Caribbean Rice",
				quantity: "1",
			},
			{
				productId: PROD.caribbeanRiceFChicken,
				componentName: "Fry Chicken",
				quantity: "1",
			},
			// Cookup/Baked Chicken
			{
				productId: PROD.cookupBakedChicken,
				componentName: "Cookup",
				quantity: "1",
			},
			{
				productId: PROD.cookupBakedChicken,
				componentName: "Baked Chicken",
				quantity: "1",
			},
			// Mac Cheese W/ Baked Chick
			{
				productId: PROD.macCheeseBakedChick,
				componentName: "Mac & Cheese",
				quantity: "1",
			},
			{
				productId: PROD.macCheeseBakedChick,
				componentName: "Baked Chicken",
				quantity: "1",
			},
			// Cookup Baked Snapper
			{
				productId: PROD.cookupBakedSnapper,
				componentName: "Cookup",
				quantity: "1",
			},
			{
				productId: PROD.cookupBakedSnapper,
				componentName: "Baked Snapper",
				quantity: "1",
			},
			// Cookup Fry Snapper
			{
				productId: PROD.cookupFrySnapper,
				componentName: "Cookup",
				quantity: "1",
			},
			{
				productId: PROD.cookupFrySnapper,
				componentName: "Fry Snapper",
				quantity: "1",
			},
			// Anyrice / Curry Beef
			{ productId: PROD.curryBeef, componentName: "Rice", quantity: "1" },
			{ productId: PROD.curryBeef, componentName: "Curry Beef", quantity: "1" },
			// Cook Up BBQ
			{ productId: PROD.cookUpBBQ, componentName: "Cookup", quantity: "1" },
			{
				productId: PROD.cookUpBBQ,
				componentName: "BBQ Chicken",
				quantity: "1",
			},
			// Cook-up Fc
			{ productId: PROD.cookUpFc, componentName: "Cookup", quantity: "1" },
			{ productId: PROD.cookUpFc, componentName: "Fry Chicken", quantity: "1" },
			// Veg. Meal/Dholl
			{
				productId: PROD.vegMealDholl,
				componentName: "Veg Meal",
				quantity: "1",
			},
			{ productId: PROD.vegMealDholl, componentName: "Dholl", quantity: "1" },
		])
		.onConflictDoNothing();

	// ── Modifier Groups & Modifiers ────────────────────────────────────
	console.log("  -> Modifier Groups");
	const MGRP = {
		spiceLevel: "e0000000-0000-4000-8000-000000000001",
		proteinAddon: "e0000000-0000-4000-8000-000000000002",
		extras: "e0000000-0000-4000-8000-000000000003",
		cookStyle: "e0000000-0000-4000-8000-000000000004",
	} as const;

	await db
		.insert(schema.modifierGroup)
		.values([
			{
				id: MGRP.spiceLevel,
				organizationId: ORG_ID,
				name: "Spice Level",
				required: false,
				minSelect: 0,
				maxSelect: 1,
			},
			{
				id: MGRP.proteinAddon,
				organizationId: ORG_ID,
				name: "Protein Add-on",
				required: false,
				minSelect: 0,
				maxSelect: 2,
			},
			{
				id: MGRP.extras,
				organizationId: ORG_ID,
				name: "Extras",
				required: false,
				minSelect: 0,
				maxSelect: 3,
			},
			{
				id: MGRP.cookStyle,
				organizationId: ORG_ID,
				name: "Cook Style",
				required: false,
				minSelect: 0,
				maxSelect: 1,
			},
		])
		.onConflictDoNothing();

	console.log("  -> Modifiers");
	await db
		.insert(schema.modifier)
		.values([
			// Spice Level
			{
				modifierGroupId: MGRP.spiceLevel,
				name: "Mild",
				price: "0",
				sortOrder: 1,
			},
			{
				modifierGroupId: MGRP.spiceLevel,
				name: "Medium",
				price: "0",
				sortOrder: 2,
			},
			{
				modifierGroupId: MGRP.spiceLevel,
				name: "Hot",
				price: "0",
				sortOrder: 3,
			},
			{
				modifierGroupId: MGRP.spiceLevel,
				name: "Extra Hot",
				price: "0",
				sortOrder: 4,
			},
			// Protein Add-on
			{
				modifierGroupId: MGRP.proteinAddon,
				name: "Extra Chicken",
				price: "500",
				sortOrder: 1,
			},
			{
				modifierGroupId: MGRP.proteinAddon,
				name: "Extra Fish",
				price: "600",
				sortOrder: 2,
			},
			{
				modifierGroupId: MGRP.proteinAddon,
				name: "Add Egg",
				price: "200",
				sortOrder: 3,
			},
			// Extras
			{
				modifierGroupId: MGRP.extras,
				name: "Extra Rice",
				price: "300",
				sortOrder: 1,
			},
			{
				modifierGroupId: MGRP.extras,
				name: "Extra Sauce",
				price: "200",
				sortOrder: 2,
			},
			{
				modifierGroupId: MGRP.extras,
				name: "Extra Salad",
				price: "150",
				sortOrder: 3,
			},
			// Cook Style
			{
				modifierGroupId: MGRP.cookStyle,
				name: "Baked",
				price: "0",
				sortOrder: 1,
			},
			{
				modifierGroupId: MGRP.cookStyle,
				name: "Fried",
				price: "0",
				sortOrder: 2,
			},
			{
				modifierGroupId: MGRP.cookStyle,
				name: "Grilled",
				price: "200",
				sortOrder: 3,
			},
		])
		.onConflictDoNothing();

	console.log("  -> Product Modifier Group Links");
	await db
		.insert(schema.productModifierGroup)
		.values([
			// Curry dishes get Spice Level and Protein Add-on
			{ productId: PROD.curryChicken, modifierGroupId: MGRP.spiceLevel },
			{ productId: PROD.curryChicken, modifierGroupId: MGRP.proteinAddon },
			{ productId: PROD.curryChicken, modifierGroupId: MGRP.extras },
			{ productId: PROD.currySnapper, modifierGroupId: MGRP.spiceLevel },
			{ productId: PROD.currySnapper, modifierGroupId: MGRP.extras },
			{ productId: PROD.curryBeef, modifierGroupId: MGRP.spiceLevel },
			{ productId: PROD.curryBeef, modifierGroupId: MGRP.extras },
			// Main chicken meals get Protein Add-on, Extras, Cook Style
			{
				productId: PROD.friedRiceBakedChicken,
				modifierGroupId: MGRP.proteinAddon,
			},
			{ productId: PROD.friedRiceBakedChicken, modifierGroupId: MGRP.extras },
			{
				productId: PROD.cookupBakedChicken,
				modifierGroupId: MGRP.proteinAddon,
			},
			{ productId: PROD.cookupBakedChicken, modifierGroupId: MGRP.extras },
			{ productId: PROD.cookupBakedChicken, modifierGroupId: MGRP.cookStyle },
			{ productId: PROD.cookupBakedSnapper, modifierGroupId: MGRP.extras },
			{ productId: PROD.cookupBakedSnapper, modifierGroupId: MGRP.cookStyle },
			{
				productId: PROD.chowmeinBakedChicken,
				modifierGroupId: MGRP.proteinAddon,
			},
			{ productId: PROD.chowmeinBakedChicken, modifierGroupId: MGRP.extras },
		])
		.onConflictDoNothing();

	// ── Receipt Configuration ──────────────────────────────────────────
	console.log("  -> Receipt Config");
	await db
		.insert(schema.receiptConfig)
		.values({
			organizationId: ORG_ID,
			businessName: "Bettencourt's Food Inc.",
			tagline: "A True Guyanese Gem",
			addressLine1: "Georgetown, Guyana",
			phone: "+592-000-0000",
			footerMessage: "Thank you for choosing Bettencourt's! Come again!",
			showLogo: true,
		})
		.onConflictDoNothing();

	// ── Tax Rates: 16% VAT on packaged beverages ───────────────────────
	console.log("  -> Updating beverage tax rates (16% VAT)");
	await db
		.update(schema.product)
		.set({ taxRate: "0.16" })
		.where(
			inArray(schema.product.id, [
				PROD.drink1Lt,
				PROD.drink12oz,
				PROD.drink20oz,
				PROD.coke,
				PROD.vitaMalt,
				PROD.xlEnergy,
			]),
		);

	// 29. Apply tax rates to prepared food products (2D)
	// Guyana VAT: 14% on prepared food. Water & plain items are exempt.
	console.log("  -> Tax rates on products");
	const TAXABLE_RATE = "0.14";
	const taxableProducts = [
		PROD.friedRiceBakedChicken,
		PROD.raisinRicePineapple,
		PROD.vegRiceSweetSour,
		PROD.chowmeinBakedChicken,
		PROD.chowmeinFryChicken,
		PROD.caribbeanRiceBChicken,
		PROD.caribbeanRiceFChicken,
		PROD.cookupBakedChicken,
		PROD.curryChicken,
		PROD.macCheeseBakedChick,
		PROD.cookupBakedSnapper,
		PROD.cookupFrySnapper,
		PROD.currySnapper,
		PROD.curryBeef,
		PROD.vegChowmein,
		PROD.vegMealDholl,
		PROD.vegRice,
		PROD.veggieCookup,
		PROD.spongeCake,
		PROD.coconutBuns,
		PROD.bakedCustard,
		PROD.tamarindJuice,
		PROD.cookUpBBQ,
		PROD.cookUpFc,
		PROD.cupDhal,
	];
	for (const productId of taxableProducts) {
		await db
			.update(schema.product)
			.set({ taxRate: TAXABLE_RATE })
			.where(eq(schema.product.id, productId));
	}
	// Bottled drinks remain 0% (retail goods, not prepared food)

	// ── Webhook Endpoints & Deliveries ────────────────────────────────
	if (!isProduction) {
		console.log("  -> Webhook endpoints & delivery log");

		const WH_ENDPOINT_1 = "e2000000-0000-4000-8000-000000000001";
		const WH_ENDPOINT_2 = "e2000000-0000-4000-8000-000000000002";

		await db
			.insert(schema.webhookEndpoint)
			.values([
				{
					id: WH_ENDPOINT_1,
					organizationId: ORG_ID,
					name: "QuickBooks Accounting",
					url: "https://hooks.example.com/quickbooks/bettencourt",
					// Stored as plaintext in seed — decrypt() passes through non-encrypted values
					secret: "demo-secret-qb-32chars-placeholder",
					events: ["order.completed", "order.refunded"],
					isActive: true,
					createdAt: daysAgo(14, 9),
				},
				{
					id: WH_ENDPOINT_2,
					organizationId: ORG_ID,
					name: "Slack Inventory Alerts",
					url: "https://hooks.slack.com/services/T000/B000/demo-token",
					secret: null,
					events: ["inventory.low_stock", "inventory.out_of_stock"],
					isActive: true,
					createdAt: daysAgo(7, 10),
				},
			])
			.onConflictDoNothing();

		// Delivery records for QuickBooks endpoint
		await db
			.insert(schema.webhookDelivery)
			.values([
				{
					endpointId: WH_ENDPOINT_1,
					event: "order.completed",
					payload: {
						event: "order.completed",
						timestamp: daysAgo(1, 14).toISOString(),
						data: { orderId: ORDER.o1, orderNumber: "GT-001", total: "4400" },
					},
					statusCode: 200,
					responseBody: '{"status":"ok","id":"qb_txn_001"}',
					duration: 312,
					success: true,
					createdAt: daysAgo(1, 14),
				},
				{
					endpointId: WH_ENDPOINT_1,
					event: "order.completed",
					payload: {
						event: "order.completed",
						timestamp: daysAgo(2, 11).toISOString(),
						data: { orderId: ORDER.o3, orderNumber: "GT-003", total: "6600" },
					},
					statusCode: 200,
					responseBody: '{"status":"ok","id":"qb_txn_002"}',
					duration: 284,
					success: true,
					createdAt: daysAgo(2, 11),
				},
				{
					endpointId: WH_ENDPOINT_1,
					event: "order.refunded",
					payload: {
						event: "order.refunded",
						timestamp: daysAgo(3, 15).toISOString(),
						data: {
							orderId: ORDER.o5,
							orderNumber: "GT-005",
							refundAmount: "2200",
						},
					},
					statusCode: 503,
					responseBody: "Service Unavailable",
					duration: 10023,
					success: false,
					createdAt: daysAgo(3, 15),
				},
				{
					endpointId: WH_ENDPOINT_1,
					event: "order.completed",
					payload: {
						event: "order.completed",
						timestamp: daysAgo(4, 13).toISOString(),
						data: { orderId: ORDER.o7, orderNumber: "GT-007", total: "8800" },
					},
					statusCode: 200,
					responseBody: '{"status":"ok","id":"qb_txn_003"}',
					duration: 198,
					success: true,
					createdAt: daysAgo(4, 13),
				},
			])
			.onConflictDoNothing();

		// Delivery records for Slack endpoint
		await db
			.insert(schema.webhookDelivery)
			.values([
				{
					endpointId: WH_ENDPOINT_2,
					event: "inventory.low_stock",
					payload: {
						event: "inventory.low_stock",
						timestamp: daysAgo(1, 8).toISOString(),
						data: {
							itemId: INV_ITEM.chicken,
							itemName: "Chicken",
							currentQty: 5,
							minQty: 10,
						},
					},
					statusCode: 200,
					responseBody: "ok",
					duration: 145,
					success: true,
					createdAt: daysAgo(1, 8),
				},
				{
					endpointId: WH_ENDPOINT_2,
					event: "inventory.out_of_stock",
					payload: {
						event: "inventory.out_of_stock",
						timestamp: daysAgo(2, 16).toISOString(),
						data: {
							itemId: INV_ITEM.snapper,
							itemName: "Snapper",
							currentQty: 0,
						},
					},
					statusCode: null,
					responseBody: "Error: connect ETIMEDOUT hooks.slack.com:443",
					duration: 10001,
					success: false,
					createdAt: daysAgo(2, 16),
				},
				{
					endpointId: WH_ENDPOINT_2,
					event: "inventory.low_stock",
					payload: {
						event: "inventory.low_stock",
						timestamp: daysAgo(3, 9).toISOString(),
						data: {
							itemId: INV_ITEM.rice,
							itemName: "Rice",
							currentQty: 8,
							minQty: 20,
						},
					},
					statusCode: 200,
					responseBody: "ok",
					duration: 167,
					success: true,
					createdAt: daysAgo(3, 9),
				},
			])
			.onConflictDoNothing();

		// ── Notification Settings & Templates ──────────────────────────
		console.log("  -> Notification settings & templates");

		const NOTIF_TMPL_1 = "e3000000-0000-4000-8000-000000000001";
		const NOTIF_TMPL_2 = "e3000000-0000-4000-8000-000000000002";
		const NOTIF_TMPL_3 = "e3000000-0000-4000-8000-000000000003";
		const NOTIF_TMPL_4 = "e3000000-0000-4000-8000-000000000004";

		// Organization notification settings (Twilio not configured — demo mode)
		await db
			.insert(schema.notificationSettings)
			.values({
				organizationId: ORG_ID,
				provider: "twilio",
				accountSid: null,
				authToken: null,
				fromNumber: null,
				whatsappNumber: null,
				isActive: false,
				dailyLimit: 500,
			})
			.onConflictDoNothing();

		// Message templates for common events
		await db
			.insert(schema.notificationTemplate)
			.values([
				{
					id: NOTIF_TMPL_1,
					organizationId: ORG_ID,
					event: "order.ready",
					name: "Order Ready (SMS)",
					description:
						"Sent to customers when their pickup/delivery order is ready",
					channel: "sms",
					messageTemplate:
						"Hi {{customerName}}, your order #{{orderNumber}} is ready for pickup at Bettencourt's! 🍽️",
					isActive: true,
				},
				{
					id: NOTIF_TMPL_2,
					organizationId: ORG_ID,
					event: "loyalty.earned",
					name: "Loyalty Points Earned (SMS)",
					description:
						"Sent when a customer earns loyalty points from an order",
					channel: "sms",
					messageTemplate:
						"Hi {{customerName}}! You earned {{points}} loyalty points on order #{{orderNumber}}. Total: {{totalPoints}} pts. - Bettencourt's",
					isActive: true,
				},
				{
					id: NOTIF_TMPL_3,
					organizationId: ORG_ID,
					event: "order.refunded",
					name: "Refund Processed (SMS)",
					description: "Sent to customers when their refund has been processed",
					channel: "sms",
					messageTemplate:
						"Hi {{customerName}}, your refund of ${{refundAmount}} GYD for order #{{orderNumber}} has been processed. - Bettencourt's",
					isActive: true,
				},
				{
					id: NOTIF_TMPL_4,
					organizationId: ORG_ID,
					event: "order.ready",
					name: "Order Ready (WhatsApp)",
					description: "WhatsApp message when order is ready for pickup",
					channel: "whatsapp",
					messageTemplate:
						"Hello {{customerName}} 👋\n\nYour order *#{{orderNumber}}* from Bettencourt's Food Inc. is *ready for pickup*! 🍛\n\nThank you for your order!",
					isActive: false,
				},
			])
			.onConflictDoNothing();

		// Sample notification log entries (simulated — Twilio not active in demo)
		await db
			.insert(schema.notificationLog)
			.values([
				{
					organizationId: ORG_ID,
					templateId: NOTIF_TMPL_1,
					event: "order.ready",
					channel: "sms",
					recipient: "+592-600-0001",
					message:
						"Hi Maria, your order #GT-005 is ready for pickup at Bettencourt's! 🍽️",
					status: "delivered",
					externalId: "SM_demo_0001",
					metadata: { orderId: ORDER.o5, customerId: CUST(1) },
					cost: 1,
					createdAt: daysAgo(1, 13),
				},
				{
					organizationId: ORG_ID,
					templateId: NOTIF_TMPL_2,
					event: "loyalty.earned",
					channel: "sms",
					recipient: "+592-600-0001",
					message:
						"Hi Maria! You earned 44 loyalty points on order #GT-005. Total: 312 pts. - Bettencourt's",
					status: "delivered",
					externalId: "SM_demo_0002",
					metadata: { orderId: ORDER.o5, customerId: CUST(1), points: 44 },
					cost: 1,
					createdAt: daysAgo(1, 13),
				},
				{
					organizationId: ORG_ID,
					templateId: NOTIF_TMPL_1,
					event: "order.ready",
					channel: "sms",
					recipient: "+592-600-0002",
					message:
						"Hi John, your order #GT-008 is ready for pickup at Bettencourt's! 🍽️",
					status: "failed",
					externalId: null,
					errorMessage: "Twilio: The 'To' number is not a valid phone number",
					metadata: { orderId: ORDER.o8, customerId: CUST(2) },
					cost: null,
					createdAt: daysAgo(2, 10),
				},
				{
					organizationId: ORG_ID,
					templateId: NOTIF_TMPL_3,
					event: "order.refunded",
					channel: "sms",
					recipient: "+592-600-0003",
					message:
						"Hi Sarah, your refund of $2200 GYD for order #GT-021 has been processed. - Bettencourt's",
					status: "sent",
					externalId: "SM_demo_0003",
					metadata: { orderId: "f2000000-0000-4000-8000-000000000001" },
					cost: 1,
					createdAt: daysAgo(3, 14),
				},
				{
					organizationId: ORG_ID,
					templateId: NOTIF_TMPL_2,
					event: "loyalty.earned",
					channel: "sms",
					recipient: "+592-600-0003",
					message:
						"Hi Sarah! You earned 66 loyalty points on order #GT-010. Total: 180 pts. - Bettencourt's",
					status: "delivered",
					externalId: "SM_demo_0004",
					metadata: { orderId: ORDER.o10, customerId: CUST(3), points: 66 },
					cost: 1,
					createdAt: daysAgo(4, 15),
				},
			])
			.onConflictDoNothing();

		// ── Split Bill Orders ─────────────────────────────────────────
		console.log("  -> Split bill demo orders");

		const ORDER_SPLIT_1 = "f3000000-0000-4000-8000-000000000001";
		const ORDER_SPLIT_2 = "f3000000-0000-4000-8000-000000000002";

		// Split order: table dine-in, 4 items split between 2 people
		await db
			.insert(schema.order)
			.values([
				{
					id: ORDER_SPLIT_1,
					organizationId: ORG_ID,
					locationId: LOC_ID,
					registerId: REG.meals,
					userId: USER.cashier,
					orderNumber: "GT-022",
					type: "sale",
					status: "completed",
					tableId: TABLE.t3,
					isSplit: true,
					subtotal: "8800",
					taxTotal: "616",
					total: "9416",
					notes: "Split between 2 — couple's lunch",
					createdAt: daysAgo(1, 12),
				},
				{
					id: ORDER_SPLIT_2,
					organizationId: ORG_ID,
					locationId: LOC_ID,
					registerId: REG.meals,
					userId: USER.cashier,
					orderNumber: "GT-023",
					type: "sale",
					status: "completed",
					tableId: TABLE.t5,
					isSplit: true,
					subtotal: "13200",
					taxTotal: "924",
					total: "14124",
					notes: "Split 3 ways — office group",
					createdAt: daysAgo(2, 13),
				},
			])
			.onConflictDoNothing();

		// Line items for split order 1
		await db
			.insert(schema.orderLineItem)
			.values([
				{
					id: "f3000000-0000-4000-8000-000000000011",
					orderId: ORDER_SPLIT_1,
					productId: PROD.friedRiceBakedChicken,
					productNameSnapshot: "Fried Rice and Baked Chicken",
					reportingCategorySnapshot: "Chicken",
					quantity: 1,
					unitPrice: "2200",
					total: "2200",
				},
				{
					id: "f3000000-0000-4000-8000-000000000012",
					orderId: ORDER_SPLIT_1,
					productId: PROD.curryChicken,
					productNameSnapshot: "Curry Chicken",
					reportingCategorySnapshot: "Chicken",
					quantity: 1,
					unitPrice: "2400",
					total: "2400",
				},
				{
					id: "f3000000-0000-4000-8000-000000000013",
					orderId: ORDER_SPLIT_1,
					productId: PROD.coke,
					productNameSnapshot: "Coca-Cola (Can)",
					reportingCategorySnapshot: "Beverages",
					quantity: 2,
					unitPrice: "600",
					total: "1200",
				},
				{
					id: "f3000000-0000-4000-8000-000000000014",
					orderId: ORDER_SPLIT_1,
					productId: PROD.spongeCake,
					productNameSnapshot: "Sponge Cake",
					reportingCategorySnapshot: "Pastries",
					quantity: 1,
					unitPrice: "700",
					total: "700",
				},
			])
			.onConflictDoNothing();

		// Line items for split order 2
		await db
			.insert(schema.orderLineItem)
			.values([
				{
					id: "f3000000-0000-4000-8000-000000000021",
					orderId: ORDER_SPLIT_2,
					productId: PROD.cookupBakedChicken,
					productNameSnapshot: "Cookup and Baked Chicken",
					reportingCategorySnapshot: "Chicken",
					quantity: 3,
					unitPrice: "2500",
					total: "7500",
				},
				{
					id: "f3000000-0000-4000-8000-000000000022",
					orderId: ORDER_SPLIT_2,
					productId: PROD.tamarindJuice,
					productNameSnapshot: "Tamarind Juice",
					reportingCategorySnapshot: "Local Juices",
					quantity: 3,
					unitPrice: "500",
					total: "1500",
				},
				{
					id: "f3000000-0000-4000-8000-000000000023",
					orderId: ORDER_SPLIT_2,
					productId: PROD.coconutBuns,
					productNameSnapshot: "Coconut Buns",
					reportingCategorySnapshot: "Pastries",
					quantity: 3,
					unitPrice: "400",
					total: "1200",
				},
			])
			.onConflictDoNothing();

		// Payments for split order 1 — 2 people paid separately
		await db
			.insert(schema.payment)
			.values([
				{
					orderId: ORDER_SPLIT_1,
					method: "cash",
					amount: "4708",
					tendered: "5000",
					changeGiven: "292",
					currency: "GYD",
					splitGroup: 1,
					status: "completed",
				},
				{
					orderId: ORDER_SPLIT_1,
					method: "card",
					amount: "4708",
					tendered: "4708",
					changeGiven: "0",
					currency: "GYD",
					splitGroup: 2,
					status: "completed",
				},
			])
			.onConflictDoNothing();

		// Payments for split order 2 — 3 people paid separately
		await db
			.insert(schema.payment)
			.values([
				{
					orderId: ORDER_SPLIT_2,
					method: "cash",
					amount: "4708",
					tendered: "5000",
					changeGiven: "292",
					currency: "GYD",
					splitGroup: 1,
					status: "completed",
				},
				{
					orderId: ORDER_SPLIT_2,
					method: "cash",
					amount: "4708",
					tendered: "5000",
					changeGiven: "292",
					currency: "GYD",
					splitGroup: 2,
					status: "completed",
				},
				{
					orderId: ORDER_SPLIT_2,
					method: "mobile_money",
					amount: "4708",
					tendered: "4708",
					changeGiven: "0",
					currency: "GYD",
					splitGroup: 3,
					status: "completed",
				},
			])
			.onConflictDoNothing();
	}

	// 32. Add a refunded order for status coverage (2E)
	console.log("  -> Refunded order (status coverage)");
	const ORDER_REFUND = "f2000000-0000-4000-8000-000000000001";
	const LI_REFUND = (n: number) =>
		`f2000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
	await db
		.insert(schema.order)
		.values({
			id: ORDER_REFUND,
			organizationId: ORG_ID,
			locationId: LOC_ID,
			registerId: REG.meals,
			userId: USER.cashier,
			orderNumber: "GT-021",
			type: "sale",
			status: "refunded",
			subtotal: "2200",
			taxTotal: "0",
			total: "2200",
			notes: "Customer returned — wrong order delivered",
			createdAt: daysAgo(3, 14),
		})
		.onConflictDoNothing();
	await db
		.insert(schema.orderLineItem)
		.values({
			id: LI_REFUND(1),
			orderId: ORDER_REFUND,
			productId: PROD.friedRiceBakedChicken,
			productNameSnapshot: "Fried Rice and Baked Chicken",
			reportingCategorySnapshot: "Chicken",
			quantity: 1,
			unitPrice: "2200",
			total: "2200",
		})
		.onConflictDoNothing();

	// ── Combo Products ────────────────────────────────────────────────────
	console.log("  -> Combo Products");

	const COMBO = {
		familyMeal: "cb000000-0000-4000-8000-000000000001",
		duoSpecial: "cb000000-0000-4000-8000-000000000002",
		fishFriday: "cb000000-0000-4000-8000-000000000003",
	} as const;

	const CPROD = {
		familyMeal: "cb100000-0000-4000-8000-000000000001",
		duoSpecial: "cb100000-0000-4000-8000-000000000002",
		fishFriday: "cb100000-0000-4000-8000-000000000003",
	} as const;

	// Insert the 3 combo products into the product table
	await db
		.insert(schema.product)
		.values([
			{
				id: COMBO.familyMeal,
				organizationId: ORG_ID,
				name: "Family Meal Deal",
				reportingName: "Family Meal Deal",
				reportingCategoryId: DEPT.specials,
				price: "8500",
				taxRate: "0",
				sortOrder: 1,
			},
			{
				id: COMBO.duoSpecial,
				organizationId: ORG_ID,
				name: "Duo Special",
				reportingName: "Duo Special",
				reportingCategoryId: DEPT.specials,
				price: "5500",
				taxRate: "0",
				sortOrder: 2,
			},
			{
				id: COMBO.fishFriday,
				organizationId: ORG_ID,
				name: "Fish Friday Combo",
				reportingName: "Fish Friday Combo",
				reportingCategoryId: DEPT.specials,
				price: "6000",
				taxRate: "0",
				sortOrder: 3,
			},
		])
		.onConflictDoNothing();

	// Create comboProduct bridge rows (one per combo product)
	await db
		.insert(schema.comboProduct)
		.values([
			{ id: CPROD.familyMeal, productId: COMBO.familyMeal },
			{ id: CPROD.duoSpecial, productId: COMBO.duoSpecial },
			{ id: CPROD.fishFriday, productId: COMBO.fishFriday },
		])
		.onConflictDoNothing();

	// Create combo components with allocated prices
	const CC = (n: number) =>
		`cb200000-0000-4000-8000-${String(n).padStart(12, "0")}`;

	await db
		.insert(schema.comboComponent)
		.values([
			// Family Meal Deal: 4× Fried Rice/Baked Chicken + 2× 1L Drink + 2× Sponge Cake
			// Allocated: 6000 + 1600 + 900 = 8500
			{
				id: CC(1),
				comboProductId: CPROD.familyMeal,
				componentName: "Fried Rice / Baked Chicken × 4",
				departmentId: DEPT.chicken,
				allocatedPrice: "6000",
			},
			{
				id: CC(2),
				comboProductId: CPROD.familyMeal,
				componentName: "1L Drink × 2",
				departmentId: DEPT.beverages,
				allocatedPrice: "1600",
			},
			{
				id: CC(3),
				comboProductId: CPROD.familyMeal,
				componentName: "Sponge Cake × 2",
				departmentId: DEPT.pastries,
				allocatedPrice: "900",
			},
			// Duo Special: 2× Any Meal + 2× 12oz Drink
			// Allocated: 4400 + 1100 = 5500
			{
				id: CC(4),
				comboProductId: CPROD.duoSpecial,
				componentName: "Any Meal × 2",
				departmentId: DEPT.chicken,
				allocatedPrice: "4400",
			},
			{
				id: CC(5),
				comboProductId: CPROD.duoSpecial,
				componentName: "12oz Drink × 2",
				departmentId: DEPT.beverages,
				allocatedPrice: "1100",
			},
			// Fish Friday Combo: 2× Cookup Fish + 2× 1L Drink
			// Allocated: 4800 + 1200 = 6000
			{
				id: CC(6),
				comboProductId: CPROD.fishFriday,
				componentName: "Cookup Fish × 2",
				departmentId: DEPT.fish,
				allocatedPrice: "4800",
			},
			{
				id: CC(7),
				comboProductId: CPROD.fishFriday,
				componentName: "1L Drink × 2",
				departmentId: DEPT.beverages,
				allocatedPrice: "1200",
			},
		])
		.onConflictDoNothing();

	// ── Combo Order Examples ──────────────────────────────────────────────
	console.log("  -> Orders with combo products (GT-024, GT-025, GT-026)");

	// Helper for new extended order line item IDs (f6000000 prefix)
	const ELI = (n: number) =>
		`f6000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

	await db
		.insert(schema.order)
		.values([
			{
				// GT-024: Family Meal Deal — completed, customer Anita Ramsaroop
				id: ORDER_EXT.e1,
				organizationId: ORG_ID,
				locationId: LOC_ID,
				registerId: REG.meals,
				userId: USER.cashier,
				customerId: CUST(3),
				orderNumber: "GT-024",
				type: "sale",
				status: "completed",
				subtotal: "8500",
				taxTotal: "0",
				total: "8500",
				createdAt: daysAgo(2, 12),
			},
			{
				// GT-025: Duo Special — completed, customer Sheila Bacchus
				id: ORDER_EXT.e2,
				organizationId: ORG_ID,
				locationId: LOC_ID,
				registerId: REG.meals,
				userId: USER.admin,
				customerId: CUST(7),
				orderNumber: "GT-025",
				type: "sale",
				status: "completed",
				subtotal: "5500",
				taxTotal: "0",
				total: "5500",
				createdAt: daysAgo(1, 13),
			},
			{
				// GT-026: 2× Fish Friday — open dine-in at table t3
				id: ORDER_EXT.e3,
				organizationId: ORG_ID,
				locationId: LOC_ID,
				registerId: REG.meals,
				userId: USER.cashier,
				orderNumber: "GT-026",
				type: "sale",
				status: "open",
				subtotal: "12000",
				taxTotal: "0",
				total: "12000",
				tableId: TABLE.t3,
				createdAt: daysAgo(0, 11),
			},
		])
		.onConflictDoNothing();

	// GT-024 line items: 1 combo parent + 3 component lines
	await db
		.insert(schema.orderLineItem)
		.values([
			{
				id: ELI(1),
				orderId: ORDER_EXT.e1,
				productId: COMBO.familyMeal,
				productNameSnapshot: "Family Meal Deal",
				reportingCategorySnapshot: "Specials",
				quantity: 1,
				unitPrice: "8500",
				total: "8500",
				isComponent: false,
			},
			{
				id: ELI(2),
				orderId: ORDER_EXT.e1,
				productId: PROD.friedRiceBakedChicken,
				productNameSnapshot: "Fried Rice / Baked Chicken × 4",
				reportingCategorySnapshot: "Chicken",
				quantity: 4,
				unitPrice: "1500",
				total: "6000",
				isComponent: true,
			},
			{
				id: ELI(3),
				orderId: ORDER_EXT.e1,
				productId: PROD.drink1Lt,
				productNameSnapshot: "1L Drink × 2",
				reportingCategorySnapshot: "Beverages",
				quantity: 2,
				unitPrice: "800",
				total: "1600",
				isComponent: true,
			},
			{
				id: ELI(4),
				orderId: ORDER_EXT.e1,
				productId: PROD.spongeCake,
				productNameSnapshot: "Sponge Cake × 2",
				reportingCategorySnapshot: "Pastries",
				quantity: 2,
				unitPrice: "450",
				total: "900",
				isComponent: true,
			},
		])
		.onConflictDoNothing();

	await db
		.insert(schema.payment)
		.values({
			orderId: ORDER_EXT.e1,
			method: "cash",
			amount: "8500",
			tendered: "10000",
			changeGiven: "1500",
			currency: "GYD",
			status: "completed",
		})
		.onConflictDoNothing();

	// GT-025 line items: Duo Special
	await db
		.insert(schema.orderLineItem)
		.values([
			{
				id: ELI(10),
				orderId: ORDER_EXT.e2,
				productId: COMBO.duoSpecial,
				productNameSnapshot: "Duo Special",
				reportingCategorySnapshot: "Specials",
				quantity: 1,
				unitPrice: "5500",
				total: "5500",
				isComponent: false,
			},
			{
				id: ELI(11),
				orderId: ORDER_EXT.e2,
				productId: PROD.curryChicken,
				productNameSnapshot: "Any Meal × 2 (Curry Chicken)",
				reportingCategorySnapshot: "Chicken",
				quantity: 2,
				unitPrice: "2200",
				total: "4400",
				isComponent: true,
			},
			{
				id: ELI(12),
				orderId: ORDER_EXT.e2,
				productId: PROD.drink12oz,
				productNameSnapshot: "12oz Drink × 2",
				reportingCategorySnapshot: "Beverages",
				quantity: 2,
				unitPrice: "550",
				total: "1100",
				isComponent: true,
			},
		])
		.onConflictDoNothing();

	await db
		.insert(schema.payment)
		.values({
			orderId: ORDER_EXT.e2,
			method: "card",
			amount: "5500",
			tendered: "5500",
			changeGiven: "0",
			currency: "GYD",
			status: "completed",
		})
		.onConflictDoNothing();

	// GT-026 line items: 2× Fish Friday (open order, no payment yet)
	await db
		.insert(schema.orderLineItem)
		.values([
			{
				id: ELI(20),
				orderId: ORDER_EXT.e3,
				productId: COMBO.fishFriday,
				productNameSnapshot: "Fish Friday Combo",
				reportingCategorySnapshot: "Specials",
				quantity: 2,
				unitPrice: "6000",
				total: "12000",
				isComponent: false,
			},
			{
				id: ELI(21),
				orderId: ORDER_EXT.e3,
				productId: PROD.cookupBakedSnapper,
				productNameSnapshot: "Cookup Fish × 2",
				reportingCategorySnapshot: "Fish",
				quantity: 4,
				unitPrice: "2400",
				total: "9600",
				isComponent: true,
			},
			{
				id: ELI(22),
				orderId: ORDER_EXT.e3,
				productId: PROD.drink1Lt,
				productNameSnapshot: "1L Drink × 2",
				reportingCategorySnapshot: "Beverages",
				quantity: 4,
				unitPrice: "600",
				total: "2400",
				isComponent: true,
			},
		])
		.onConflictDoNothing();

	// ── Orders with Modifier Selections ──────────────────────────────────
	console.log("  -> Orders with modifiers applied (GT-027, GT-028)");

	await db
		.insert(schema.order)
		.values([
			{
				id: ORDER_EXT.e4,
				organizationId: ORG_ID,
				locationId: LOC_ID,
				registerId: REG.meals,
				userId: USER.cashier,
				customerId: CUST(1),
				orderNumber: "GT-027",
				type: "sale",
				status: "completed",
				subtotal: "4700",
				taxTotal: "0",
				total: "4700",
				createdAt: daysAgo(1, 12),
			},
			{
				id: ORDER_EXT.e5,
				organizationId: ORG_ID,
				locationId: LOC_ID,
				registerId: REG.meals,
				userId: USER.admin,
				orderNumber: "GT-028",
				type: "sale",
				status: "completed",
				subtotal: "5400",
				taxTotal: "0",
				total: "5400",
				createdAt: daysAgo(0, 13),
			},
		])
		.onConflictDoNothing();

	await db
		.insert(schema.orderLineItem)
		.values([
			{
				// GT-027: Curry Chicken — Spice: Hot (free) + Extra Rice (+300)
				id: ELI(30),
				orderId: ORDER_EXT.e4,
				productId: PROD.curryChicken,
				productNameSnapshot: "Curry Chicken",
				reportingCategorySnapshot: "Chicken",
				quantity: 1,
				unitPrice: "2300",
				total: "2300",
				modifiersSnapshot: [
					{ name: "Spice Level: Hot", price: "0" },
					{ name: "Extra Rice", price: "300" },
				] as unknown as (typeof schema.orderLineItem.$inferInsert)["modifiersSnapshot"],
			},
			{
				// GT-027: Curry Beef — Spice: Medium (free)
				id: ELI(31),
				orderId: ORDER_EXT.e4,
				productId: PROD.curryBeef,
				productNameSnapshot: "Anyrice / Curry Beef",
				reportingCategorySnapshot: "Beef",
				quantity: 1,
				unitPrice: "2400",
				total: "2400",
				modifiersSnapshot: [
					{ name: "Spice Level: Medium", price: "0" },
				] as unknown as (typeof schema.orderLineItem.$inferInsert)["modifiersSnapshot"],
			},
			{
				// GT-028: Chowmein/Baked Chicken × 2 — Extra Chicken (+500 each)
				id: ELI(32),
				orderId: ORDER_EXT.e5,
				productId: PROD.chowmeinBakedChicken,
				productNameSnapshot: "Chowmein/Baked Chicken",
				reportingCategorySnapshot: "Chicken",
				quantity: 2,
				unitPrice: "2700",
				total: "5400",
				modifiersSnapshot: [
					{ name: "Extra Chicken", price: "500" },
				] as unknown as (typeof schema.orderLineItem.$inferInsert)["modifiersSnapshot"],
			},
		])
		.onConflictDoNothing();

	await db
		.insert(schema.payment)
		.values([
			{
				orderId: ORDER_EXT.e4,
				method: "cash",
				amount: "4700",
				tendered: "5000",
				changeGiven: "300",
				currency: "GYD",
				status: "completed",
			},
			{
				orderId: ORDER_EXT.e5,
				method: "mobile_money",
				amount: "5400",
				tendered: "5400",
				changeGiven: "0",
				currency: "GYD",
				status: "completed",
			},
		])
		.onConflictDoNothing();

	// ── Discount Order + VAT Beverage Order ──────────────────────────────
	console.log("  -> Discount order (GT-029) + VAT beverage order (GT-030)");

	await db
		.insert(schema.order)
		.values([
			{
				id: ORDER_EXT.e6,
				organizationId: ORG_ID,
				locationId: LOC_ID,
				registerId: REG.meals,
				userId: USER.cashier,
				customerId: CUST(4),
				orderNumber: "GT-029",
				type: "sale",
				status: "completed",
				subtotal: "4000",
				discountTotal: "400",
				taxTotal: "0",
				total: "3600",
				notes: "Staff & family discount applied",
				createdAt: daysAgo(1, 14),
			},
			{
				id: ORDER_EXT.e7,
				organizationId: ORG_ID,
				locationId: LOC_ID,
				registerId: REG.beverage,
				userId: USER.cashier,
				orderNumber: "GT-030",
				type: "sale",
				status: "completed",
				subtotal: "2400",
				taxTotal: "384",
				total: "2784",
				notes: "VAT applied to packaged beverages (16%)",
				createdAt: daysAgo(0, 10),
			},
		])
		.onConflictDoNothing();

	await db
		.insert(schema.orderLineItem)
		.values([
			{
				id: ELI(40),
				orderId: ORDER_EXT.e6,
				productId: PROD.curryChicken,
				productNameSnapshot: "Curry Chicken",
				reportingCategorySnapshot: "Chicken",
				quantity: 2,
				unitPrice: "2000",
				discount: "400",
				total: "3600",
			},
			{
				id: ELI(41),
				orderId: ORDER_EXT.e7,
				productId: PROD.drink1Lt,
				productNameSnapshot: "1 Lt Drink",
				reportingCategorySnapshot: "Beverages",
				quantity: 4,
				unitPrice: "600",
				tax: "384",
				total: "2784",
			},
		])
		.onConflictDoNothing();

	await db
		.insert(schema.payment)
		.values([
			{
				orderId: ORDER_EXT.e6,
				method: "cash",
				amount: "3600",
				tendered: "4000",
				changeGiven: "400",
				currency: "GYD",
				status: "completed",
			},
			{
				orderId: ORDER_EXT.e7,
				method: "cash",
				amount: "2784",
				tendered: "3000",
				changeGiven: "216",
				currency: "GYD",
				status: "completed",
			},
		])
		.onConflictDoNothing();

	// ── USD/FX Payment Order ──────────────────────────────────────────────
	console.log("  -> USD foreign exchange payment order (GT-031)");

	await db
		.insert(schema.order)
		.values({
			id: ORDER_EXT.e8,
			organizationId: ORG_ID,
			locationId: LOC_ID,
			registerId: REG.meals,
			userId: USER.cashier,
			customerName: "Tourist (USD)",
			orderNumber: "GT-031",
			type: "sale",
			status: "completed",
			subtotal: "8500",
			taxTotal: "0",
			total: "8500",
			notes: "Paid in USD @ 210 GYD/USD",
			createdAt: daysAgo(3, 13),
		})
		.onConflictDoNothing();

	await db
		.insert(schema.orderLineItem)
		.values([
			{
				id: ELI(50),
				orderId: ORDER_EXT.e8,
				productId: COMBO.familyMeal,
				productNameSnapshot: "Family Meal Deal",
				reportingCategorySnapshot: "Specials",
				quantity: 1,
				unitPrice: "8500",
				total: "8500",
				isComponent: false,
			},
			{
				id: ELI(51),
				orderId: ORDER_EXT.e8,
				productId: PROD.friedRiceBakedChicken,
				productNameSnapshot: "Fried Rice / Baked Chicken × 4",
				reportingCategorySnapshot: "Chicken",
				quantity: 4,
				unitPrice: "1500",
				total: "6000",
				isComponent: true,
			},
			{
				id: ELI(52),
				orderId: ORDER_EXT.e8,
				productId: PROD.drink1Lt,
				productNameSnapshot: "1L Drink × 2",
				reportingCategorySnapshot: "Beverages",
				quantity: 2,
				unitPrice: "800",
				total: "1600",
				isComponent: true,
			},
			{
				id: ELI(53),
				orderId: ORDER_EXT.e8,
				productId: PROD.spongeCake,
				productNameSnapshot: "Sponge Cake × 2",
				reportingCategorySnapshot: "Pastries",
				quantity: 2,
				unitPrice: "450",
				total: "900",
				isComponent: true,
			},
		])
		.onConflictDoNothing();

	// USD payment: tendered = 45 USD, rate = 210 GYD/USD → 9450 GYD received
	await db
		.insert(schema.payment)
		.values({
			orderId: ORDER_EXT.e8,
			method: "cash",
			amount: "8500",
			tendered: "45",
			changeGiven: "950",
			currency: "USD",
			exchangeRate: "210.0000",
			status: "completed",
		})
		.onConflictDoNothing();

	// ── Loyalty Redemption Order ────────────────────────────────────────────
	console.log("  -> Loyalty redemption order (GT-032)");
	await db
		.insert(schema.order)
		.values({
			id: ORDER_EXT.e9,
			organizationId: ORG_ID,
			locationId: LOC_ID,
			registerId: REG.meals,
			userId: USER.cashier,
			orderNumber: "GT-032",
			type: "sale",
			status: "completed",
			customerId: CUST(7),
			customerName: "Sheila Bacchus",
			subtotal: "5500",
			discountTotal: "500",
			taxTotal: "0",
			total: "5000",
			createdAt: daysAgo(0, 13),
		})
		.onConflictDoNothing();

	// GT-032 line items: Duo Special with 500-pt loyalty discount applied
	await db
		.insert(schema.orderLineItem)
		.values([
			{
				id: ELI(50),
				orderId: ORDER_EXT.e9,
				productId: COMBO.duoSpecial,
				productNameSnapshot: "Duo Special",
				reportingCategorySnapshot: "Combo",
				quantity: 1,
				unitPrice: "5500",
				discount: "500",
				total: "5000",
				isComponent: false,
			},
		])
		.onConflictDoNothing();

	// GT-032 payment: cash for the discounted total
	await db
		.insert(schema.payment)
		.values({
			orderId: ORDER_EXT.e9,
			method: "cash",
			amount: "5000",
			tendered: "5000",
			changeGiven: "0",
			currency: "GYD",
			status: "completed",
		})
		.onConflictDoNothing();

	// GT-032 loyalty redemption transaction (links redeem to the order)
	await db
		.insert(schema.loyaltyTransaction)
		.values({
			id: LTXN(16),
			customerLoyaltyId: CLOY(7),
			orderId: ORDER_EXT.e9,
			type: "redeem",
			points: -500,
			description: "Redeemed 500 pts on Duo Special (GT-032)",
			createdAt: daysAgo(0, 13),
		})
		.onConflictDoNothing();

	// ── Stock Alerts ────────────────────────────────────────────────────────
	console.log("  -> Stock alerts (T8)");
	const SALERT = (n: number) =>
		`a4000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
	// Update snapper to low-stock qty (8 < reorderPoint 30) and beef to out-of-stock (0)
	await db.execute(
		sql`UPDATE inventory_stock SET quantity_on_hand = '8' WHERE inventory_item_id = ${INV_ITEM.snapper} AND location_id = ${LOC_ID}`,
	);
	await db.execute(
		sql`UPDATE inventory_stock SET quantity_on_hand = '0' WHERE inventory_item_id = ${INV_ITEM.beef} AND location_id = ${LOC_ID}`,
	);
	await db
		.insert(schema.stockAlert)
		.values([
			{
				// Snapper low stock — unacknowledged (visible in sidebar badge)
				id: SALERT(1),
				organizationId: ORG_ID,
				inventoryItemId: INV_ITEM.snapper,
				type: "low_stock",
				createdAt: daysAgo(1, 8),
			},
			{
				// Beef out of stock — unacknowledged
				id: SALERT(2),
				organizationId: ORG_ID,
				inventoryItemId: INV_ITEM.beef,
				type: "out_of_stock",
				createdAt: daysAgo(0, 9),
			},
			{
				// Garlic low stock — acknowledged (demonstrates acknowledged state)
				id: SALERT(3),
				organizationId: ORG_ID,
				inventoryItemId: INV_ITEM.garlic,
				type: "low_stock",
				acknowledgedBy: USER.admin,
				acknowledgedAt: daysAgo(2, 14),
				createdAt: daysAgo(3, 10),
			},
		])
		.onConflictDoNothing();

	// ── Recipe Ingredients ──────────────────────────────────────────────────
	console.log("  -> Recipe ingredients (T9)");
	const RINGR = (n: number) =>
		`a3000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
	await db
		.insert(schema.recipeIngredient)
		.values([
			// Curry Chicken: chicken + rice
			{
				id: RINGR(1),
				productId: PROD.curryChicken,
				inventoryItemId: INV_ITEM.chicken,
				quantity: "0.5000",
				unit: "lb",
			},
			{
				id: RINGR(2),
				productId: PROD.curryChicken,
				inventoryItemId: INV_ITEM.rice,
				quantity: "0.3000",
				unit: "lb",
			},
			// Curry Beef: beef + rice
			{
				id: RINGR(3),
				productId: PROD.curryBeef,
				inventoryItemId: INV_ITEM.beef,
				quantity: "0.5000",
				unit: "lb",
			},
			{
				id: RINGR(4),
				productId: PROD.curryBeef,
				inventoryItemId: INV_ITEM.rice,
				quantity: "0.3000",
				unit: "lb",
			},
			// Curry Snapper: snapper + rice
			{
				id: RINGR(5),
				productId: PROD.currySnapper,
				inventoryItemId: INV_ITEM.snapper,
				quantity: "0.5000",
				unit: "lb",
			},
			{
				id: RINGR(6),
				productId: PROD.currySnapper,
				inventoryItemId: INV_ITEM.rice,
				quantity: "0.3000",
				unit: "lb",
			},
			// Fried Rice / Baked Chicken: chicken + rice + oil
			{
				id: RINGR(7),
				productId: PROD.friedRiceBakedChicken,
				inventoryItemId: INV_ITEM.chicken,
				quantity: "0.4000",
				unit: "lb",
			},
			{
				id: RINGR(8),
				productId: PROD.friedRiceBakedChicken,
				inventoryItemId: INV_ITEM.rice,
				quantity: "0.5000",
				unit: "lb",
			},
			{
				id: RINGR(9),
				productId: PROD.friedRiceBakedChicken,
				inventoryItemId: INV_ITEM.oil,
				quantity: "0.0500",
				unit: "L",
			},
			// Sponge Cake: flour + sugar + oil
			{
				id: RINGR(10),
				productId: PROD.spongeCake,
				inventoryItemId: INV_ITEM.flour,
				quantity: "1.0000",
				unit: "cup",
			},
			{
				id: RINGR(11),
				productId: PROD.spongeCake,
				inventoryItemId: INV_ITEM.sugar,
				quantity: "0.5000",
				unit: "cup",
			},
			{
				id: RINGR(12),
				productId: PROD.spongeCake,
				inventoryItemId: INV_ITEM.oil,
				quantity: "0.2000",
				unit: "cup",
			},
			// Coconut Buns: flour + coconut + sugar
			{
				id: RINGR(13),
				productId: PROD.coconutBuns,
				inventoryItemId: INV_ITEM.flour,
				quantity: "2.0000",
				unit: "cup",
			},
			{
				id: RINGR(14),
				productId: PROD.coconutBuns,
				inventoryItemId: INV_ITEM.coconut,
				quantity: "0.5000",
				unit: "lb",
			},
			{
				id: RINGR(15),
				productId: PROD.coconutBuns,
				inventoryItemId: INV_ITEM.sugar,
				quantity: "0.3000",
				unit: "cup",
			},
			// Tamarind Juice: tamarind + water
			{
				id: RINGR(16),
				productId: PROD.tamarindJuice,
				inventoryItemId: INV_ITEM.tamarind,
				quantity: "0.1000",
				unit: "lb",
			},
			{
				id: RINGR(17),
				productId: PROD.tamarindJuice,
				inventoryItemId: INV_ITEM.water,
				quantity: "1.0000",
				unit: "L",
			},
		])
		.onConflictDoNothing();

	// ── Menu Schedule + Product Barcodes ───────────────────────────────────
	console.log("  -> Menu schedule + barcodes (T10)");
	const MSCH_ID = "ae000000-0000-4000-8000-000000000001";
	await db
		.insert(schema.menuSchedule)
		.values({
			id: MSCH_ID,
			organizationId: ORG_ID,
			name: "Lunch Special",
			startTime: "11:00",
			endTime: "14:00",
			daysOfWeek: "1,2,3,4,5", // Mon–Fri
			isActive: true,
		})
		.onConflictDoNothing();

	// Menu schedule products with lunch-discount overrides
	await db
		.insert(schema.menuScheduleProduct)
		.values([
			{
				menuScheduleId: MSCH_ID,
				productId: PROD.friedRiceBakedChicken,
				overridePrice: "1800",
			},
			{
				menuScheduleId: MSCH_ID,
				productId: PROD.chowmeinBakedChicken,
				overridePrice: "2200",
			},
			{
				menuScheduleId: MSCH_ID,
				productId: PROD.vegRice,
				overridePrice: "1200",
			},
		])
		.onConflictDoNothing();

	// Product barcodes: EAN-13 for beverages
	const PBAR = (n: number) =>
		`a2000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
	await db
		.insert(schema.productBarcode)
		.values([
			{
				id: PBAR(1),
				productId: PROD.drink1Lt,
				barcode: "4890008100309",
				format: "EAN13",
				isPrimary: true,
			},
			{
				id: PBAR(2),
				productId: PROD.drink12oz,
				barcode: "4890008100316",
				format: "EAN13",
				isPrimary: true,
			},
			{
				id: PBAR(3),
				productId: PROD.coke,
				barcode: "5449000000996",
				format: "EAN13",
				isPrimary: true,
			},
			{
				id: PBAR(4),
				productId: PROD.water,
				barcode: "5060432390057",
				format: "EAN13",
				isPrimary: true,
			},
			{
				id: PBAR(5),
				productId: PROD.vitaMalt,
				barcode: "4890008101078",
				format: "EAN13",
				isPrimary: true,
			},
			{
				id: PBAR(6),
				productId: PROD.xlEnergy,
				barcode: "4890008102198",
				format: "EAN13",
				isPrimary: true,
			},
		])
		.onConflictDoNothing();

	console.log("Seed complete!");
	process.exit(0);
}

seed().catch((e) => {
	console.error("Seed failed:", e);
	process.exit(1);
});
