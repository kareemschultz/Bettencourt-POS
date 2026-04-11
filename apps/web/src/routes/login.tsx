import { env } from "@Bettencourt-POS/env/web";
import { Delete, KeyRound, Mail } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

export default function LoginPage() {
	const navigate = useNavigate();
	const { data: session } = authClient.useSession();
	const [mode, setMode] = useState<"pin" | "email">("pin");

	useEffect(() => {
		if (session) {
			navigate("/dashboard");
		}
	}, [session, navigate]);

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
						<p className="text-[#D4A843]/70 text-lg italic">
							{"'A True Guyanese Gem'"}
						</p>
					</div>
					<div className="mt-4 max-w-md rounded-xl border border-[#D4A843]/20 bg-[#D4A843]/5 p-6">
						<p className="text-[#e8d5a8]/80 text-sm leading-relaxed">
							Enterprise Point of Sale system for managing registers, inventory,
							kitchen operations, and reporting across all Bettencourt&apos;s
							locations.
						</p>
					</div>
				</div>
			</div>

			{/* Right login panel */}
			<div className="flex w-full flex-col items-center justify-center px-6 py-12 lg:w-1/2 xl:w-[45%]">
				<div className="w-full max-w-md">
					{/* Mobile logo */}
					<div className="mb-6 flex flex-col items-center lg:hidden">
						<img
							src="/images/bettencourts-logo.png"
							alt="Bettencourt's Food Inc. logo"
							width={200}
							height={130}
						/>
						<h1 className="mt-2 text-balance font-bold text-foreground text-xl">
							{"Bettencourt's POS"}
						</h1>
					</div>

					{mode === "pin" ? (
						<PinLogin onSwitchToEmail={() => setMode("email")} />
					) : (
						<EmailLogin onSwitchToPin={() => setMode("pin")} />
					)}
				</div>
			</div>
		</div>
	);
}

function PinLogin({ onSwitchToEmail }: { onSwitchToEmail: () => void }) {
	const [pin, setPin] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);
	const [shake, setShake] = useState(false);

	const handleDigit = useCallback(
		(digit: string) => {
			setError("");
			setPin((prev) => {
				const next = prev + digit;
				if (next.length > 8) return prev;
				if (next.length >= 4) {
					submitPin(next);
				}
				return next;
			});
		},
		[submitPin],
	);

	const handleBackspace = useCallback(() => {
		setPin((prev) => prev.slice(0, -1));
		setError("");
	}, []);

	async function submitPin(code: string) {
		setLoading(true);
		setError("");
		try {
			const res = await fetch(`${env.VITE_SERVER_URL}/api/auth/pin-login`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				credentials: "include",
				body: JSON.stringify({ pin: code }),
			});

			if (!res.ok) {
				const data = await res.json().catch(() => ({ error: "Login failed" }));
				setError(data.error || "Invalid PIN");
				setPin("");
				setShake(true);
				setTimeout(() => setShake(false), 500);
				setLoading(false);
				return;
			}

			// Poll to confirm session
			for (let i = 0; i < 10; i++) {
				await new Promise((r) => setTimeout(r, 300));
				const check = await fetch(
					`${env.VITE_SERVER_URL}/api/auth/get-session`,
					{
						credentials: "include",
					},
				);
				if (check.ok) {
					const data = await check.json();
					if (data?.session) {
						window.location.href = "/dashboard";
						return;
					}
				}
			}
			window.location.href = "/dashboard";
		} catch {
			setError("Login failed. Please try again.");
			setPin("");
			setLoading(false);
		}
	}

	// Keyboard support
	useEffect(() => {
		function handleKeyDown(e: KeyboardEvent) {
			if (e.key >= "0" && e.key <= "9") {
				handleDigit(e.key);
			} else if (e.key === "Backspace") {
				handleBackspace();
			} else if (e.key === "Enter" && pin.length >= 4) {
				submitPin(pin);
			}
		}
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [handleDigit, handleBackspace, pin, submitPin]);

	const digits = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "back"];

	return (
		<div className="flex flex-col items-center gap-5">
			<div className="text-center lg:w-full lg:text-left">
				<h2 className="flex items-center gap-2 font-bold text-2xl text-foreground tracking-tight">
					<KeyRound className="size-6" /> Enter PIN
				</h2>
				<p className="mt-1 text-muted-foreground text-sm">
					Use your numeric code to sign in
				</p>
			</div>

			{/* PIN dots */}
			<div
				className={`flex items-center gap-3 py-4 ${shake ? "animate-shake" : ""}`}
			>
				{Array.from({ length: Math.max(4, pin.length) }, (_, i) => (
					<div
						key={i}
						className={`size-5 rounded-full transition-all ${
							i < pin.length
								? "scale-110 bg-primary shadow-md shadow-primary/30"
								: "border-2 border-muted-foreground/30 bg-transparent"
						}`}
					/>
				))}
			</div>

			{/* Error */}
			{error && (
				<p
					className="w-full rounded-md bg-destructive/10 px-3 py-2 text-center text-destructive text-sm"
					role="alert"
				>
					{error}
				</p>
			)}

			{/* Number pad */}
			<div className="grid w-full max-w-[280px] grid-cols-3 gap-3">
				{digits.map((d, i) => {
					if (d === "") return <div key={i} />;
					if (d === "back") {
						return (
							<Button
								key={i}
								variant="outline"
								className="h-16 text-lg"
								onClick={handleBackspace}
								disabled={pin.length === 0 || loading}
								aria-label="Backspace"
							>
								<Delete className="size-5" />
							</Button>
						);
					}
					return (
						<Button
							key={i}
							variant="outline"
							className="h-16 font-semibold text-2xl"
							onClick={() => handleDigit(d)}
							disabled={loading}
						>
							{d}
						</Button>
					);
				})}
			</div>

			{loading && (
				<p className="text-muted-foreground text-sm">Signing in...</p>
			)}

			{/* Admin login link */}
			<div className="mt-4 flex flex-col items-center gap-2">
				<button
					type="button"
					className="flex items-center gap-1.5 text-muted-foreground text-xs transition-colors hover:text-foreground"
					onClick={onSwitchToEmail}
				>
					<Mail className="size-3.5" /> Admin Login (Email)
				</button>
				<p className="text-[10px] text-muted-foreground/60">
					Default PIN: 1234
				</p>
			</div>
		</div>
	);
}

function EmailLogin({ onSwitchToPin }: { onSwitchToPin: () => void }) {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [showForgot, setShowForgot] = useState(false);

	async function handleLogin(e: React.FormEvent) {
		e.preventDefault();
		setLoading(true);
		setError("");
		try {
			const result = await authClient.signIn.email({ email, password });
			if (result.error) {
				setError(result.error.message || "Invalid credentials");
				setLoading(false);
			} else {
				window.location.href = "/dashboard";
			}
		} catch {
			setError("Login failed. Please try again.");
			setLoading(false);
		}
	}

	if (showForgot) {
		return <ForgotPassword onBack={() => setShowForgot(false)} />;
	}

	return (
		<div className="flex flex-col gap-5">
			<div>
				<h2 className="flex items-center gap-2 font-bold text-2xl text-foreground tracking-tight">
					<Mail className="size-6" /> Admin Login
				</h2>
				<p className="mt-1 text-muted-foreground text-sm">
					Sign in with email and password
				</p>
			</div>

			<form onSubmit={handleLogin} className="flex flex-col gap-5">
				<div className="flex flex-col gap-2">
					<Label htmlFor="email" className="font-medium text-sm">
						Email address
					</Label>
					<Input
						id="email"
						type="email"
						placeholder="admin@bettencourt.com"
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						required
						autoComplete="email"
						className="h-12 text-base lg:h-11 lg:text-sm"
					/>
				</div>
				<div className="flex flex-col gap-2">
					<div className="flex items-center justify-between">
						<Label htmlFor="password" className="font-medium text-sm">
							Password
						</Label>
						<button
							type="button"
							className="text-muted-foreground text-xs transition-colors hover:text-foreground"
							onClick={() => setShowForgot(true)}
						>
							Forgot password?
						</button>
					</div>
					<Input
						id="password"
						type="password"
						placeholder="Enter your password"
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						required
						autoComplete="current-password"
						className="h-12 text-base lg:h-11 lg:text-sm"
					/>
				</div>
				{error && (
					<p
						className="rounded-md bg-destructive/10 px-3 py-2 text-destructive text-sm"
						role="alert"
					>
						{error}
					</p>
				)}
				<Button
					type="submit"
					className="h-12 w-full font-semibold text-base lg:h-11 lg:text-sm"
					disabled={loading}
				>
					{loading ? "Signing in..." : "Sign in"}
				</Button>
			</form>

			<button
				type="button"
				className="flex items-center justify-center gap-1.5 text-muted-foreground text-xs transition-colors hover:text-foreground"
				onClick={onSwitchToPin}
			>
				<KeyRound className="size-3.5" /> Switch to PIN Login
			</button>
		</div>
	);
}

function ForgotPassword({ onBack }: { onBack: () => void }) {
	const [email, setEmail] = useState("");
	const [loading, setLoading] = useState(false);
	const [sent, setSent] = useState(false);
	const [error, setError] = useState("");

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setLoading(true);
		setError("");
		try {
			// Better Auth's forget-password endpoint sends the reset email
			const res = await fetch(
				`${env.VITE_SERVER_URL}/api/auth/forget-password`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					credentials: "include",
					body: JSON.stringify({
						email,
						redirectTo: `${window.location.origin}/reset-password`,
					}),
				},
			);
			if (!res.ok) {
				const data = await res.json().catch(() => ({}));
				setError(
					(data as { message?: string }).message ||
						"Failed to send reset email",
				);
				setLoading(false);
			} else {
				setSent(true);
				setLoading(false);
			}
		} catch {
			setError("Failed to send reset email. Please try again.");
			setLoading(false);
		}
	}

	if (sent) {
		return (
			<div className="flex flex-col gap-5">
				<div>
					<h2 className="font-bold text-2xl text-foreground tracking-tight">
						Check Your Email
					</h2>
					<p className="mt-2 text-muted-foreground text-sm">
						If an account exists for <strong>{email}</strong>, a password reset
						link has been sent. Check your inbox and follow the instructions.
					</p>
				</div>
				<p className="text-muted-foreground text-xs">
					The link expires in 1 hour. If you do not receive the email, check
					your spam folder or contact your administrator.
				</p>
				<button
					type="button"
					className="flex items-center justify-center gap-1.5 text-muted-foreground text-xs transition-colors hover:text-foreground"
					onClick={onBack}
				>
					← Back to Login
				</button>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-5">
			<div>
				<h2 className="font-bold text-2xl text-foreground tracking-tight">
					Reset Password
				</h2>
				<p className="mt-1 text-muted-foreground text-sm">
					Enter your email address and we will send you a reset link.
				</p>
			</div>
			<form onSubmit={handleSubmit} className="flex flex-col gap-4">
				<div className="flex flex-col gap-2">
					<Label htmlFor="forgot-email">Email address</Label>
					<Input
						id="forgot-email"
						type="email"
						placeholder="admin@bettencourt.com"
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						required
						autoComplete="email"
						className="h-12 text-base lg:h-11 lg:text-sm"
					/>
				</div>
				{error && (
					<p
						className="rounded-md bg-destructive/10 px-3 py-2 text-destructive text-sm"
						role="alert"
					>
						{error}
					</p>
				)}
				<Button
					type="submit"
					className="h-12 w-full font-semibold"
					disabled={loading || !email}
				>
					{loading ? "Sending..." : "Send Reset Link"}
				</Button>
			</form>
			<button
				type="button"
				className="flex items-center justify-center gap-1.5 text-muted-foreground text-xs transition-colors hover:text-foreground"
				onClick={onBack}
			>
				← Back to Login
			</button>
		</div>
	);
}
