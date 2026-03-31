// Customer Combobox — live search with auto-fill of name + phone.
// Typing a free-form name that doesn't match still saves fine (walk-in customers).
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Loader2, UserPlus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
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
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { orpc } from "@/utils/orpc";

export type CustomerHit = {
	id: string;
	name: string;
	phone?: string | null;
	address?: string | null;
};

interface Props {
	value: string;
	onChange: (name: string) => void;
	/** Called when the user picks an existing customer — use to auto-fill phone etc. */
	onSelect?: (customer: CustomerHit) => void;
	placeholder?: string;
	disabled?: boolean;
	className?: string;
}

/**
 * Inline input that shows a dropdown of matching customers as you type.
 * Still accepts free-text (for one-time / walk-in customers with no account).
 */
export function CustomerCombobox({
	value,
	onChange,
	onSelect,
	placeholder = "Customer name",
	disabled,
	className,
}: Props) {
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState(value);
	const [debouncedQuery, setDebouncedQuery] = useState("");
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	// Sync query when the value changes externally (e.g. openEdit fills the form)
	useEffect(() => {
		setQuery(value);
	}, [value]);

	const { data: results = [], isFetching } = useQuery({
		...orpc.customers.search.queryOptions({
			input: { query: debouncedQuery },
		}),
		enabled: debouncedQuery.length >= 1,
	});

	function handleInputChange(raw: string) {
		setQuery(raw);
		onChange(raw);

		if (debounceRef.current) clearTimeout(debounceRef.current);
		debounceRef.current = setTimeout(() => {
			setDebouncedQuery(raw.trim());
			if (raw.trim().length >= 1) setOpen(true);
			else setOpen(false);
		}, 250);
	}

	function handleSelect(hit: CustomerHit) {
		setQuery(hit.name);
		onChange(hit.name);
		setDebouncedQuery("");
		onSelect?.(hit);
		setOpen(false);
	}

	return (
		<div className={cn("relative", className)}>
			<div className="relative">
				<Input
					value={query}
					onChange={(e) => handleInputChange(e.target.value)}
					onFocus={() => {
						if ((results as CustomerHit[]).length > 0 && query.length >= 1)
							setOpen(true);
					}}
					onBlur={() => setTimeout(() => setOpen(false), 180)}
					placeholder={placeholder}
					disabled={disabled}
					className="pr-8"
					autoComplete="off"
				/>
				{isFetching ? (
					<Loader2 className="absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
				) : (
					<ChevronsUpDown className="absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground opacity-40 pointer-events-none" />
				)}
			</div>

			{open && (results as CustomerHit[]).length > 0 && (
				<div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-lg">
					<Command>
						<CommandList>
							<CommandGroup heading="Existing customers">
								{(results as CustomerHit[]).map((hit) => (
									<CommandItem
										key={hit.id}
										value={hit.name}
										onMouseDown={(e) => e.preventDefault()}
										onSelect={() => handleSelect(hit)}
										className="cursor-pointer"
									>
										<Check
											className={cn(
												"mr-2 size-3.5 shrink-0",
												query === hit.name ? "opacity-100" : "opacity-0",
											)}
										/>
										<div className="flex flex-col">
											<span className="text-sm font-medium">{hit.name}</span>
											{hit.phone && (
												<span className="text-xs text-muted-foreground">
													{hit.phone}
												</span>
											)}
										</div>
									</CommandItem>
								))}
							</CommandGroup>
						</CommandList>
					</Command>
					<div className="border-t border-border px-3 py-2">
						<Link
							to="/dashboard/customers"
							target="_blank"
							className="flex items-center gap-1.5 text-xs text-primary hover:underline"
						>
							<UserPlus className="size-3" />
							Add new customer
						</Link>
					</div>
				</div>
			)}

			{open &&
				(results as CustomerHit[]).length === 0 &&
				debouncedQuery.length >= 2 &&
				!isFetching && (
					<div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-md">
						<div className="px-3 py-2.5 text-xs text-muted-foreground">
							No match —{" "}
							<span className="font-medium text-foreground">"{query}"</span> will
							be saved as entered.
						</div>
						<div className="border-t border-border px-3 py-2">
							<Link
								to="/dashboard/customers"
								target="_blank"
								className="flex items-center gap-1.5 text-xs text-primary hover:underline"
							>
								<UserPlus className="size-3" />
								Add new customer
							</Link>
						</div>
					</div>
				)}
		</div>
	);
}

/**
 * Trigger-button variant — looks like a <Select> but with live search inside the popover.
 */
export function CustomerComboboxSelect({
	value,
	onChange,
	onSelect,
	placeholder = "Select or type customer…",
	disabled,
	className,
}: Props) {
	const [open, setOpen] = useState(false);
	const [inputValue, setInputValue] = useState("");
	const [debouncedQuery, setDebouncedQuery] = useState("");
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const { data: results = [], isFetching } = useQuery({
		...orpc.customers.search.queryOptions({
			input: { query: debouncedQuery },
		}),
		enabled: debouncedQuery.length >= 1,
	});

	function handleSearch(raw: string) {
		setInputValue(raw);
		if (debounceRef.current) clearTimeout(debounceRef.current);
		debounceRef.current = setTimeout(
			() => setDebouncedQuery(raw.trim()),
			250,
		);
	}

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
					{isFetching ? (
						<Loader2 className="ml-2 size-4 shrink-0 animate-spin opacity-50" />
					) : (
						<ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
					)}
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
				<Command>
					<div className="flex items-center border-b border-border px-3">
						<Input
							placeholder="Search customers…"
							value={inputValue}
							onChange={(e) => handleSearch(e.target.value)}
							className="h-9 border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
							autoFocus
						/>
					</div>
					<CommandList>
						{(results as CustomerHit[]).length === 0 &&
							debouncedQuery.length >= 1 &&
							!isFetching && (
								<CommandEmpty>
									<div className="py-3 text-center text-xs text-muted-foreground">
										"{inputValue}" will be saved as typed.
									</div>
								</CommandEmpty>
							)}
						{(results as CustomerHit[]).length > 0 && (
							<CommandGroup heading="Existing customers">
								{(results as CustomerHit[]).map((hit) => (
									<CommandItem
										key={hit.id}
										value={hit.name}
										onSelect={() => {
											onChange(hit.name);
											onSelect?.(hit);
											setInputValue("");
											setOpen(false);
										}}
									>
										<Check
											className={cn(
												"mr-2 size-3.5",
												value === hit.name ? "opacity-100" : "opacity-0",
											)}
										/>
										<div>
											<div className="text-sm font-medium">{hit.name}</div>
											{hit.phone && (
												<div className="text-xs text-muted-foreground">
													{hit.phone}
												</div>
											)}
										</div>
									</CommandItem>
								))}
							</CommandGroup>
						)}
						{!inputValue && (
							<div className="border-t border-border px-3 py-2">
								<Link
									to="/dashboard/customers"
									target="_blank"
									className="flex items-center gap-1.5 text-xs text-primary hover:underline"
								>
									<UserPlus className="size-3" />
									Add new customer
								</Link>
							</div>
						)}
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}
