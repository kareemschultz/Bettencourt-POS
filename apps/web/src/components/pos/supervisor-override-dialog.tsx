import { useMutation } from "@tanstack/react-query";
import { Delete, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { orpc } from "@/utils/orpc";

interface SupervisorOverrideDialogProps {
	open: boolean;
	requiredPermission: string;
	permissionLabel?: string;
	onAuthorized: (supervisorId: string, supervisorName: string) => void;
	onCancel: () => void;
}

export function SupervisorOverrideDialog({
	open,
	requiredPermission,
	permissionLabel,
	onAuthorized,
	onCancel,
}: SupervisorOverrideDialogProps) {
	const [pin, setPin] = useState("");
	const [attemptsLeft, setAttemptsLeft] = useState(3);

	const label = permissionLabel ?? requiredPermission;

	const verify = useMutation(
		orpc.settings.verifySupervisor.mutationOptions({
			onSuccess: (data) => {
				setPin("");
				setAttemptsLeft(3);
				onAuthorized(data.supervisorId, data.supervisorName);
			},
			onError: (error) => {
				setPin("");
				if (error.message?.includes("Too many")) {
					toast.error("Too many failed attempts. Wait 1 minute.");
					setAttemptsLeft(0);
				} else {
					const next = Math.max(0, attemptsLeft - 1);
					setAttemptsLeft(next);
					if (next === 0) {
						toast.error("Too many failed attempts. Wait 1 minute.");
					} else {
						toast.error(
							`Incorrect PIN. ${next} attempt${next === 1 ? "" : "s"} remaining.`,
						);
					}
				}
			},
		}),
	);

	function handleDigit(d: number) {
		if (pin.length >= 8) return;
		const next = pin + String(d);
		setPin(next);
		if (next.length >= 4) {
			// Auto-submit at 4+ digits when user presses a digit that makes it 4
			// (they can keep typing up to 8 then submit manually, but auto-submit at 4)
		}
	}

	function handleBackspace() {
		setPin((prev) => prev.slice(0, -1));
	}

	function handleSubmit() {
		if (pin.length < 4) return;
		verify.mutate({ pin, requiredPermission });
	}

	function handleClose() {
		setPin("");
		setAttemptsLeft(3);
		onCancel();
	}

	const dots = Array.from({ length: Math.max(4, pin.length) }).map((_, i) =>
		i < pin.length ? "●" : "○",
	);

	return (
		<Dialog
			open={open}
			onOpenChange={(o) => {
				if (!o) handleClose();
			}}
		>
			<DialogContent className="max-w-[calc(100vw-2rem)] rounded-xl sm:max-w-xs">
				<DialogHeader className="items-center">
					<div className="mb-1 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
						<ShieldAlert className="size-6 text-amber-600 dark:text-amber-400" />
					</div>
					<DialogTitle className="text-center">Supervisor Required</DialogTitle>
					<DialogDescription className="text-center text-sm">
						Enter supervisor PIN to authorize:{" "}
						<span className="font-medium text-foreground">{label}</span>
					</DialogDescription>
				</DialogHeader>

				{/* PIN dots */}
				<div className="flex justify-center gap-2 py-2">
					{dots.map((dot, i) => (
						<span
							// biome-ignore lint/suspicious/noArrayIndexKey: static length
							key={i}
							className={`text-2xl tracking-widest ${i < pin.length ? "text-foreground" : "text-muted-foreground/40"}`}
						>
							{dot}
						</span>
					))}
				</div>

				{/* Numpad */}
				<div className="grid grid-cols-3 gap-2">
					{[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
						<Button
							key={d}
							variant="outline"
							className="h-14 touch-manipulation font-semibold text-xl"
							onClick={() => handleDigit(d)}
							disabled={verify.isPending || attemptsLeft === 0}
						>
							{d}
						</Button>
					))}
					<Button
						variant="outline"
						className="h-14 touch-manipulation"
						onClick={handleBackspace}
						disabled={verify.isPending}
					>
						<Delete className="size-5" />
					</Button>
					<Button
						variant="outline"
						className="h-14 touch-manipulation font-semibold text-xl"
						onClick={() => handleDigit(0)}
						disabled={verify.isPending || attemptsLeft === 0}
					>
						0
					</Button>
					<Button
						className="h-14 touch-manipulation"
						onClick={handleSubmit}
						disabled={pin.length < 4 || verify.isPending || attemptsLeft === 0}
					>
						{verify.isPending ? "..." : "OK"}
					</Button>
				</div>

				<Button
					variant="ghost"
					className="mt-1 touch-manipulation"
					onClick={handleClose}
					disabled={verify.isPending}
				>
					Cancel
				</Button>
			</DialogContent>
		</Dialog>
	);
}
