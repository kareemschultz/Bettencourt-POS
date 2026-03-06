import { useMutation } from "@tanstack/react-query";
import { Delete, Lock, LogOut } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { orpc } from "@/utils/orpc";

interface PinLockScreenProps {
	userName: string;
	onUnlock: () => void;
}

export function PinLockScreen({ userName, onUnlock }: PinLockScreenProps) {
	const [pin, setPin] = useState("");
	const [error, setError] = useState("");
	const [shake, setShake] = useState(false);

	const verifyPin = useMutation(
		orpc.settings.verifyPin.mutationOptions({
			onSuccess: () => {
				setPin("");
				setError("");
				onUnlock();
			},
			onError: (err) => {
				setPin("");
				setError(err.message || "Invalid PIN");
				setShake(true);
				setTimeout(() => setShake(false), 500);
			},
		}),
	);

	const handleDigit = useCallback(
		(digit: string) => {
			setError("");
			setPin((prev) => {
				const next = prev + digit;
				if (next.length >= 4) {
					// Auto-submit on 4+ digits
					verifyPin.mutate({ pin: next });
				}
				return next.length <= 8 ? next : prev;
			});
		},
		[verifyPin],
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
				verifyPin.mutate({ pin });
			}
		}
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [handleDigit, handleBackspace, pin, verifyPin]);

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
								disabled={verifyPin.isPending}
							>
								{d}
							</Button>
						);
					})}
				</div>

				{/* Loading indicator */}
				{verifyPin.isPending && (
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
