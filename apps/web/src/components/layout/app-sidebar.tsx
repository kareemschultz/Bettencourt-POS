import { useQuery } from "@tanstack/react-query";
import {
	ArrowLeft,
	ChevronDown,
	ChevronUp,
	LogOut,
	Search,
	User,
} from "lucide-react";
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuBadge,
	SidebarMenuButton,
	SidebarMenuItem,
	useSidebar,
} from "@/components/ui/sidebar";
import { signOut } from "@/lib/auth-client";
import {
	canSeeItem,
	canSeeModule,
	getActiveModule,
	MODULES,
	type NavItem,
} from "@/lib/modules";
import type { AppUser } from "@/lib/types";
import { orpc } from "@/utils/orpc";

interface AppSidebarProps {
	user: AppUser;
	organizationName?: string;
	organizationSubtitle?: string;
}

export function AppSidebar({
	user,
	organizationName = "Bettencourt's",
	organizationSubtitle = "Food Inc.",
}: AppSidebarProps) {
	const location = useLocation();
	const pathname = location.pathname;
	const navigate = useNavigate();
	const [search, setSearch] = useState("");
	const { state: sidebarState } = useSidebar();

	const canReadInventory =
		Array.isArray(user.permissions?.inventory) &&
		user.permissions.inventory.includes("read");

	const { data: alertData } = useQuery({
		...orpc.inventory.getAlerts.queryOptions({
			input: {
				organizationId: user.organization_id ?? "",
				unacknowledgedOnly: true,
			},
		}),
		enabled: !!user.organization_id && canReadInventory,
		refetchInterval: 60_000,
	});
	const unacknowledgedAlertCount = alertData?.length ?? 0;

	const activeModule = getActiveModule(pathname);

	async function handleSignOut() {
		await signOut();
		window.location.href = "/login";
	}

	function renderNavGroup(label: string, items: NavItem[]) {
		const query = search.trim().toLowerCase();
		const filtered = items.filter(
			(item) =>
				!item.hidden &&
				canSeeItem(user, item) &&
				(query === "" || item.title.toLowerCase().includes(query)),
		);
		if (filtered.length === 0) return null;

		// In icon mode the sidebar collapses to icons — force groups open so
		// icons remain visible even if the user previously collapsed a group.
		const forceOpen = sidebarState === "collapsed";

		return (
			<SidebarGroup key={label}>
				<Collapsible
					defaultOpen
					{...(forceOpen ? { open: true } : {})}
					className="group/collapsible"
				>
					<SidebarGroupLabel asChild>
						<CollapsibleTrigger className="w-full">
							{label}
							<ChevronDown className="ml-auto size-3.5 transition-transform duration-200 group-data-[collapsible=icon]:hidden group-data-[state=open]/collapsible:rotate-180" />
						</CollapsibleTrigger>
					</SidebarGroupLabel>
					<CollapsibleContent>
						<SidebarGroupContent>
							<SidebarMenu>
								{filtered.map((item) => (
									<SidebarMenuItem key={item.url}>
										<SidebarMenuButton
											asChild
											isActive={
												pathname === item.url ||
												pathname + location.search === item.url
											}
											tooltip={item.title}
										>
											<Link to={item.url}>
												<item.icon className="size-4" />
												<span>{item.title}</span>
											</Link>
										</SidebarMenuButton>
										{item.url === "/dashboard/stock-alerts" &&
											unacknowledgedAlertCount > 0 && (
												<SidebarMenuBadge>
													{unacknowledgedAlertCount}
												</SidebarMenuBadge>
											)}
									</SidebarMenuItem>
								))}
							</SidebarMenu>
						</SidebarGroupContent>
					</CollapsibleContent>
				</Collapsible>
			</SidebarGroup>
		);
	}

	return (
		<Sidebar collapsible="icon">
			<SidebarHeader>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton size="lg" asChild className="h-auto py-2">
							<Link to="/dashboard">
								<div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md">
									<img
										src="/images/bettencourts-logo.png"
										alt="Bettencourt's logo"
										width={40}
										height={40}
										className="object-contain"
									/>
								</div>
								<div className="flex flex-col gap-0.5 leading-none">
									<span className="font-semibold">{organizationName}</span>
									<span className="text-sidebar-muted-foreground text-xs">
										{organizationSubtitle}
									</span>
								</div>
							</Link>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
				<div className="relative px-2 pb-1 group-data-[collapsible=icon]:hidden">
					<Search className="absolute top-1/2 left-4 size-3.5 -translate-y-1/2 text-muted-foreground" />
					<Input
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						placeholder="Search... (Ctrl/Cmd+K)"
						className="h-8 pl-7 text-sm"
						aria-label="Search navigation"
					/>
				</div>
			</SidebarHeader>
			<SidebarContent>
				{activeModule ? (
					// Contextual: show only the current module's items + back link
					<>
						<SidebarGroup>
							<SidebarGroupLabel asChild>
								<Link
									to="/dashboard"
									className="flex items-center gap-1.5 text-xs hover:text-foreground group-data-[collapsible=icon]:hidden"
								>
									<ArrowLeft className="size-3" />
									All Modules
								</Link>
							</SidebarGroupLabel>
						</SidebarGroup>
						{renderNavGroup(activeModule.label, activeModule.items)}
					</>
				) : (
					// Default: show all modules as collapsible groups (filtered by role)
					MODULES.filter((m) => canSeeModule(user, m)).map((mod) =>
						renderNavGroup(mod.label, mod.items),
					)
				)}
			</SidebarContent>
			<SidebarFooter>
				<SidebarMenu>
					<SidebarMenuItem>
						<DropdownMenu>
							<DropdownMenuTrigger>
								<div className="flex h-12 w-full cursor-pointer items-center gap-2 overflow-hidden rounded-md px-2 py-2 text-left text-sm outline-none ring-sidebar-ring transition-[width,height,padding] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground">
									<div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
										<User className="size-4" />
									</div>
									<div className="flex flex-col gap-0.5 leading-none">
										<span className="font-medium text-sm">{user.name}</span>
										<span className="text-sidebar-muted-foreground text-xs capitalize">
											{user.role}
										</span>
									</div>
									<ChevronUp className="ml-auto size-4" />
								</div>
							</DropdownMenuTrigger>
							<DropdownMenuContent side="top" align="start" className="w-56">
								<DropdownMenuItem
									onClick={() => navigate("/dashboard/profile")}
								>
									<User className="mr-2 size-4" />
									My Profile
								</DropdownMenuItem>
								<DropdownMenuSeparator />
								<DropdownMenuItem onClick={handleSignOut}>
									<LogOut className="mr-2 size-4" />
									Sign out
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarFooter>
		</Sidebar>
	);
}
