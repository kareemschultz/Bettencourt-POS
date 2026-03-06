import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CartModifier, Product } from "@/lib/types";
import { formatGYD } from "@/lib/types";
import { orpc } from "@/utils/orpc";

interface ModifierDialogProps {
	product: Product | null;
	open: boolean;
	onClose: () => void;
	onConfirm: (modifiers: CartModifier[], notes: string) => void;
}

export function ModifierDialog({
	product,
	open,
	onClose,
	onConfirm,
}: ModifierDialogProps) {
	const [selected, setSelected] = useState<CartModifier[]>([]);
	const [notes, setNotes] = useState("");

	const { data, isLoading } = useQuery(
		orpc.pos.getModifiers.queryOptions({
			input: { productId: product?.id },
			query: { enabled: open && !!product },
		}),
	);

	const groups = data?.groups || [];

	useEffect(() => {
		if (open) {
			setSelected([]);
			setNotes("");
		}
	}, [open]);

	function toggleModifier(
		groupId: string,
		mod: { id: string; name: string; price: number | string },
	) {
		setSelected((prev) => {
			const exists = prev.find((m) => m.id === mod.id);
			if (exists) return prev.filter((m) => m.id !== mod.id);

			// Check max selections for this group
			const group = groups.find((g) => g.id === groupId);
			if (group && group.maxSelect > 0) {
				const currentGroupCount = prev.filter((m) =>
					group.modifiers.some((gm) => gm.id === m.id),
				).length;
				if (currentGroupCount >= group.maxSelect) return prev;
			}

			return [
				...prev,
				{ id: mod.id, name: mod.name, price: Number(mod.price) },
			];
		});
	}

	// Validate min selections for all required groups
	const isBelowMin = groups.some((group) => {
		if (group.minSelect <= 0 && !group.required) return false;
		const minRequired =
			group.required && group.minSelect === 0 ? 1 : group.minSelect;
		const count = selected.filter((m) =>
			group.modifiers.some((gm) => gm.id === m.id),
		).length;
		return count < minRequired;
	});

	function handleConfirm() {
		onConfirm(selected, notes);
	}

	if (!product) return null;

	// If no modifiers, skip the dialog
	if (!isLoading && groups.length === 0 && open) {
		onConfirm([], "");
		return null;
	}

	return (
		<Dialog open={open} onOpenChange={(o) => !o && onClose()}>
			<DialogContent className="max-w-md">
				<DialogHeader>
					<DialogTitle>Customize: {product.name}</DialogTitle>
				</DialogHeader>

				{isLoading ? (
					<p className="py-8 text-center text-muted-foreground">Loading...</p>
				) : (
					<div className="flex max-h-[50vh] flex-col gap-4 overflow-auto py-2">
						{groups.map((group) => {
							const groupSelectedCount = selected.filter((m) =>
								group.modifiers.some((gm) => gm.id === m.id),
							).length;
							const atMax =
								group.maxSelect > 0 && groupSelectedCount >= group.maxSelect;

							return (
								<div key={group.id} className="flex flex-col gap-2">
									<h4 className="font-semibold text-sm">
										{group.name}
										{(group.required || group.minSelect > 0) && (
											<span className="ml-1 text-destructive text-xs">
												{group.required &&
												group.minSelect === 0 &&
												group.maxSelect <= 1
													? "Required"
													: `Choose ${group.minSelect}${group.maxSelect > 0 ? `-${group.maxSelect}` : "+"}`}
											</span>
										)}
										{group.maxSelect > 0 && (
											<span className="ml-1 text-muted-foreground text-xs">
												({groupSelectedCount}/{group.maxSelect})
											</span>
										)}
									</h4>
									{group.modifiers.map((mod) => {
										const isSelected = selected.some((s) => s.id === mod.id);
										const isDisabled = !isSelected && atMax;
										return (
											<div key={mod.id} className="flex items-center gap-3">
												<Checkbox
													id={mod.id}
													checked={isSelected}
													disabled={isDisabled}
													onCheckedChange={() => toggleModifier(group.id, mod)}
												/>
												<Label
													htmlFor={mod.id}
													className="flex flex-1 cursor-pointer items-center justify-between"
												>
													<span>{mod.name}</span>
													{Number(mod.price) > 0 && (
														<span className="text-muted-foreground text-sm">
															+{formatGYD(Number(mod.price))}
														</span>
													)}
												</Label>
											</div>
										);
									})}
								</div>
							);
						})}

						<div className="flex flex-col gap-2">
							<Label htmlFor="item-notes">Notes</Label>
							<Input
								id="item-notes"
								placeholder="Special instructions..."
								value={notes}
								onChange={(e) => setNotes(e.target.value)}
								className="h-11 text-base"
							/>
						</div>
					</div>
				)}

				<DialogFooter>
					<Button variant="outline" onClick={onClose}>
						Cancel
					</Button>
					<Button onClick={handleConfirm} disabled={isLoading || isBelowMin}>
						Add to Order
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
