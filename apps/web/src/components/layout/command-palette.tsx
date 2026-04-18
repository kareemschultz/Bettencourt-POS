import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import {
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
} from "@/components/ui/command";
import { canSeeItem, MODULES } from "@/lib/modules";
import type { AppUser } from "@/lib/types";

interface CommandPaletteProps {
	user: AppUser;
}

export function CommandPalette({ user }: CommandPaletteProps) {
	const [open, setOpen] = useState(false);
	const navigate = useNavigate();

	useEffect(() => {
		function onKeyDown(e: KeyboardEvent) {
			if ((e.ctrlKey || e.metaKey) && e.key === "k") {
				e.preventDefault();
				setOpen((prev) => !prev);
			}
		}
		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	}, []);

	function runCommand(url: string) {
		setOpen(false);
		navigate(url);
	}

	return (
		<CommandDialog
			open={open}
			onOpenChange={setOpen}
			title="Navigate"
			description="Search and jump to any page in the system"
		>
			<CommandInput placeholder="Search pages..." />
			<CommandList>
				<CommandEmpty>No pages found.</CommandEmpty>
				{MODULES.map((mod, idx) => {
					const visible = mod.items.filter(
						(item) => !item.hidden && canSeeItem(user, item),
					);
					if (visible.length === 0) return null;
					return (
						<div key={mod.id}>
							{idx > 0 && <CommandSeparator />}
							<CommandGroup heading={mod.label}>
								{visible.map((item) => (
									<CommandItem
										key={item.url}
										value={item.title}
										onSelect={() => runCommand(item.url)}
									>
										<item.icon />
										<span>{item.title}</span>
									</CommandItem>
								))}
							</CommandGroup>
						</div>
					);
				})}
			</CommandList>
		</CommandDialog>
	);
}
