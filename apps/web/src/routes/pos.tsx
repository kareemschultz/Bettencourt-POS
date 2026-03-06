import { useQuery } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { useEffect } from "react";
import { useNavigate } from "react-router";
import { POSTerminal } from "@/components/pos/pos-terminal";
import { Button } from "@/components/ui/button";
import { authClient, signOut } from "@/lib/auth-client";
import { orpc } from "@/utils/orpc";

/**
 * Standalone cashier POS — no sidebar, full-screen terminal.
 * Designed for cashier-only accounts that don't need the full dashboard.
 */
export default function StandalonePosPage() {
	const navigate = useNavigate();
	const { data: session, isPending } = authClient.useSession();

	const { data: userProfile, isLoading: loadingProfile } = useQuery({
		...orpc.settings.getCurrentUser.queryOptions({ input: {} }),
		enabled: !!session,
	});

	// Fetch user's location from role assignment
	const { data: userRole } = useQuery({
		...orpc.settings.getRegisters.queryOptions({ input: {} }),
		enabled: !!session,
	});

	useEffect(() => {
		if (!isPending && !session) {
			navigate("/login");
		}
	}, [session, isPending, navigate]);

	async function handleSignOut() {
		await signOut();
		navigate("/login");
	}

	if (isPending || loadingProfile) {
		return (
			<div className="flex h-svh items-center justify-center">
				<div className="text-muted-foreground">Loading...</div>
			</div>
		);
	}

	if (!session) return null;

	const permissions = userProfile?.permissions ?? {};
	const locationId = session.user.id ? null : null; // resolved via POSTerminal's prop default

	return (
		<div className="flex h-svh flex-col">
			{/* Minimal header */}
			<header className="flex h-12 shrink-0 items-center justify-between border-b bg-background px-4">
				<div className="flex items-center gap-3">
					<img
						src="/images/bettencourts-logo.png"
						alt="Bettencourt's"
						width={28}
						height={28}
						className="rounded object-contain"
					/>
					<span className="font-semibold text-foreground text-sm">
						POS Terminal
					</span>
				</div>
				<div className="flex items-center gap-3">
					<span className="text-muted-foreground text-sm">
						{session.user.name}
					</span>
					<Button
						variant="ghost"
						size="sm"
						className="gap-1.5 text-muted-foreground"
						onClick={handleSignOut}
					>
						<LogOut className="size-4" />
						<span className="hidden sm:inline">Sign out</span>
					</Button>
				</div>
			</header>

			{/* Full-screen POS */}
			<div className="flex-1 overflow-hidden">
				<POSTerminal
					userId={session.user.id}
					userName={session.user.name || "Cashier"}
					locationId={locationId}
					userPermissions={permissions}
				/>
			</div>
		</div>
	);
}
