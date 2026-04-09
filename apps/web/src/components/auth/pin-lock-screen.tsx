import { useMutation } from "@tanstack/react-query";
import { Delete, Lock, LogOut, WifiOff } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { getOnlineStatus } from "@/lib/offline";
import { orpc } from "@/utils/orpc";

interface PinLockScreenProps {
	userName: string;
	onUnlock: () => void;
}

export function PinLockScreen({ userName, onUnlock }: PinLockScreenProps) {
	const [pin, setPin] = useState("");
	const [error, setError] = useState("");
	const [shake, setShake] = useState(false);
	const [verifyingOffline, setVerifyingOffline] = useState(false);
	// Ref so the offline verify closure always sees the submitted value
	const pinRef = useRef("");

	const onError = useCallback((message: string) => {
		setPin("");
		pinRef.current = "";
		setError(message);
		setShake(true);
		setTimeout(() => setShake(false), 500);
	}, []);

	const verifyPinMutation = useMutation(
		orpc.settings.verifyPin.mutationOptions({
			onSuccess: () => {
				setPin("");
				pinRef.current = "";
				setError("");
				onUnlock();
			},
			onError: (err) => onError(err.message || "Invalid PIN"),
		}),
	);

	// Offline verification using SubtleCrypto — identical to server sha256 check
	const verifyOffline = useCallback(
		async (pinValue: string) => {
			setVerifyingOffline(true);
			try {
				const cached = localStorage.getItem("pos-pin-hash");
				if (!cached) {
					// No PIN set on this device — allow unlock
					onUnlock();
					return;
				}
				const buf = await crypto.subtle.digest(
					"SHA-256",
					new TextEncoder().encode(pinValue),
				);
				const hex = Array.from(new Uint8Array(buf))
					.map((b) => b.toString(16).padStart(2, "0"))
					.join("");
				if (hex === cached) {
					setPin("");
					pinRef.current = "";
					setError("");
					onUnlock();
				} else {
					onError("Invalid PIN");
				}
			} catch {
				onError("Verification failed — connect to the network");
			} finally {
				setVerifyingOffline(false);
			}
		},
		[onUnlock, onError],
	);

	const submitPin = useCallback(
		(pinValue: string) => {
			pinRef.current = pinValue;
			if (!getOnlineStatus()) {
				verifyOffline(pinValue);
			} else {
				verifyPinMutation.mutate({ pin: pinValue });
			}
		},
		[verifyOffline, verifyPinMutation],
	);

	const handleDigit = useCallback(
		(digit: string) => {
			setError("");
			setPin((prev) => {
				const next = prev + digit;
				if (next.length >= 4) {
					// Side-effect in setState callback is intentional here — same
					// pattern as the existing mutation call. Runs synchronously after
					// the state update is queued.
					submitPin(next);
				}
				return next.length <= 8 ? next : prev;
			});
		},
		[submitPin],
	);

	const handleBackspace = useCallback(() => {
		setPin((prev) => prev.slice(0, -1));
		setError("");
	}, []);

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

	const isVerifying = verifyPinMutation.isPending || verifyingOffline;
	const isOffline = !getOnlineStatus();

	async function handleLogout() {
		await authClient.signOut();
		window.location.href = "/login";
	}

	const digits = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "back"];

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
			<div className="flex w-full max-w-sm flex-col items-center gap-6 px-6">
				{/* Logo + Lock Icon */}
				<div className="flex flex-col items-center gap-3">
					<div className="flex size-16 items-center justify-center rounded-full bg-primary/10">
						<Lock className="size-8 text-primary" />
					</div>
					<div className="text-center">
						<h1 className="font-bold text-foreground text-xl">
							Terminal Locked
						</h1>
						<p className="text-muted-foreground text-sm">
							Welcome back,{" "}
							<span className="font-medium text-foreground">{userName}</span>
						</p>
						{isOffline && (
							<p className="mt-1 flex items-center justify-center gap-1 text-amber-600 text-xs dark:text-amber-400">
								<WifiOff className="size-3" /> Offline — using cached PIN
							</p>
						)}
					</div>
				</div>

				{/* PIN dots */}
				<div
					className={`flex items-center gap-3 ${shake ? "animate-shake" : ""}`}
				>
					{Array.from({ length: Math.max(4, pin.length) }, (_, i) => (
						<div
							key={i}
							className={`size-4 rounded-full transition-all ${
								i < pin.length
									? "scale-110 bg-primary"
									: "border-2 border-muted-foreground/30 bg-transparent"
							}`}
						/>
					))}
				</div>

				{/* Error message */}
				{error && (
					<p className="font-medium text-destructive text-sm">{error}</p>
				)}

				{/* Number pad */}
				<div className="grid w-full grid-cols-3 gap-3">
					{digits.map((d, i) => {
						if (d === "") return <div key={i} />;
						if (d === "back") {
							return (
								<Button
									key={i}
									variant="outline"
									className="h-14 text-lg"
									onClick={handleBackspace}
									disabled={pin.length === 0}
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
								className="h-14 font-semibold text-xl"
								onClick={() => handleDigit(d)}
								disabled={isVerifying}
							>
								{d}
							</Button>
						);
					})}
				</div>

				{/* Loading indicator */}
				{isVerifying && (
					<p className="text-muted-foreground text-sm">Verifying...</p>
				)}

				{/* Logout */}
				<Button
					variant="ghost"
					size="sm"
					className="mt-2 gap-1.5 text-muted-foreground text-xs"
					onClick={handleLogout}
				>
					<LogOut className="size-3.5" /> Sign out
				</Button>
			</div>
		</div>
	);
}
