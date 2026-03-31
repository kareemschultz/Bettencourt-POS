// Product Combobox — live search with auto-fill of description + unit price.
// Typing a free-form description that doesn't match still saves fine.
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
	Command,
	CommandGroup,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { orpc } from "@/utils/orpc";

export type ProductHit = {
	id: string;
	name: string;
	price: string;
	sku?: string | null;
};

interface Props {
	value: string;
	onChange: (desc: string) => void;
	/** Called when the user picks an existing product — use to auto-fill price. */
	onSelect?: (product: ProductHit) => void;
	placeholder?: string;
	disabled?: boolean;
	className?: string;
}

export function ProductCombobox({
	value,
	onChange,
	onSelect,
	placeholder = "Description or search product...",
	disabled,
	className,
}: Props) {
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState(value);
	const [debouncedQuery, setDebouncedQuery] = useState("");
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	// Sync query when value changes externally (e.g. openEdit fills the form)
	useEffect(() => {
		setQuery(value);
	}, [value]);

	const { data: results = [], isFetching } = useQuery({
		...orpc.products.list.queryOptions({
			input: { search: debouncedQuery },
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

	function handleSelect(hit: ProductHit) {
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
						if ((results as ProductHit[]).length > 0 && query.length >= 1)
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

			{open && (results as ProductHit[]).length > 0 && (
				<div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-lg">
					<Command>
						<CommandList>
							<CommandGroup heading="Products">
								{(results as ProductHit[]).map((hit) => (
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
											<span className="text-xs text-muted-foreground">
												GYD ${Number(hit.price).toLocaleString()}
												{hit.sku ? ` · ${hit.sku}` : ""}
											</span>
										</div>
									</CommandItem>
								))}
							</CommandGroup>
						</CommandList>
					</Command>
				</div>
			)}

			{open &&
				(results as ProductHit[]).length === 0 &&
				debouncedQuery.length >= 2 &&
				!isFetching && (
					<div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-md">
						<div className="px-3 py-2.5 text-xs text-muted-foreground">
							No match —{" "}
							<span className="font-medium text-foreground">"{query}"</span>{" "}
							will be used as entered.
						</div>
					</div>
				)}
		</div>
	);
}
