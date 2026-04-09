import { useQuery } from "@tanstack/react-query";
import {
	createContext,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import {
	Link,
	Outlet,
	useLocation,
	useNavigate,
	useOutletContext,
} from "react-router";
import { PinLockScreen } from "@/components/auth/pin-lock-screen";
import { LanguageSwitcher } from "@/components/language-switcher";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { CommandPalette } from "@/components/layout/command-palette";
import { SyncIndicator } from "@/components/layout/sync-indicator";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { authClient } from "@/lib/auth-client";
import { getOnlineStatus } from "@/lib/offline";
import { getActiveModule, PAGE_TITLES } from "@/lib/modules";
import { hasRouteAccess } from "@/lib/route-access";
import type { AppUser } from "@/lib/types";
import {
	getRoleDefaultWorkspaceRoute,
	getSavedWorkspaceRoute,
	roleNameToSidebarRole,
	type SidebarRole,
	type WorkspaceRoute,
} from "@/lib/workspace-preferences";
import { orpc } from "@/utils/orpc";

function getPageTitle(pathname: string): string {
	// Exact match first
	if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
	// Match by prefix (e.g. /dashboard/orders/123 → Orders)
	for (const [path, title] of Object.entries(PAGE_TITLES)) {
		if (pathname.startsWith(`${path}/`)) return title;
	}
	return "Dashboard";
}

// ── Location context ─────────────────────────────────────────────────
export interface LocationContextValue {
	locationId: string | null;
	locationName: string | null;
	setLocationId: (id: string) => void;
}

export const LocationContext = createContext<LocationContextValue>({
	locationId: null,
	locationName: null,
	setLocationId: () => {},
});

/** Hook for child routes to access the selected location via Outlet context */
export function useLocationContext() {
	return useOutletContext<LocationContextValue>();
}

const LOCATION_STORAGE_KEY = "bettencourt-selected-location";

const AUTO_LOCK_MS = 5 * 60 * 1000; // 5 minutes of inactivity

// ── Route permission map ──────────────────────────────────────────────
// Maps URL path prefixes to the permission module required to access them.
// Routes not listed here are accessible to all authenticated users.

/**
 * Map the custom role name from the DB to a sidebar role identifier.
 * Sidebar nav items use these identifiers in their `roles` arrays.
 */
export function mapRoleToSidebarRole(roleName: string): SidebarRole {
	return roleNameToSidebarRole(roleName);
}

export default function DashboardLayout() {
	const { data: session, isPending } = authClient.useSession();
	const navigate = useNavigate();
	const { pathname } = useLocation();
	const [locked, setLocked] = useState(false);
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const landingAppliedRef = useRef(false);

	// Fetch the current user's role and permissions from the DB
	const { data: userProfile, isLoading: loadingProfile } = useQuery(
		orpc.settings.getCurrentUser.queryOptions({ input: {} }),
	);

	// Cache pinHash locally so the PIN lock screen can verify offline
	useEffect(() => {
		if (userProfile?.pinHash) {
			try { localStorage.setItem("pos-pin-hash", userProfile.pinHash); } catch {}
		}
	}, [userProfile?.pinHash]);

	// Fetch all locations for the switcher
	const { data: locations = [] } = useQuery(
		orpc.locations.listLocations.queryOptions({ input: {} }),
	);

	// Selected location with localStorage persistence
	const [selectedLocationId, setSelectedLocationId] = useState<string | null>(
		() => {
			try {
				return localStorage.getItem(LOCATION_STORAGE_KEY);
			} catch {
				return null;
			}
		},
	);

	// Auto-select first active location if none selected or selection is invalid
	useEffect(() => {
		if (locations.length === 0) return;
		const activeLocations = locations.filter((l) => l.isActive);
		if (activeLocations.length === 0) return;

		const currentValid = activeLocations.some(
			(l) => l.id === selectedLocationId,
		);
		if (!currentValid) {
			const firstId = activeLocations[0]?.id;
			setSelectedLocationId(firstId);
			try {
				localStorage.setItem(LOCATION_STORAGE_KEY, firstId);
			} catch {}
		}
	}, [locations, selectedLocationId]);

	const handleLocationChange = useCallback((id: string) => {
		setSelectedLocationId(id);
		try {
			localStorage.setItem(LOCATION_STORAGE_KEY, id);
		} catch {}
	}, []);

	const selectedLocation = locations.find((l) => l.id === selectedLocationId);

	const locationContext: LocationContextValue = useMemo(
		() => ({
			locationId: selectedLocationId,
			locationName: selectedLocation?.name ?? null,
			setLocationId: handleLocationChange,
		}),
		[selectedLocationId, selectedLocation?.name, handleLocationChange],
	);

	useEffect(() => {
		// Only redirect to login when we're online — if offline, the cached session
		// may still be loading. Redirecting offline just shows a broken login page.
		if (!session && !isPending && getOnlineStatus()) {
			navigate("/login");
		}
	}, [session, isPending, navigate]);

	// Auto-lock on inactivity
	const resetTimer = useCallback(() => {
		if (timerRef.current) clearTimeout(timerRef.current);
		timerRef.current = setTimeout(() => setLocked(true), AUTO_LOCK_MS);
	}, []);

	useEffect(() => {
		const events = ["mousedown", "keydown", "touchstart", "scroll"];
		const handler = () => resetTimer();
		for (const e of events) window.addEventListener(e, handler);
		resetTimer();
		return () => {
			for (const e of events) window.removeEventListener(e, handler);
			if (timerRef.current) clearTimeout(timerRef.current);
		};
	}, [resetTimer]);

	// Build the AppUser from the API response (memoized to keep a stable ref)
	const user: AppUser | null = useMemo(() => {
		if (!session) return null;
		if (!userProfile) return null;

		return {
			id: session.user.id,
			name: userProfile.name,
			email: userProfile.email,
			role: mapRoleToSidebarRole(userProfile.roleName),
			organization_id: userProfile.organizationId ?? null,
			location_id: selectedLocationId ?? null,
			custom_role_id: userProfile.roleId,
			permissions: userProfile.permissions,
		};
	}, [session, userProfile, selectedLocationId]);

	const resolvedLandingRoute = useMemo<WorkspaceRoute>(() => {
		if (!user) return "/dashboard";
		const saved = getSavedWorkspaceRoute();
		if (saved && hasRouteAccess(saved, user.permissions)) return saved;
		const roleDefault = getRoleDefaultWorkspaceRoute(
			roleNameToSidebarRole(user.role),
		);
		if (hasRouteAccess(roleDefault, user.permissions)) return roleDefault;
		return "/dashboard";
	}, [user]);

	useEffect(() => {
		if (!user || pathname !== "/dashboard" || landingAppliedRef.current) return;
		landingAppliedRef.current = true;
		if (resolvedLandingRoute !== "/dashboard") {
			navigate(resolvedLandingRoute, { replace: true });
		}
	}, [navigate, pathname, resolvedLandingRoute, user]);

	if (isPending || loadingProfile) {
		return (
			<div className="flex h-svh flex-col">
				<div className="flex h-14 items-center gap-2 border-b px-4">
					<Skeleton className="h-6 w-6" />
					<Skeleton className="h-4 w-32" />
				</div>
				<div className="flex flex-1">
					<Skeleton className="h-full w-64" />
					<div className="flex flex-1 flex-col gap-4 p-6">
						<Skeleton className="h-8 w-48" />
						<div className="grid grid-cols-4 gap-4">
							{Array.from({ length: 4 }).map((_, i) => (
								<Skeleton key={i} className="h-24 rounded-lg" />
							))}
						</div>
						<Skeleton className="h-64 rounded-lg" />
					</div>
				</div>
			</div>
		);
	}

	if (!session || !user) {
		// Offline with no cached session — show a clear message instead of a blank screen
		if (!getOnlineStatus()) {
			return (
				<div className="flex h-svh flex-col items-center justify-center gap-4 p-8 text-center">
					<img
						src="/images/bettencourts-logo.png"
						alt="Bettencourt's"
						className="h-16 w-16 object-contain opacity-60"
					/>
					<h1 className="font-bold text-xl">You're offline</h1>
					<p className="max-w-xs text-muted-foreground text-sm">
						Connect to the internet to sign in. Once logged in, the POS will
						continue working through brief outages.
					</p>
				</div>
			);
		}
		return null;
	}

	if (locked) {
		return (
			<PinLockScreen
				userName={user.name}
				onUnlock={() => {
					setLocked(false);
					resetTimer();
				}}
			/>
		);
	}

	return (
		<SidebarProvider>
			<CommandPalette user={user} />
			<AppSidebar user={user} />
			<SidebarInset>
				<header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/60 sm:px-4">
					<SidebarTrigger className="-ml-1" />
					<Separator orientation="vertical" className="mr-2 h-4" />
					<nav
						className="hidden items-center gap-1 text-sm sm:flex"
						aria-label="Breadcrumb"
					>
						{(() => {
							const activeModule = getActiveModule(pathname);
							const pageTitle = getPageTitle(pathname);
							if (activeModule && pathname !== "/dashboard") {
								return (
									<>
										<Link
											to={activeModule.defaultUrl}
											className="text-muted-foreground hover:text-foreground"
										>
											{activeModule.label}
										</Link>
										<span className="text-muted-foreground">/</span>
										<span className="font-medium">{pageTitle}</span>
									</>
								);
							}
							return <span className="font-medium">{pageTitle}</span>;
						})()}
					</nav>
					<Separator orientation="vertical" className="hidden h-4 sm:block" />
					<div className="flex flex-1 items-center gap-2">
						{locations.filter((l) => l.isActive).length > 0 ? (
							<Select
								value={selectedLocationId ?? undefined}
								onValueChange={handleLocationChange}
							>
								<SelectTrigger className="h-8 w-[180px] border-none bg-transparent text-muted-foreground text-sm shadow-none focus:ring-0">
									<SelectValue placeholder="Select location" />
								</SelectTrigger>
								<SelectContent>
									{locations
										.filter((l) => l.isActive)
										.map((loc) => (
											<SelectItem key={loc.id} value={loc.id}>
												{loc.name}
											</SelectItem>
										))}
								</SelectContent>
							</Select>
						) : (
							<span className="text-muted-foreground text-sm">
								No locations
							</span>
						)}
					</div>
					<LanguageSwitcher />
					<SyncIndicator />
				</header>
				<main className="flex-1 overflow-auto">
					<LocationContext.Provider value={locationContext}>
						{hasRouteAccess(pathname, user.permissions) ? (
							<Outlet context={locationContext} />
						) : (
							<div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
								<div className="font-bold text-4xl text-destructive">403</div>
								<h1 className="font-semibold text-xl">Access Denied</h1>
								<p className="text-muted-foreground text-sm">
									You do not have permission to view this page.
								</p>
								<Link
									to="/dashboard"
									className="text-primary text-sm underline underline-offset-4"
								>
									Return to Dashboard
								</Link>
							</div>
						)}
					</LocationContext.Provider>
				</main>
			</SidebarInset>
		</SidebarProvider>
	);
}
