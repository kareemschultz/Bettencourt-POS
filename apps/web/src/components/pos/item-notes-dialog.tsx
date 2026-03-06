import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

interface ItemNotesDialogProps {
	open: boolean;
	onClose: () => void;
	productName: string;
	currentNotes: string;
	onSave: (notes: string) => void;
}

const QUICK_NOTES = [
	"No salt",
	"Extra spicy",
	"No onions",
	"No pepper",
	"Well done",
	"Gluten free",
	"Extra sauce",
	"Allergies",
];

export function ItemNotesDialog({
	open,
	onClose,
	productName,
	currentNotes,
	onSave,
}: ItemNotesDialogProps) {
	const [notes, setNotes] = useState(currentNotes);

	function handleSave() {
		onSave(notes.trim());
		onClose();
	}

	function toggleQuickNote(note: string) {
		setNotes((prev) => {
			const current = prev.split(", ").filter(Boolean);
			if (current.includes(note)) {
				return current.filter((n) => n !== note).join(", ");
			}
			return [...current, note].join(", ");
		});
	}

	return (
		<Dialog
			open={open}
			onOpenChange={(o) => {
				if (!o) onClose();
			}}
		>
			<DialogContent className="max-w-xs sm:max-w-sm">
				<DialogHeader>
					<DialogTitle className="text-base">
						Notes for {productName}
					</DialogTitle>
				</DialogHeader>

				<div className="flex flex-col gap-3">
					{/* Quick note chips */}
					<div className="flex flex-wrap gap-1.5">
						{QUICK_NOTES.map((note) => {
							const isActive = notes.includes(note);
							return (
								<button
									key={note}
									onClick={() => toggleQuickNote(note)}
									className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
										isActive
											? "border-primary bg-primary/10 font-medium text-primary"
											: "border-border bg-background text-muted-foreground hover:border-primary/50"
									}`}
								>
									{note}
								</button>
							);
						})}
					</div>

					{/* Free text */}
					<Textarea
						value={notes}
						onChange={(e) => setNotes(e.target.value)}
						placeholder="Add special instructions..."
						rows={3}
						className="resize-none text-sm"
					/>
				</div>

				<DialogFooter className="gap-2 sm:gap-0">
					<Button variant="outline" onClick={onClose}>
						Cancel
					</Button>
					<Button onClick={handleSave}>Save Notes</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
