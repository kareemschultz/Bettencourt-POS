import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit2, Gift, Plus, Star, Trash2, Trophy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatGYD } from "@/lib/types";
import { orpc } from "@/utils/orpc";

type RewardType = "percentage_discount" | "fixed_discount" | "free_item";

interface TierForm {
	name: string;
	pointsRequired: number;
	rewardType: RewardType;
	rewardValue: number;
	sortOrder: number;
}

const emptyTier: TierForm = {
	name: "",
	pointsRequired: 50,
	rewardType: "percentage_discount",
	rewardValue: 10,
	sortOrder: 0,
};

export default function LoyaltyPage() {
	const queryClient = useQueryClient();
	const [tierDialogOpen, setTierDialogOpen] = useState(false);
	const [editingTierId, setEditingTierId] = useState<string | null>(null);
	const [tierForm, setTierForm] = useState<TierForm>(emptyTier);
	const [memberSearch, setMemberSearch] = useState("");

	const { data: program, isLoading } = useQuery(
		orpc.loyalty.getProgram.queryOptions({ input: {} }),
	);

	const { data: leaderboard } = useQuery(
		orpc.loyalty.getLeaderboard.queryOptions({ input: { limit: 50 } }),
	);

	const programKey = orpc.loyalty.getProgram.queryOptions({
		input: {},
	}).queryKey;

	const [programForm, setProgramForm] = useState({
		name: "",
		pointsPerDollar: 1,
		isActive: true,
	});

	const updateProgramMut = useMutation(
		orpc.loyalty.updateProgram.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: programKey });
				toast.success("Loyalty program updated");
			},
			onError: (err) => toast.error(err.message || "Failed to update program"),
		}),
	);

	const createTierMut = useMutation(
		orpc.loyalty.createTier.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: programKey });
				setTierDialogOpen(false);
				setTierForm(emptyTier);
				toast.success("Reward tier created");
			},
			onError: (err) => toast.error(err.message || "Failed to create tier"),
		}),
	);

	const updateTierMut = useMutation(
		orpc.loyalty.updateTier.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: programKey });
				setTierDialogOpen(false);
				setEditingTierId(null);
				setTierForm(emptyTier);
				toast.success("Reward tier updated");
			},
			onError: (err) => toast.error(err.message || "Failed to update tier"),
		}),
	);

	const deleteTierMut = useMutation(
		orpc.loyalty.deleteTier.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: programKey });
				toast.success("Reward tier deleted");
			},
		}),
	);

	// Sync form when program loads
	if (program && programForm.name === "" && program.name) {
		setProgramForm({
			name: program.name,
			pointsPerDollar: program.pointsPerDollar,
			isActive: program.isActive,
		});
	}

	function handleSaveProgram() {
		if (!programForm.name.trim()) {
			toast.error("Program name is required");
			return;
		}
		updateProgramMut.mutate(programForm);
	}

	function openCreateTier() {
		if (!program) {
			toast.error("Save the program first");
			return;
		}
		setEditingTierId(null);
		setTierForm({ ...emptyTier, sortOrder: (program.tiers?.length ?? 0) + 1 });
		setTierDialogOpen(true);
	}

	function openEditTier(t: {
		id: string;
		name: string;
		pointsRequired: number;
		rewardType: string;
		rewardValue: string;
		sortOrder: number;
	}) {
		setEditingTierId(t.id);
		setTierForm({
			name: t.name,
			pointsRequired: t.pointsRequired,
			rewardType: t.rewardType as RewardType,
			rewardValue: Number(t.rewardValue),
			sortOrder: t.sortOrder,
		});
		setTierDialogOpen(true);
	}

	function handleSaveTier() {
		if (!tierForm.name.trim()) {
			toast.error("Tier name is required");
			return;
		}
		if (editingTierId) {
			updateTierMut.mutate({
				id: editingTierId,
				...tierForm,
			});
		} else {
			createTierMut.mutate({
				programId: program?.id,
				...tierForm,
			});
		}
	}

	const _rewardTypeLabels: Record<string, string> = {
		percentage_discount: "% Off",
		fixed_discount: "$ Off",
		free_item: "Free Item",
	};

	return (
		<div className="space-y-6">
			<div>
				<h1 className="flex items-center gap-2 font-bold text-2xl">
					<Star className="size-6 text-primary" />
					Loyalty Program
				</h1>
				<p className="text-muted-foreground text-sm">
					Reward repeat customers with points they earn on every purchase.
					Configure earn rates, reward tiers, and track top members.
				</p>
			</div>

			<Tabs defaultValue="settings">
				<TabsList>
					<TabsTrigger value="settings">Program Settings</TabsTrigger>
					<TabsTrigger value="rewards">Reward Tiers</TabsTrigger>
					<TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
				</TabsList>

				<TabsContent value="settings" className="space-y-4">
					<Card>
						<CardHeader>
							<CardTitle>Program Configuration</CardTitle>
							<CardDescription>
								Set up how customers earn and redeem points
							</CardDescription>
						</CardHeader>
						<CardContent className="max-w-md space-y-4">
							<div>
								<Label>Program Name</Label>
								<Input
									value={programForm.name}
									onChange={(e) =>
										setProgramForm({ ...programForm, name: e.target.value })
									}
									placeholder="Bettencourt's Rewards"
								/>
							</div>
							<div>
								<Label>Points per GYD $1 spent</Label>
								<Input
									type="number"
									min={1}
									max={100}
									value={programForm.pointsPerDollar}
									onChange={(e) =>
										setProgramForm({
											...programForm,
											pointsPerDollar: Number(e.target.value),
										})
									}
								/>
								<p className="mt-1 text-muted-foreground text-xs">
									A {formatGYD(1000)} order earns{" "}
									<strong>{1000 * programForm.pointsPerDollar}</strong> points
								</p>
							</div>
							<div className="flex items-center gap-3">
								<Switch
									checked={programForm.isActive}
									onCheckedChange={(checked) =>
										setProgramForm({ ...programForm, isActive: checked })
									}
								/>
								<Label>Program Active</Label>
							</div>
							<Button
								onClick={handleSaveProgram}
								disabled={updateProgramMut.isPending}
							>
								{updateProgramMut.isPending ? "Saving..." : "Save Settings"}
							</Button>
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="rewards" className="space-y-4">
					<div className="flex items-center justify-between">
						<h2 className="font-semibold text-lg">Reward Tiers</h2>
						<Button onClick={openCreateTier} size="sm">
							<Plus className="mr-1 size-4" />
							Add Tier
						</Button>
					</div>

					{!program?.tiers || program.tiers.length === 0 ? (
						<Card>
							<CardContent className="py-12 text-center text-muted-foreground">
								<Gift className="mx-auto mb-2 size-8 opacity-50" />
								<p className="font-medium">No reward tiers configured yet</p>
								<p className="mt-1 text-xs">
									Add tiers to define how many points unlock each reward (e.g.
									50 pts = free drink).
								</p>
							</CardContent>
						</Card>
					) : (
						<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
							{program.tiers.map((tier) => (
								<Card key={tier.id}>
									<CardHeader className="pb-2">
										<div className="flex items-start justify-between">
											<CardTitle className="text-base">{tier.name}</CardTitle>
											<div className="flex gap-1">
												<Button
													variant="ghost"
													size="sm"
													onClick={() => openEditTier(tier)}
												>
													<Edit2 className="size-3.5" />
												</Button>
												<Button
													variant="ghost"
													size="sm"
													onClick={() => deleteTierMut.mutate({ id: tier.id })}
												>
													<Trash2 className="size-3.5 text-destructive" />
												</Button>
											</div>
										</div>
									</CardHeader>
									<CardContent>
										<div className="mb-2 flex items-center gap-2">
											<Badge variant="secondary">
												{tier.pointsRequired} pts
											</Badge>
											<Badge>
												{tier.rewardType === "percentage_discount"
													? `${Number(tier.rewardValue)}% Off`
													: tier.rewardType === "fixed_discount"
														? `${formatGYD(Number(tier.rewardValue))} Off`
														: "Free Item"}
											</Badge>
										</div>
									</CardContent>
								</Card>
							))}
						</div>
					)}
				</TabsContent>

				<TabsContent value="leaderboard" className="space-y-4">
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Trophy className="size-5 text-primary" />
								Top Loyalty Members
							</CardTitle>
							<CardDescription>
								Customers ranked by lifetime points earned.
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="mb-4">
								<Input
									placeholder="Search by name or phone..."
									value={memberSearch}
									onChange={(e) => setMemberSearch(e.target.value)}
									className="max-w-sm"
								/>
							</div>
							{!leaderboard || leaderboard.length === 0 ? (
								<div className="py-8 text-center text-muted-foreground">
									<Trophy className="mx-auto mb-2 size-8 opacity-50" />
									<p className="font-medium">No loyalty members yet</p>
									<p className="mt-1 text-xs">
										Members appear here once customers start earning points on
										their orders.
									</p>
								</div>
							) : (
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead className="w-12">#</TableHead>
											<TableHead>Customer</TableHead>
											<TableHead>Phone</TableHead>
											<TableHead className="text-right">
												Current Points
											</TableHead>
											<TableHead className="text-right">
												Lifetime Points
											</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{(() => {
											const filtered = memberSearch
												? leaderboard.filter(
														(m) =>
															(m.customerName || "")
																.toLowerCase()
																.includes(memberSearch.toLowerCase()) ||
															(m.customerPhone || "")
																.toLowerCase()
																.includes(memberSearch.toLowerCase()),
													)
												: leaderboard.slice(0, 10);
											if (filtered.length === 0)
												return (
													<TableRow>
														<TableCell
															colSpan={5}
															className="py-8 text-center text-muted-foreground"
														>
															No members match your search
														</TableCell>
													</TableRow>
												);
											return filtered.map((member, i) => (
												<TableRow key={member.customerId}>
													<TableCell className="font-bold text-muted-foreground">
														{memberSearch
															? leaderboard.indexOf(member) + 1
															: i + 1}
													</TableCell>
													<TableCell className="font-medium">
														{member.customerName}
													</TableCell>
													<TableCell>{member.customerPhone || "—"}</TableCell>
													<TableCell className="text-right">
														{member.currentPoints.toLocaleString()}
													</TableCell>
													<TableCell className="text-right font-medium">
														{member.lifetimePoints.toLocaleString()}
													</TableCell>
												</TableRow>
											));
										})()}
									</TableBody>
								</Table>
							)}
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>

			<Dialog open={tierDialogOpen} onOpenChange={setTierDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>
							{editingTierId ? "Edit Reward Tier" : "New Reward Tier"}
						</DialogTitle>
						<DialogDescription>
							Define how many points are needed and what reward is given
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4">
						<div>
							<Label>Tier Name</Label>
							<Input
								value={tierForm.name}
								onChange={(e) =>
									setTierForm({ ...tierForm, name: e.target.value })
								}
								placeholder="e.g. Free Drink, 10% Off"
							/>
						</div>
						<div>
							<Label>Points Required</Label>
							<Input
								type="number"
								min={1}
								value={tierForm.pointsRequired}
								onChange={(e) =>
									setTierForm({
										...tierForm,
										pointsRequired: Number(e.target.value),
									})
								}
							/>
						</div>
						<div>
							<Label>Reward Type</Label>
							<Select
								value={tierForm.rewardType}
								onValueChange={(v) =>
									setTierForm({ ...tierForm, rewardType: v as RewardType })
								}
							>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="percentage_discount">
										Percentage Discount
									</SelectItem>
									<SelectItem value="fixed_discount">
										Fixed Amount Off
									</SelectItem>
									<SelectItem value="free_item">Free Item</SelectItem>
								</SelectContent>
							</Select>
						</div>
						<div>
							<Label>
								{tierForm.rewardType === "percentage_discount"
									? "Discount %"
									: tierForm.rewardType === "fixed_discount"
										? "Amount (GYD)"
										: "Product Value (GYD)"}
							</Label>
							<Input
								type="number"
								min={0}
								value={tierForm.rewardValue}
								onChange={(e) =>
									setTierForm({
										...tierForm,
										rewardValue: Number(e.target.value),
									})
								}
							/>
						</div>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setTierDialogOpen(false)}>
							Cancel
						</Button>
						<Button
							onClick={handleSaveTier}
							disabled={createTierMut.isPending || updateTierMut.isPending}
						>
							{createTierMut.isPending || updateTierMut.isPending
								? "Saving..."
								: "Save"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
