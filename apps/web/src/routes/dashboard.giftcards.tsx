import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	CreditCard,
	Filter,
	History,
	Plus,
	RefreshCw,
	Search,
} from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { formatGYD } from "@/lib/types";
import { orpc } from "@/utils/orpc";

export default function GiftCardsPage() {
	const queryClient = useQueryClient();
	const [sellOpen, setSellOpen] = useState(false);
	const [lookupOpen, setLookupOpen] = useState(false);
	const [reloadOpen, setReloadOpen] = useState(false);
	const [sellAmount, setSellAmount] = useState("");
	const [lookupCode, setLookupCode] = useState("");
	const [reloadAmount, setReloadAmount] = useState("");
	const [reloadCardId, setReloadCardId] = useState("");
	const [soldCard, setSoldCard] = useState<{
		code: string;
		initialBalance: string;
	} | null>(null);
	const [lookedUp, setLookedUp] = useState<{
		id: string;
		code: string;
		currentBalance: string;
		initialBalance: string;
		isActive: boolean;
		createdAt: string | Date;
		transactions: Array<{
			id: string;
			type: string;
			amount: string;
			balanceAfter: string;
			createdAt: string | Date;
		}>;
	} | null>(null);

	const [cardSearch, setCardSearch] = useState("");
	const [cardStatusFilter, setCardStatusFilter] = useState("all");

	const { data: cards = [], isLoading } = useQuery(
		orpc.giftcards.list.queryOptions({ input: {} }),
	);

	const listKey = orpc.giftcards.list.queryOptions({ input: {} }).queryKey;

	const createMut = useMutation(
		orpc.giftcards.create.mutationOptions({
			onSuccess: (data) => {
				queryClient.invalidateQueries({ queryKey: listKey });
				setSoldCard({ code: data.code, initialBalance: data.initialBalance });
				setSellAmount("");
				toast.success("Gift card created!");
			},
			onError: (err) =>
				toast.error(err.message || "Failed to create gift card"),
		}),
	);

	const lookupMut = useMutation(
		orpc.giftcards.lookup.mutationOptions({
			onSuccess: (data) => {
				setLookedUp(data);
			},
			onError: (err) => toast.error(err.message || "Gift card not found"),
		}),
	);

	const reloadMut = useMutation(
		orpc.giftcards.reload.mutationOptions({
			onSuccess: (data) => {
				queryClient.invalidateQueries({ queryKey: listKey });
				setReloadOpen(false);
				setReloadAmount("");
				toast.success(`Reloaded! New balance: ${formatGYD(data.newBalance)}`);
			},
			onError: (err) => toast.error(err.message || "Failed to reload"),
		}),
	);

	function handleSell() {
		const amount = Number(sellAmount);
		if (!amount || amount < 100) {
			toast.error("Minimum amount is GYD $100");
			return;
		}
		createMut.mutate({ initialBalance: amount });
	}

	function handleLookup() {
		if (!lookupCode.trim()) {
			toast.error("Enter a gift card code");
			return;
		}
		setLookedUp(null);
		lookupMut.mutate({ code: lookupCode.trim() });
	}

	function handleReload() {
		const amount = Number(reloadAmount);
		if (!amount || amount < 100) {
			toast.error("Minimum reload is GYD $100");
			return;
		}
		reloadMut.mutate({ giftCardId: reloadCardId, amount });
	}

	const totalActive = cards.filter(
		(c) => c.isActive && Number(c.currentBalance) > 0,
	).length;
	const totalOutstanding = cards.reduce(
		(s, c) => s + (c.isActive ? Number(c.currentBalance) : 0),
		0,
	);

	const cardQ = cardSearch.trim().toLowerCase();
	const filteredCards = cards.filter((c) => {
		if (cardQ) {
			const matchesCode = c.code.toLowerCase().includes(cardQ);
			const matchesCustomer = (c.customerName ?? "")
				.toLowerCase()
				.includes(cardQ);
			if (!matchesCode && !matchesCustomer) return false;
		}
		if (cardStatusFilter === "active") {
			if (!c.isActive || Number(c.currentBalance) <= 0) return false;
		} else if (cardStatusFilter === "inactive") {
			if (c.isActive) return false;
		} else if (cardStatusFilter === "empty") {
			if (Number(c.currentBalance) !== 0) return false;
		}
		return true;
	});

	return (
		<div className="space-y-6 p-4 md:p-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="flex items-center gap-2 font-bold text-2xl">
						<CreditCard className="size-6 text-primary" />
						Gift Cards
					</h1>
					<p className="text-muted-foreground text-sm">
						Sell, reload, and look up gift cards. Track balances and transaction
						history. {totalActive} active card{totalActive !== 1 ? "s" : ""}{" "}
						with {formatGYD(totalOutstanding)} outstanding.
					</p>
				</div>
				<div className="flex gap-2">
					<Button
						variant="outline"
						onClick={() => {
							setLookupCode("");
							setLookedUp(null);
							setLookupOpen(true);
						}}
					>
						<Search className="mr-2 size-4" />
						Lookup
					</Button>
					<Button
						onClick={() => {
							setSoldCard(null);
							setSellAmount("");
							setSellOpen(true);
						}}
					>
						<Plus className="mr-2 size-4" />
						Sell Gift Card
					</Button>
				</div>
			</div>

			<div className="grid gap-4 sm:grid-cols-3">
				<Card>
					<CardContent className="pt-6">
						<div className="text-muted-foreground text-sm">Active Cards</div>
						<div className="font-bold text-3xl">{totalActive}</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="pt-6">
						<div className="text-muted-foreground text-sm">
							Outstanding Balance
						</div>
						<div className="font-bold text-3xl">
							{formatGYD(totalOutstanding)}
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="pt-6">
						<div className="text-muted-foreground text-sm">Total Issued</div>
						<div className="font-bold text-3xl">{cards.length}</div>
					</CardContent>
				</Card>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>All Gift Cards</CardTitle>
					<CardDescription>
						Every gift card issued, with current balance and status. Click the
						reload icon to add funds.
					</CardDescription>
					{/* Filter bar */}
					<div className="flex flex-wrap items-center gap-3 pt-1">
						<Filter className="size-4 shrink-0 text-muted-foreground" />
						<div className="relative">
							<Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
							<Input
								placeholder="Code or customer..."
								value={cardSearch}
								onChange={(e) => setCardSearch(e.target.value)}
								className="h-9 w-52 pl-9"
							/>
						</div>
						<Select
							value={cardStatusFilter}
							onValueChange={setCardStatusFilter}
						>
							<SelectTrigger className="h-9 w-44">
								<SelectValue placeholder="All statuses" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All Statuses</SelectItem>
								<SelectItem value="active">Active</SelectItem>
								<SelectItem value="inactive">Inactive</SelectItem>
								<SelectItem value="empty">Empty (no balance)</SelectItem>
							</SelectContent>
						</Select>
						<span className="text-muted-foreground text-sm">
							{filteredCards.length} card{filteredCards.length !== 1 ? "s" : ""}
						</span>
					</div>
				</CardHeader>
				<CardContent className="p-0">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Code</TableHead>
								<TableHead>Customer</TableHead>
								<TableHead className="text-right">Initial</TableHead>
								<TableHead className="text-right">Balance</TableHead>
								<TableHead>Status</TableHead>
								<TableHead>Created</TableHead>
								<TableHead className="w-20" />
							</TableRow>
						</TableHeader>
						<TableBody>
							{isLoading ? (
								<TableRow>
									<TableCell
										colSpan={7}
										className="py-8 text-center text-muted-foreground"
									>
										<Skeleton className="h-4 w-full" />
									</TableCell>
								</TableRow>
							) : filteredCards.length === 0 ? (
								<TableRow>
									<TableCell
										colSpan={7}
										className="py-8 text-center text-muted-foreground"
									>
										<CreditCard className="mx-auto mb-2 size-8 opacity-50" />
										<p className="font-medium">No gift cards found</p>
										<p className="mt-1 text-xs">
											{cards.length === 0
												? 'Click "Sell Gift Card" to create one with a starting balance.'
												: "Try adjusting your search or filter."}
										</p>
									</TableCell>
								</TableRow>
							) : (
								filteredCards.map((card) => {
									const balance = Number(card.currentBalance);
									return (
										<TableRow key={card.id}>
											<TableCell className="font-medium font-mono">
												{card.code}
											</TableCell>
											<TableCell>
												{card.customerName || (
													<span className="text-muted-foreground">—</span>
												)}
											</TableCell>
											<TableCell className="text-right">
												{formatGYD(Number(card.initialBalance))}
											</TableCell>
											<TableCell className="text-right font-medium">
												{formatGYD(balance)}
											</TableCell>
											<TableCell>
												{!card.isActive ? (
													<Badge variant="secondary">Inactive</Badge>
												) : balance <= 0 ? (
													<Badge variant="destructive">Empty</Badge>
												) : (
													<Badge variant="default">Active</Badge>
												)}
											</TableCell>
											<TableCell className="text-muted-foreground text-sm">
												{new Date(card.createdAt).toLocaleDateString()}
											</TableCell>
											<TableCell>
												<Button
													variant="ghost"
													size="sm"
													onClick={() => {
														setReloadCardId(card.id);
														setReloadAmount("");
														setReloadOpen(true);
													}}
													disabled={!card.isActive}
												>
													<RefreshCw className="size-3.5" />
												</Button>
											</TableCell>
										</TableRow>
									);
								})
							)}
						</TableBody>
					</Table>
				</CardContent>
			</Card>

			{/* Sell Gift Card Dialog */}
			<Dialog open={sellOpen} onOpenChange={setSellOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Sell Gift Card</DialogTitle>
						<DialogDescription>
							Create a new gift card with a specified balance
						</DialogDescription>
					</DialogHeader>
					{soldCard ? (
						<div className="py-6 text-center">
							<CreditCard className="mx-auto mb-3 size-12 text-primary" />
							<p className="mb-1 font-semibold text-lg">Gift Card Created!</p>
							<p className="mb-2 font-bold font-mono text-2xl tracking-widest">
								{soldCard.code}
							</p>
							<p className="text-muted-foreground">
								Balance: {formatGYD(Number(soldCard.initialBalance))}
							</p>
						</div>
					) : (
						<div className="space-y-4">
							<div>
								<Label>Amount (GYD)</Label>
								<Input
									type="number"
									min={100}
									step={100}
									value={sellAmount}
									onChange={(e) => setSellAmount(e.target.value)}
									placeholder="e.g. 5000"
								/>
								<p className="mt-1 text-muted-foreground text-xs">
									Minimum: {formatGYD(100)}
								</p>
							</div>
							<div className="flex flex-wrap gap-2">
								{[1000, 2000, 5000, 10000].map((amt) => (
									<Button
										key={amt}
										variant="outline"
										size="sm"
										onClick={() => setSellAmount(String(amt))}
									>
										{formatGYD(amt)}
									</Button>
								))}
							</div>
						</div>
					)}
					<DialogFooter>
						<Button variant="outline" onClick={() => setSellOpen(false)}>
							{soldCard ? "Close" : "Cancel"}
						</Button>
						{!soldCard && (
							<Button onClick={handleSell} disabled={createMut.isPending}>
								{createMut.isPending ? "Creating..." : "Create Gift Card"}
							</Button>
						)}
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Lookup Dialog */}
			<Dialog open={lookupOpen} onOpenChange={setLookupOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Lookup Gift Card</DialogTitle>
						<DialogDescription>
							Check balance and transaction history
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4">
						<div className="flex gap-2">
							<Input
								value={lookupCode}
								onChange={(e) => setLookupCode(e.target.value.toUpperCase())}
								placeholder="Enter gift card code (e.g. GC-XXXX-XXXX)"
								className="font-mono uppercase"
							/>
							<Button onClick={handleLookup} disabled={lookupMut.isPending}>
								{lookupMut.isPending ? "..." : "Look up"}
							</Button>
						</div>

						{lookedUp && (
							<div className="space-y-4">
								<div className="rounded-lg bg-muted p-4 text-center">
									<p className="mb-1 text-muted-foreground text-sm">
										Current Balance
									</p>
									<p className="font-bold text-3xl">
										{formatGYD(Number(lookedUp.currentBalance))}
									</p>
									<Badge
										variant={
											Number(lookedUp.currentBalance) > 0
												? "default"
												: "destructive"
										}
										className="mt-2"
									>
										{Number(lookedUp.currentBalance) > 0 ? "Active" : "Empty"}
									</Badge>
								</div>

								{lookedUp.transactions.length > 0 && (
									<div>
										<h4 className="mb-2 flex items-center gap-1 font-semibold text-sm">
											<History className="size-3.5" />
											Transaction History
										</h4>
										<div className="max-h-48 space-y-1 overflow-y-auto">
											{lookedUp.transactions.map((txn) => (
												<div
													key={txn.id}
													className="flex items-center justify-between rounded border p-2 text-sm"
												>
													<div className="flex items-center gap-2">
														<Badge
															variant={
																txn.type === "purchase" || txn.type === "reload"
																	? "default"
																	: "secondary"
															}
															className="text-xs capitalize"
														>
															{txn.type}
														</Badge>
														<span className="text-muted-foreground">
															{new Date(txn.createdAt).toLocaleDateString()}
														</span>
													</div>
													<span
														className={`font-medium ${
															Number(txn.amount) >= 0
																? "text-green-600"
																: "text-red-600"
														}`}
													>
														{Number(txn.amount) >= 0 ? "+" : ""}
														{formatGYD(Number(txn.amount))}
													</span>
												</div>
											))}
										</div>
									</div>
								)}
							</div>
						)}
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setLookupOpen(false)}>
							Close
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Reload Dialog */}
			<Dialog open={reloadOpen} onOpenChange={setReloadOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Reload Gift Card</DialogTitle>
						<DialogDescription>
							Add balance to an existing gift card
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4">
						<div>
							<Label>Reload Amount (GYD)</Label>
							<Input
								type="number"
								min={100}
								step={100}
								value={reloadAmount}
								onChange={(e) => setReloadAmount(e.target.value)}
								placeholder="e.g. 2000"
							/>
						</div>
						<div className="flex flex-wrap gap-2">
							{[1000, 2000, 5000].map((amt) => (
								<Button
									key={amt}
									variant="outline"
									size="sm"
									onClick={() => setReloadAmount(String(amt))}
								>
									{formatGYD(amt)}
								</Button>
							))}
						</div>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setReloadOpen(false)}>
							Cancel
						</Button>
						<Button onClick={handleReload} disabled={reloadMut.isPending}>
							{reloadMut.isPending ? "Reloading..." : "Reload"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
