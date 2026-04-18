// Agency Combobox — live search against the agency directory.
// Typing a free-form name that doesn't match still saves fine (it will be upserted on submit).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, ChevronsUpDown, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Command,
	CommandGroup,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
	const [createOpen, setCreateOpen] = useState(false);
	const [createForm, setCreateForm] = useState({
		name: "",
		supervisorName: "",
		supervisorPosition: "",
		phone: "",
		address: "",
	});
	const [createError, setCreateError] = useState("");
	const queryClient = useQueryClient();

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

	const createMutation = useMutation(
		orpc.agencies.create.mutationOptions({
			onSuccess: (newAgency) => {
				queryClient.invalidateQueries({
					queryKey: orpc.agencies.search.queryOptions({ input: { query: "" } })
						.queryKey,
				});
				const hit: AgencyHit = {
					id: newAgency.id,
					name: newAgency.name,
					supervisorName: newAgency.supervisorName ?? null,
					supervisorPosition: newAgency.supervisorPosition ?? null,
					phone: newAgency.phone ?? null,
					address: newAgency.address ?? null,
				};
				handleSelect(hit);
				setCreateOpen(false);
				setCreateForm({
					name: "",
					supervisorName: "",
					supervisorPosition: "",
					phone: "",
					address: "",
				});
				setCreateError("");
			},
			onError: (err) => {
				const msg =
					err instanceof Error ? err.message : "Failed to create agency";
				setCreateError(msg);
			},
		}),
	);

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

	function openCreateModal() {
		setCreateForm({
			name: query,
			supervisorName: "",
			supervisorPosition: "",
			phone: "",
			address: "",
		});
		setCreateError("");
		setCreateOpen(true);
		setOpen(false);
	}

	function handleCreate(e: React.FormEvent) {
		e.preventDefault();
		if (!createForm.name.trim()) return;
		createMutation.mutate({
			name: createForm.name.trim(),
			supervisorName: createForm.supervisorName.trim() || undefined,
			supervisorPosition: createForm.supervisorPosition.trim() || undefined,
			phone: createForm.phone.trim() || undefined,
			address: createForm.address.trim() || undefined,
		});
	}

	return (
		<>
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
						<Loader2 className="absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
					) : (
						<ChevronsUpDown className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-muted-foreground opacity-40" />
					)}
				</div>

				<button
					type="button"
					onMouseDown={(e) => e.preventDefault()}
					onClick={openCreateModal}
					className="mt-0.5 flex items-center gap-1 text-[11px] text-primary hover:underline"
				>
					<Building2 className="size-3" />
					New agency
				</button>

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
												<span className="font-medium text-sm">{hit.name}</span>
												{hit.supervisorName && (
													<span className="text-muted-foreground text-xs">
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
						<div className="border-border border-t px-3 py-2">
							<button
								type="button"
								onMouseDown={(e) => e.preventDefault()}
								onClick={openCreateModal}
								className="flex items-center gap-1.5 text-primary text-xs hover:underline"
							>
								<Building2 className="size-3" />
								Add new agency
							</button>
						</div>
					</div>
				)}

				{open &&
					(results as AgencyHit[]).length === 0 &&
					debouncedQuery.length >= 2 &&
					!isFetching && (
						<div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-md">
							<div className="px-3 py-2.5 text-muted-foreground text-xs">
								No match —{" "}
								<span className="font-medium text-foreground">"{query}"</span>{" "}
								will be saved as entered.
							</div>
							<div className="border-border border-t px-3 py-2">
								<button
									type="button"
									onMouseDown={(e) => e.preventDefault()}
									onClick={openCreateModal}
									className="flex items-center gap-1.5 text-primary text-xs hover:underline"
								>
									<Building2 className="size-3" />
									Add new agency
								</button>
							</div>
						</div>
					)}
			</div>

			<Dialog open={createOpen} onOpenChange={setCreateOpen}>
				<DialogContent className="max-w-md">
					<DialogHeader>
						<DialogTitle>Add New Agency</DialogTitle>
					</DialogHeader>
					<form onSubmit={handleCreate} className="grid gap-4 py-2">
						<div className="grid gap-1.5">
							<Label htmlFor="ac-name">
								Agency Name <span className="text-destructive">*</span>
							</Label>
							<Input
								id="ac-name"
								value={createForm.name}
								onChange={(e) =>
									setCreateForm((f) => ({ ...f, name: e.target.value }))
								}
								placeholder="e.g. Ministry of Home Affairs"
								autoFocus
							/>
						</div>
						<div className="grid gap-1.5">
							<Label htmlFor="ac-supervisor">Supervisor Name</Label>
							<Input
								id="ac-supervisor"
								value={createForm.supervisorName}
								onChange={(e) =>
									setCreateForm((f) => ({
										...f,
										supervisorName: e.target.value,
									}))
								}
								placeholder="e.g. John Doe"
							/>
						</div>
						<div className="grid gap-1.5">
							<Label htmlFor="ac-position">Position</Label>
							<Input
								id="ac-position"
								value={createForm.supervisorPosition}
								onChange={(e) =>
									setCreateForm((f) => ({
										...f,
										supervisorPosition: e.target.value,
									}))
								}
								placeholder="e.g. Permanent Secretary"
							/>
						</div>
						<div className="grid gap-1.5">
							<Label htmlFor="ac-phone">Phone</Label>
							<Input
								id="ac-phone"
								value={createForm.phone}
								onChange={(e) =>
									setCreateForm((f) => ({ ...f, phone: e.target.value }))
								}
								placeholder="e.g. 592-600-0000"
							/>
						</div>
						<div className="grid gap-1.5">
							<Label htmlFor="ac-address">Address</Label>
							<Input
								id="ac-address"
								value={createForm.address}
								onChange={(e) =>
									setCreateForm((f) => ({ ...f, address: e.target.value }))
								}
								placeholder="e.g. 6 Brickdam, Georgetown"
							/>
						</div>
						{createError && (
							<p className="text-destructive text-sm">{createError}</p>
						)}
						<DialogFooter>
							<Button
								type="button"
								variant="outline"
								onClick={() => setCreateOpen(false)}
							>
								Cancel
							</Button>
							<Button
								type="submit"
								disabled={createMutation.isPending || !createForm.name.trim()}
							>
								{createMutation.isPending ? (
									<>
										<Loader2 className="mr-2 size-4 animate-spin" />
										Creating...
									</>
								) : (
									"Create Agency"
								)}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
		</>
	);
}
