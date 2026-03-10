import { Check, KeyRound, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

// Same strength meter as the profile page (copy to avoid cross-route imports)
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
const STRENGTH_COLORS = ["bg-destructive", "bg-orange-500", "bg-yellow-500", "bg-blue-500", "bg-green-500"];

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

export default function ResetPasswordPage() {
	const [searchParams] = useSearchParams();
	const navigate = useNavigate();
	const token = searchParams.get("token") ?? "";

	const [newPassword, setNewPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [loading, setLoading] = useState(false);
	const [done, setDone] = useState(false);
	const [error, setError] = useState("");

	// Redirect to login if no token
	useEffect(() => {
		if (!token) {
			navigate("/login", { replace: true });
		}
	}, [token, navigate]);

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (newPassword !== confirmPassword) {
			setError("Passwords do not match");
			return;
		}
		if (newPassword.length < 8) {
			setError("Password must be at least 8 characters");
			return;
		}
		setLoading(true);
		setError("");
		try {
			const result = await authClient.resetPassword({
				newPassword,
				token,
			});
			if (result?.error) {
				setError(result.error.message || "Failed to reset password. The link may have expired.");
				setLoading(false);
			} else {
				setDone(true);
				setLoading(false);
				// Redirect to login after a short delay
				setTimeout(() => navigate("/login", { replace: true }), 3000);
			}
		} catch {
			setError("Failed to reset password. Please try again.");
			setLoading(false);
		}
	}

	if (!token) return null;

	return (
		<div className="flex min-h-dvh">
			{/* Left branded panel */}
			<div className="relative hidden flex-col items-center justify-center overflow-hidden bg-[#1a1a14] lg:flex lg:w-1/2 xl:w-[55%]">
				<div className="absolute inset-0 opacity-5">
					<div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-[#D4A843]" />
					<div className="absolute -right-24 bottom-12 h-72 w-72 rounded-full bg-[#D4A843]" />
				</div>
				<div className="relative z-10 flex flex-col items-center gap-6 px-12 text-center">
					<img
						src="/images/bettencourts-logo.png"
						alt="Bettencourt's Food Inc. logo"
						width={340}
						height={220}
						className="drop-shadow-2xl"
					/>
					<div className="mt-2 flex flex-col gap-2">
						<h1 className="text-balance font-bold text-3xl text-[#D4A843] tracking-tight">
							{"Bettencourt's Food Inc."}
						</h1>
						<p className="text-[#D4A843]/70 text-lg italic">{"'A True Guyanese Gem'"}</p>
					</div>
				</div>
			</div>

			{/* Right form panel */}
			<div className="flex w-full flex-col items-center justify-center px-6 py-12 lg:w-1/2 xl:w-[45%]">
				<div className="w-full max-w-md">
					{/* Mobile logo */}
					<div className="mb-6 flex flex-col items-center lg:hidden">
						<img src="/images/bettencourts-logo.png" alt="Bettencourt's Food Inc. logo" width={200} height={130} />
						<h1 className="mt-2 text-balance font-bold text-foreground text-xl">{"Bettencourt's POS"}</h1>
					</div>

					{done ? (
						<div className="flex flex-col gap-5">
							<div className="flex size-12 items-center justify-center rounded-full bg-green-500/10">
								<Check className="size-6 text-green-600" />
							</div>
							<div>
								<h2 className="font-bold text-2xl text-foreground tracking-tight">Password Reset</h2>
								<p className="mt-2 text-muted-foreground text-sm">
									Your password has been updated successfully. You will be redirected to the login page shortly.
								</p>
							</div>
							<Button onClick={() => navigate("/login", { replace: true })}>
								Go to Login
							</Button>
						</div>
					) : (
						<div className="flex flex-col gap-5">
							<div>
								<h2 className="flex items-center gap-2 font-bold text-2xl text-foreground tracking-tight">
									<KeyRound className="size-6" /> Set New Password
								</h2>
								<p className="mt-1 text-muted-foreground text-sm">
									Choose a strong password for your account.
								</p>
							</div>

							<form onSubmit={handleSubmit} className="flex flex-col gap-4">
								<div className="flex flex-col gap-2">
									<Label htmlFor="new-pw">New Password</Label>
									<Input
										id="new-pw"
										type="password"
										value={newPassword}
										onChange={(e) => setNewPassword(e.target.value)}
										required
										autoComplete="new-password"
										className="h-12 text-base lg:h-11 lg:text-sm"
										placeholder="At least 8 characters"
									/>
									<StrengthMeter password={newPassword} />
								</div>

								<div className="flex flex-col gap-2">
									<Label htmlFor="confirm-pw">Confirm Password</Label>
									<Input
										id="confirm-pw"
										type="password"
										value={confirmPassword}
										onChange={(e) => setConfirmPassword(e.target.value)}
										required
										autoComplete="new-password"
										className="h-12 text-base lg:h-11 lg:text-sm"
										placeholder="Re-enter your password"
									/>
									{confirmPassword && newPassword !== confirmPassword && (
										<p className="text-destructive text-xs">Passwords do not match</p>
									)}
								</div>

								{error && (
									<p className="rounded-md bg-destructive/10 px-3 py-2 text-destructive text-sm" role="alert">
										{error}
									</p>
								)}

								<Button
									type="submit"
									className="h-12 w-full font-semibold text-base lg:h-11 lg:text-sm"
									disabled={
										loading ||
										newPassword.length < 8 ||
										newPassword !== confirmPassword
									}
								>
									{loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
									{loading ? "Updating..." : "Update Password"}
								</Button>
							</form>

							<a
								href="/login"
								className="flex items-center justify-center gap-1.5 text-muted-foreground text-xs transition-colors hover:text-foreground"
							>
								← Back to Login
							</a>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
