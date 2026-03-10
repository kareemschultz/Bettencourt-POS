// Supplier Combobox — searchable picker for supplier selection.
// All suppliers are loaded once (client-side filter). Free-text still allowed.
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { orpc } from "@/utils/orpc";

type SupplierHit = {
	id: string;
	name: string;
	phone?: string | null;
	email?: string | null;
};

interface Props {
	value: string;
	onChange: (name: string) => void;
	onSelect?: (supplier: SupplierHit) => void;
	placeholder?: string;
	disabled?: boolean;
	className?: string;
}

export function SupplierCombobox({
	value,
	onChange,
	onSelect,
	placeholder = "Select or type supplier…",
	disabled,
	className,
}: Props) {
	const [open, setOpen] = useState(false);
	const [search, setSearch] = useState("");

	const { data: suppliers = [], isLoading } = useQuery(
		orpc.settings.getSuppliers.queryOptions({ input: {} }),
	);

	const filtered = useMemo(() => {
		const term = search.toLowerCase();
		return (suppliers as SupplierHit[])
			.filter(
				(s) =>
					s.name.toLowerCase().includes(term) ||
					(s.phone ?? "").toLowerCase().includes(term),
			)
			.slice(0, 15);
	}, [suppliers, search]);

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					role="combobox"
					aria-expanded={open}
					disabled={disabled}
					className={cn("w-full justify-between font-normal", className)}
				>
					<span className={cn("truncate", !value && "text-muted-foreground")}>
						{value || placeholder}
					</span>
					{isLoading ? (
						<Loader2 className="ml-2 size-4 shrink-0 animate-spin opacity-50" />
					) : (
						<ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
					)}
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-[--radix-popover-trigger-width] p-0">
				<Command>
					<div className="flex items-center border-b border-border px-3">
						<Input
							placeholder="Search suppliers…"
							value={search}
							onChange={(e) => {
								setSearch(e.target.value);
								// Keep free-text in sync too
								onChange(e.target.value);
							}}
							className="h-9 border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
							autoFocus
						/>
					</div>
					<CommandList>
						{filtered.length === 0 && !isLoading && (
							<CommandEmpty>
								<div className="py-3 text-center text-xs text-muted-foreground">
									{search
										? `No supplier found. "${search}" will be saved as typed.`
										: "No suppliers found."}
								</div>
							</CommandEmpty>
						)}
						{filtered.length > 0 && (
							<CommandGroup>
								{filtered.map((s) => (
									<CommandItem
										key={s.id}
										value={s.name}
										onSelect={() => {
											onChange(s.name);
											onSelect?.(s);
											setSearch("");
											setOpen(false);
										}}
									>
										<Check
											className={cn(
												"mr-2 size-3.5",
												value === s.name ? "opacity-100" : "opacity-0",
											)}
										/>
										<div>
											<div className="text-sm font-medium">{s.name}</div>
											{s.phone && (
												<div className="text-xs text-muted-foreground">
													{s.phone}
												</div>
											)}
										</div>
									</CommandItem>
								))}
							</CommandGroup>
						)}
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}

// Inline input variant — looks like a regular input with autocomplete dropdown
export function SupplierComboboxInline({
	value,
	onChange,
	onSelect,
	placeholder = "Supplier name",
	disabled,
	className,
}: Props) {
	const [open, setOpen] = useState(false);

	const { data: suppliers = [] } = useQuery(
		orpc.settings.getSuppliers.queryOptions({ input: {} }),
	);

	const filtered = useMemo(() => {
		const term = value.toLowerCase();
		if (!term) return [];
		return (suppliers as SupplierHit[])
			.filter(
				(s) =>
					s.name.toLowerCase().includes(term) ||
					(s.phone ?? "").toLowerCase().includes(term),
			)
			.slice(0, 10);
	}, [suppliers, value]);

	return (
		<div className={cn("relative", className)}>
			<div className="relative">
				<Input
					value={value}
					onChange={(e) => {
						onChange(e.target.value);
						setOpen(e.target.value.length > 0 && filtered.length > 0);
					}}
					onFocus={() => {
						if (filtered.length > 0) setOpen(true);
					}}
					onBlur={() => setTimeout(() => setOpen(false), 150)}
					placeholder={placeholder}
					disabled={disabled}
					className="pr-8"
				/>
				<ChevronsUpDown className="absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground opacity-50" />
			</div>

			{open && filtered.length > 0 && (
				<div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-md">
					<Command>
						<CommandList>
							<CommandGroup>
								{filtered.map((s) => (
									<CommandItem
										key={s.id}
										value={s.name}
										onMouseDown={(e) => e.preventDefault()}
										onSelect={() => {
											onChange(s.name);
											onSelect?.(s);
											setOpen(false);
										}}
										className="cursor-pointer"
									>
										<Check
											className={cn(
												"mr-2 size-3.5",
												value === s.name ? "opacity-100" : "opacity-0",
											)}
										/>
										<div>
											<div className="text-sm font-medium">{s.name}</div>
											{s.phone && (
												<div className="text-xs text-muted-foreground">
													{s.phone}
												</div>
											)}
										</div>
									</CommandItem>
								))}
							</CommandGroup>
						</CommandList>
					</Command>
				</div>
			)}
		</div>
	);
}
