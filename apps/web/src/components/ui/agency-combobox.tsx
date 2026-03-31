// Agency Combobox — live search against the agency directory.
// Typing a free-form name that doesn't match still saves fine (it will be upserted on submit).
import { useQuery } from "@tanstack/react-query";
import { ChevronsUpDown, Loader2 } from "lucide-react";
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

export type AgencyHit = {
	id: string;
	name: string;
	supervisorName?: string | null;
	supervisorPosition?: string | null;
	phone?: string | null;
	address?: string | null;
};

interface Props {
	value: string;
	onChange: (name: string) => void;
	/** Called when the user picks an existing agency — use to auto-fill supervisor, phone, address. */
	onSelect?: (agency: AgencyHit) => void;
	placeholder?: string;
	disabled?: boolean;
	className?: string;
}

export function AgencyCombobox({
	value,
	onChange,
	onSelect,
	placeholder = "e.g. Ministry of Home Affairs",
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
		...orpc.agencies.search.queryOptions({
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

	function handleSelect(hit: AgencyHit) {
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
						if ((results as AgencyHit[]).length > 0 && query.length >= 1)
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

			{open && (results as AgencyHit[]).length > 0 && (
				<div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-lg">
					<Command>
						<CommandList>
							<CommandGroup heading="Saved agencies">
								{(results as AgencyHit[]).map((hit) => (
									<CommandItem
										key={hit.id}
										value={hit.name}
										onMouseDown={(e) => e.preventDefault()}
										onSelect={() => handleSelect(hit)}
										className="cursor-pointer"
									>
										<div className="flex flex-col">
											<span className="text-sm font-medium">{hit.name}</span>
											{hit.supervisorName && (
												<span className="text-xs text-muted-foreground">
													{hit.supervisorName}
													{hit.supervisorPosition
														? ` — ${hit.supervisorPosition}`
														: ""}
												</span>
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
