import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	Check,
	KeyRound,
	Laptop,
	Loader2,
	LogOut,
	Monitor,
	Smartphone,
	User,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { orpc } from "@/utils/orpc";

// Password strength: 0-4 score based on criteria met
function passwordStrength(pw: string): number {
	let score = 0;
	if (pw.length >= 8) score++;
	if (pw.length >= 12) score++;
	if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
	if (/\d/.test(pw)) score++;
	if (/[^A-Za-z0-9]/.test(pw)) score++;
	return score;
}

const STRENGTH_LABELS = ["Very Weak", "Weak", "Fair", "Good", "Strong"];
const STRENGTH_COLORS = [
	"bg-destructive",
	"bg-orange-500",
	"bg-yellow-500",
	"bg-blue-500",
	"bg-green-500",
];

function StrengthMeter({ password }: { password: string }) {
	if (!password) return null;
	const score = passwordStrength(password);
	return (
		<div className="space-y-1">
			<div className="flex gap-1">
				{[0, 1, 2, 3, 4].map((i) => (
					<div
						key={i}
						className={`h-1.5 flex-1 rounded-full transition-colors ${i < score ? STRENGTH_COLORS[score - 1] : "bg-muted"}`}
					/>
				))}
			</div>
			<p className="text-muted-foreground text-xs">{STRENGTH_LABELS[Math.max(0, score - 1)]}</p>
		</div>
	);
}

// Detect a session type from userAgent string
function deviceIcon(ua: string | null) {
	if (!ua) return <Monitor className="size-4" />;
	const lower = ua.toLowerCase();
	if (/mobile|android|iphone/.test(lower)) return <Smartphone className="size-4" />;
	if (/tablet|ipad/.test(lower)) return <Laptop className="size-4" />;
	return <Monitor className="size-4" />;
}

function browserName(ua: string | null): string {
	if (!ua) return "Unknown browser";
	if (/chrome/i.test(ua) && !/edge|edg/i.test(ua)) return "Chrome";
	if (/firefox/i.test(ua)) return "Firefox";
	if (/safari/i.test(ua) && !/chrome/i.test(ua)) return "Safari";
	if (/edge|edg/i.test(ua)) return "Edge";
	if (/opera|opr/i.test(ua)) return "Opera";
	return "Browser";
}

export default function ProfilePage() {
	const queryClient = useQueryClient();

	// Password change form
	const [currentPw, setCurrentPw] = useState("");
	const [newPw, setNewPw] = useState("");
	const [confirmPw, setConfirmPw] = useState("");

	// PIN form
	const [newPin, setNewPin] = useState("");
	const [confirmPin, setConfirmPin] = useState("");

	// Revoke all other sessions confirmation
	const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);

	const { data: currentUser, isLoading: userLoading } = useQuery(
		orpc.settings.getCurrentUser.queryOptions({ input: {} }),
	);

	const { data: sessions = [], isLoading: sessionsLoading } = useQuery(
		orpc.settings.getOwnSessions.queryOptions({ input: {} }),
	);

	const sessionsKey = orpc.settings.getOwnSessions.queryOptions({ input: {} }).queryKey;

	const changePassword = useMutation(
		orpc.settings.changeOwnPassword.mutationOptions({
			onSuccess: () => {
				setCurrentPw(""); setNewPw(""); setConfirmPw("");
				toast.success("Password updated successfully");
			},
			onError: (err) => toast.error(err.message || "Failed to update password"),
		}),
	);

	const changePin = useMutation(
		orpc.settings.changeOwnPin.mutationOptions({
			onSuccess: () => {
				setNewPin(""); setConfirmPin("");
				toast.success("PIN updated successfully");
			},
			onError: (err) => toast.error(err.message || "Failed to update PIN"),
		}),
	);

	const revokeSessions = useMutation(
		orpc.settings.revokeOtherSessions.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: sessionsKey });
				setRevokeDialogOpen(false);
				toast.success("All other sessions signed out");
			},
			onError: (err) => toast.error(err.message || "Failed to revoke sessions"),
		}),
	);

	const canSubmitPassword =
		currentPw.length > 0 &&
		newPw.length >= 8 &&
		newPw === confirmPw &&
		!changePassword.isPending;

	const canSubmitPin =
		newPin.length >= 4 &&
		newPin === confirmPin &&
		!changePin.isPending;

	return (
		<div className="space-y-6 p-4 md:p-6">
			{/* Header */}
			<div>
				<h1 className="flex items-center gap-2 font-bold text-2xl tracking-tight">
					<User className="size-6 text-primary" /> My Profile
				</h1>
				<p className="text-muted-foreground text-sm">
					Manage your password, PIN, and active sessions.
				</p>
			</div>

			{/* Identity card */}
			<Card>
				<CardHeader>
					<CardTitle>Account</CardTitle>
				</CardHeader>
				<CardContent>
					{userLoading ? (
						<div className="space-y-2">
							<Skeleton className="h-5 w-48" />
							<Skeleton className="h-4 w-64" />
						</div>
					) : (
						<div className="space-y-1">
							<p className="font-semibold text-lg">{currentUser?.name}</p>
							<p className="text-muted-foreground text-sm">{currentUser?.email}</p>
							{currentUser?.roleName && (
								<Badge variant="outline" className="mt-1">{currentUser.roleName}</Badge>
							)}
						</div>
					)}
				</CardContent>
			</Card>

			{/* Change Password */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<KeyRound className="size-4" /> Change Password
					</CardTitle>
					<CardDescription>Minimum 8 characters. Use a strong, unique password.</CardDescription>
				</CardHeader>
				<CardContent>
					<form
						onSubmit={(e) => {
							e.preventDefault();
							if (newPw !== confirmPw) { toast.error("Passwords do not match"); return; }
							changePassword.mutate({ currentPassword: currentPw, newPassword: newPw });
						}}
						className="space-y-4 max-w-sm"
					>
						<div className="space-y-1.5">
							<Label htmlFor="current-pw">Current Password</Label>
							<Input
								id="current-pw"
								type="password"
								value={currentPw}
								onChange={(e) => setCurrentPw(e.target.value)}
								autoComplete="current-password"
							/>
						</div>
						<div className="space-y-1.5">
							<Label htmlFor="new-pw">New Password</Label>
							<Input
								id="new-pw"
								type="password"
								value={newPw}
								onChange={(e) => setNewPw(e.target.value)}
								autoComplete="new-password"
							/>
							<StrengthMeter password={newPw} />
						</div>
						<div className="space-y-1.5">
							<Label htmlFor="confirm-pw">Confirm New Password</Label>
							<Input
								id="confirm-pw"
								type="password"
								value={confirmPw}
								onChange={(e) => setConfirmPw(e.target.value)}
								autoComplete="new-password"
							/>
							{confirmPw && newPw !== confirmPw && (
								<p className="text-destructive text-xs">Passwords do not match</p>
							)}
							{confirmPw && newPw === confirmPw && (
								<p className="flex items-center gap-1 text-green-600 text-xs">
									<Check className="size-3" /> Passwords match
								</p>
							)}
						</div>
						<Button type="submit" disabled={!canSubmitPassword}>
							{changePassword.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
							Update Password
						</Button>
					</form>
				</CardContent>
			</Card>

			{/* Change PIN */}
			<Card>
				<CardHeader>
					<CardTitle>POS PIN</CardTitle>
					<CardDescription>
						4–6 digit PIN used for quick login on the cashier screen.
						Leave blank to remove your PIN.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<form
						onSubmit={(e) => {
							e.preventDefault();
							if (newPin && newPin !== confirmPin) { toast.error("PINs do not match"); return; }
							changePin.mutate({ pin: newPin || null });
						}}
						className="space-y-4 max-w-sm"
					>
						<div className="space-y-1.5">
							<Label htmlFor="new-pin">New PIN</Label>
							<Input
								id="new-pin"
								type="password"
								inputMode="numeric"
								maxLength={6}
								placeholder="4–6 digits, or blank to remove"
								value={newPin}
								onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
							/>
						</div>
						<div className="space-y-1.5">
							<Label htmlFor="confirm-pin">Confirm PIN</Label>
							<Input
								id="confirm-pin"
								type="password"
								inputMode="numeric"
								maxLength={6}
								placeholder="Re-enter PIN"
								value={confirmPin}
								onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
							/>
							{newPin && confirmPin && newPin !== confirmPin && (
								<p className="text-destructive text-xs">PINs do not match</p>
							)}
						</div>
						<Button type="submit" disabled={!canSubmitPin}>
							{changePin.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
							{newPin ? "Update PIN" : "Remove PIN"}
						</Button>
					</form>
				</CardContent>
			</Card>

			{/* Active Sessions */}
			<Card>
				<CardHeader className="flex flex-row items-center justify-between">
					<div>
						<CardTitle>Active Sessions</CardTitle>
						<CardDescription>Devices currently signed in to your account.</CardDescription>
					</div>
					{sessions.filter((s) => !(s as { isCurrent?: boolean }).isCurrent).length > 0 && (
						<Button
							variant="outline"
							size="sm"
							className="gap-1.5 text-destructive hover:text-destructive"
							onClick={() => setRevokeDialogOpen(true)}
						>
							<LogOut className="size-3.5" /> Sign Out All Others
						</Button>
					)}
				</CardHeader>
				<CardContent>
					{sessionsLoading ? (
						<div className="space-y-3">
							{[1, 2].map((i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
						</div>
					) : sessions.length === 0 ? (
						<p className="text-muted-foreground text-sm">No active sessions found.</p>
					) : (
						<div className="space-y-2">
							{sessions.map((s) => {
								const session = s as {
									id: string;
									isCurrent?: boolean;
									userAgent: string | null;
									ipAddress: string | null;
									updatedAt: Date | string | null;
								};
								return (
									<div
										key={session.id}
										className={`flex items-center gap-3 rounded-lg border p-3 ${session.isCurrent ? "border-primary/30 bg-primary/5" : ""}`}
									>
										<div className="text-muted-foreground">
											{deviceIcon(session.userAgent)}
										</div>
										<div className="flex-1 min-w-0">
											<p className="text-sm font-medium flex items-center gap-2">
												{browserName(session.userAgent)}
												{session.isCurrent && (
													<Badge variant="secondary" className="text-xs">This device</Badge>
												)}
											</p>
											<p className="text-muted-foreground text-xs truncate">
												{session.ipAddress ?? "Unknown IP"} · Last active{" "}
												{session.updatedAt
													? new Date(session.updatedAt).toLocaleDateString("en-GY", {
															timeZone: "America/Guyana",
															day: "2-digit",
															month: "short",
															year: "numeric",
														})
													: "—"}
											</p>
										</div>
									</div>
								);
							})}
						</div>
					)}
				</CardContent>
			</Card>

			{/* Revoke all other sessions confirmation */}
			<AlertDialog open={revokeDialogOpen} onOpenChange={setRevokeDialogOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Sign out all other sessions?</AlertDialogTitle>
						<AlertDialogDescription>
							This will sign out all devices except the one you are using right now.
							Anyone using your account on another device will need to log in again.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
							onClick={() => revokeSessions.mutate({})}
						>
							{revokeSessions.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
							Sign Out Others
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
