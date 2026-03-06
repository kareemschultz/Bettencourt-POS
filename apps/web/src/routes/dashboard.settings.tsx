import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	Building2,
	Loader2,
	MapPin,
	Monitor,
	Percent,
	Plus,
	ReceiptText,
	Settings,
	Users,
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
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { orpc } from "@/utils/orpc";

export default function SettingsPage() {
	const [activeTab, setActiveTab] = useState("organization");

	return (
		<div className="flex flex-col gap-6 p-4 md:p-6">
			<div>
				<h1 className="flex items-center gap-2 font-bold text-2xl text-foreground tracking-tight">
					<Settings className="size-6 text-primary" /> Settings
				</h1>
				<p className="text-muted-foreground text-sm">
					Manage your organization, locations, registers, users, tax rates, and
					receipt layout. Changes here apply across all registers and locations.
				</p>
			</div>

			<Tabs value={activeTab} onValueChange={setActiveTab}>
				<TabsList className="grid w-full grid-cols-6 lg:flex lg:w-auto lg:grid-cols-none">
					<TabsTrigger value="organization" className="gap-1.5">
						<Building2 className="size-3.5" />
						<span className="hidden sm:inline">Organization</span>
					</TabsTrigger>
					<TabsTrigger value="locations" className="gap-1.5">
						<MapPin className="size-3.5" />
						<span className="hidden sm:inline">Locations</span>
					</TabsTrigger>
					<TabsTrigger value="registers" className="gap-1.5">
						<Monitor className="size-3.5" />
						<span className="hidden sm:inline">Registers</span>
					</TabsTrigger>
					<TabsTrigger value="users" className="gap-1.5">
						<Users className="size-3.5" />
						<span className="hidden sm:inline">Users</span>
					</TabsTrigger>
					<TabsTrigger value="tax" className="gap-1.5">
						<Percent className="size-3.5" />
						<span className="hidden sm:inline">Tax Rates</span>
					</TabsTrigger>
					<TabsTrigger value="receipt" className="gap-1.5">
						<ReceiptText className="size-3.5" />
						<span className="hidden sm:inline">Receipt</span>
					</TabsTrigger>
				</TabsList>

				<TabsContent value="organization" className="mt-4">
					<OrganizationTab />
				</TabsContent>
				<TabsContent value="locations" className="mt-4">
					<LocationsTab />
				</TabsContent>
				<TabsContent value="registers" className="mt-4">
					<RegistersTab />
				</TabsContent>
				<TabsContent value="users" className="mt-4">
					<UsersTab />
				</TabsContent>
				<TabsContent value="tax" className="mt-4">
					<TaxRatesTab />
				</TabsContent>
				<TabsContent value="receipt" className="mt-4">
					<ReceiptConfigTab />
				</TabsContent>
			</Tabs>
		</div>
	);
}

// ── Organization Tab ───────────────────────────────────────────────────

function OrganizationTab() {
	const { data: org, isLoading } = useQuery(
		orpc.settings.getOrganization.queryOptions({ input: {} }),
	);

	if (isLoading) return <LoadingCard />;

	return (
		<Card>
			<CardHeader>
				<CardTitle>Organization Details</CardTitle>
				<CardDescription>Your business information.</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="grid gap-4 sm:grid-cols-2">
					<div className="flex flex-col gap-1.5">
						<Label>Business Name</Label>
						<Input defaultValue={org?.name ?? ""} readOnly />
					</div>
					<div className="flex flex-col gap-1.5">
						<Label>Currency</Label>
						<Input defaultValue="GYD" disabled />
					</div>
					<div className="flex flex-col gap-1.5 sm:col-span-2">
						<Label>Slug</Label>
						<Input defaultValue={org?.slug ?? ""} readOnly />
					</div>
				</div>
				<p className="mt-4 text-muted-foreground text-xs">
					Organization details are managed through the admin panel.
				</p>
			</CardContent>
		</Card>
	);
}

// ── Locations Tab ──────────────────────────────────────────────────────

function LocationsTab() {
	const { data: locations = [], isLoading } = useQuery(
		orpc.settings.getLocations.queryOptions({ input: {} }),
	);

	if (isLoading) return <LoadingCard />;

	return (
		<Card>
			<CardHeader className="flex flex-row items-center justify-between">
				<div>
					<CardTitle>Locations</CardTitle>
					<CardDescription>
						{locations.length} active location
						{locations.length !== 1 ? "s" : ""}
					</CardDescription>
				</div>
			</CardHeader>
			<CardContent>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Name</TableHead>
							<TableHead>Address</TableHead>
							<TableHead>Timezone</TableHead>
							<TableHead>Status</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{locations.length === 0 ? (
							<TableRow>
								<TableCell
									colSpan={4}
									className="py-8 text-center text-muted-foreground"
								>
									No locations configured.
								</TableCell>
							</TableRow>
						) : (
							locations.map((loc) => (
								<TableRow key={loc.id}>
									<TableCell className="font-medium">{loc.name}</TableCell>
									<TableCell className="text-muted-foreground">
										{loc.address || "—"}
									</TableCell>
									<TableCell className="font-mono text-muted-foreground text-xs">
										{loc.timezone}
									</TableCell>
									<TableCell>
										<Badge variant={loc.isActive ? "default" : "secondary"}>
											{loc.isActive ? "Active" : "Inactive"}
										</Badge>
									</TableCell>
								</TableRow>
							))
						)}
					</TableBody>
				</Table>
			</CardContent>
		</Card>
	);
}

// ── Registers Tab ──────────────────────────────────────────────────────

function RegistersTab() {
	const { data: registers = [], isLoading: loadingRegisters } = useQuery(
		orpc.settings.getRegisters.queryOptions({ input: {} }),
	);
	const { data: locations = [] } = useQuery(
		orpc.settings.getLocations.queryOptions({ input: {} }),
	);

	if (loadingRegisters) return <LoadingCard />;

	const locationMap = new Map(locations.map((l) => [l.id, l.name]));

	return (
		<Card>
			<CardHeader className="flex flex-row items-center justify-between">
				<div>
					<CardTitle>Registers</CardTitle>
					<CardDescription>
						{registers.length} active register
						{registers.length !== 1 ? "s" : ""}
					</CardDescription>
				</div>
			</CardHeader>
			<CardContent>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Name</TableHead>
							<TableHead>Location</TableHead>
							<TableHead>Workflow</TableHead>
							<TableHead>Status</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{registers.length === 0 ? (
							<TableRow>
								<TableCell
									colSpan={4}
									className="py-8 text-center text-muted-foreground"
								>
									No registers configured.
								</TableCell>
							</TableRow>
						) : (
							registers.map((reg) => (
								<TableRow key={reg.id}>
									<TableCell className="font-medium">{reg.name}</TableCell>
									<TableCell className="text-muted-foreground">
										{locationMap.get(reg.locationId) ?? "Unknown"}
									</TableCell>
									<TableCell>
										<Badge variant="outline" className="text-[10px]">
											{reg.workflowMode ?? "standard"}
										</Badge>
									</TableCell>
									<TableCell>
										<Badge variant={reg.isActive ? "default" : "secondary"}>
											{reg.isActive ? "Active" : "Inactive"}
										</Badge>
									</TableCell>
								</TableRow>
							))
						)}
					</TableBody>
				</Table>
			</CardContent>
		</Card>
	);
}

// ── Users Tab ──────────────────────────────────────────────────────────

function UsersTab() {
	const queryClient = useQueryClient();
	const [showCreate, setShowCreate] = useState(false);
	const [newName, setNewName] = useState("");
	const [newEmail, setNewEmail] = useState("");
	const [newRole, setNewRole] = useState("user");

	const { data: users = [], isLoading } = useQuery(
		orpc.settings.getUsers.queryOptions({ input: {} }),
	);

	const createUser = useMutation(
		orpc.settings.createUser.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.settings.getUsers.queryOptions({ input: {} }).queryKey,
				});
				setShowCreate(false);
				setNewName("");
				setNewEmail("");
				setNewRole("user");
				toast.success("User created");
			},
			onError: (err) => {
				toast.error(err.message || "Failed to create user");
			},
		}),
	);

	if (isLoading) return <LoadingCard />;

	return (
		<>
			<Card>
				<CardHeader className="flex flex-row items-center justify-between">
					<div>
						<CardTitle>Users</CardTitle>
						<CardDescription>
							{users.length} staff account{users.length !== 1 ? "s" : ""}
						</CardDescription>
					</div>
					<Button
						size="sm"
						className="gap-1.5"
						onClick={() => setShowCreate(true)}
					>
						<Plus className="size-3.5" /> Add User
					</Button>
				</CardHeader>
				<CardContent>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Name</TableHead>
								<TableHead>Email</TableHead>
								<TableHead>Role</TableHead>
								<TableHead>Created</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{users.length === 0 ? (
								<TableRow>
									<TableCell
										colSpan={4}
										className="py-8 text-center text-muted-foreground"
									>
										No users found.
									</TableCell>
								</TableRow>
							) : (
								users.map((u) => (
									<TableRow key={u.id}>
										<TableCell className="font-medium">{u.name}</TableCell>
										<TableCell className="text-muted-foreground">
											{u.email}
										</TableCell>
										<TableCell>
											<Badge
												variant={u.role === "admin" ? "default" : "outline"}
											>
												{u.role ?? "user"}
											</Badge>
										</TableCell>
										<TableCell className="text-muted-foreground text-xs">
											{u.createdAt
												? new Date(u.createdAt).toLocaleDateString()
												: "—"}
										</TableCell>
									</TableRow>
								))
							)}
						</TableBody>
					</Table>
				</CardContent>
			</Card>

			<Dialog open={showCreate} onOpenChange={setShowCreate}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Add User</DialogTitle>
					</DialogHeader>
					<form
						onSubmit={(e) => {
							e.preventDefault();
							createUser.mutate({
								name: newName,
								email: newEmail,
								role: newRole,
							});
						}}
						className="flex flex-col gap-4"
					>
						<div className="flex flex-col gap-1.5">
							<Label htmlFor="user-name">Name</Label>
							<Input
								id="user-name"
								value={newName}
								onChange={(e) => setNewName(e.target.value)}
								required
							/>
						</div>
						<div className="flex flex-col gap-1.5">
							<Label htmlFor="user-email">Email</Label>
							<Input
								id="user-email"
								type="email"
								value={newEmail}
								onChange={(e) => setNewEmail(e.target.value)}
								required
							/>
						</div>
						<div className="flex flex-col gap-1.5">
							<Label htmlFor="user-role">Role</Label>
							<Select value={newRole} onValueChange={setNewRole}>
								<SelectTrigger id="user-role">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="user">User</SelectItem>
									<SelectItem value="cashier">Cashier</SelectItem>
									<SelectItem value="admin">Admin</SelectItem>
									<SelectItem value="executive">Executive</SelectItem>
								</SelectContent>
							</Select>
						</div>
						<DialogFooter>
							<Button
								type="button"
								variant="outline"
								onClick={() => setShowCreate(false)}
							>
								Cancel
							</Button>
							<Button type="submit" disabled={createUser.isPending}>
								{createUser.isPending && (
									<Loader2 className="mr-2 size-4 animate-spin" />
								)}
								Create User
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
		</>
	);
}

// ── Tax Rates Tab ──────────────────────────────────────────────────────

function TaxRatesTab() {
	const queryClient = useQueryClient();
	const [showDialog, setShowDialog] = useState(false);
	const [editingRate, setEditingRate] = useState<{
		id: string;
		name: string;
		rate: string;
		isDefault: boolean;
	} | null>(null);
	const [formName, setFormName] = useState("");
	const [formRate, setFormRate] = useState("");
	const [formDefault, setFormDefault] = useState(false);

	const { data: rates = [], isLoading } = useQuery(
		orpc.settings.getTaxRates.queryOptions({ input: {} }),
	);

	const { data: org } = useQuery(
		orpc.settings.getOrganization.queryOptions({ input: {} }),
	);

	const taxQueryKey = orpc.settings.getTaxRates.queryOptions({
		input: {},
	}).queryKey;

	const createRate = useMutation(
		orpc.settings.createTaxRate.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: taxQueryKey });
				closeDialog();
				toast.success("Tax rate created");
			},
			onError: (err) => toast.error(err.message || "Failed to create tax rate"),
		}),
	);

	const updateRateMut = useMutation(
		orpc.settings.updateTaxRate.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: taxQueryKey });
				closeDialog();
				toast.success("Tax rate updated");
			},
			onError: (err) => toast.error(err.message || "Failed to update tax rate"),
		}),
	);

	const deleteRate = useMutation(
		orpc.settings.deleteTaxRate.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: taxQueryKey });
				toast.success("Tax rate deleted");
			},
			onError: (err) => toast.error(err.message || "Failed to delete tax rate"),
		}),
	);

	function openCreate() {
		setEditingRate(null);
		setFormName("");
		setFormRate("");
		setFormDefault(false);
		setShowDialog(true);
	}

	function openEdit(rate: (typeof rates)[number]) {
		setEditingRate({
			id: rate.id,
			name: rate.name,
			rate: rate.rate,
			isDefault: rate.isDefault,
		});
		setFormName(rate.name);
		setFormRate((Number(rate.rate) * 100).toString());
		setFormDefault(rate.isDefault);
		setShowDialog(true);
	}

	function closeDialog() {
		setShowDialog(false);
		setEditingRate(null);
	}

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		const rateNum = Number.parseFloat(formRate);
		if (Number.isNaN(rateNum) || rateNum < 0 || rateNum > 100) {
			toast.error("Rate must be between 0 and 100");
			return;
		}
		if (editingRate) {
			updateRateMut.mutate({
				id: editingRate.id,
				name: formName,
				rate: rateNum,
				isDefault: formDefault,
			});
		} else {
			createRate.mutate({
				organizationId: org?.id ?? "",
				name: formName,
				rate: rateNum,
				isDefault: formDefault,
			});
		}
	}

	const previewRate = Number.parseFloat(formRate) || 0;
	const previewTax = (1000 * previewRate) / 100;
	const previewTotal = 1000 + previewTax;

	if (isLoading) return <LoadingCard />;

	return (
		<>
			<Card>
				<CardHeader className="flex flex-row items-center justify-between">
					<div>
						<CardTitle>Tax Rates</CardTitle>
						<CardDescription>
							{rates.length} active tax rate{rates.length !== 1 ? "s" : ""}
						</CardDescription>
					</div>
					<Button size="sm" className="gap-1.5" onClick={openCreate}>
						<Plus className="size-3.5" /> Add Tax Rate
					</Button>
				</CardHeader>
				<CardContent>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Name</TableHead>
								<TableHead className="text-right">Rate</TableHead>
								<TableHead>Default</TableHead>
								<TableHead className="text-right">Actions</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{rates.length === 0 ? (
								<TableRow>
									<TableCell
										colSpan={4}
										className="py-8 text-center text-muted-foreground"
									>
										No tax rates configured.
									</TableCell>
								</TableRow>
							) : (
								rates.map((rate) => (
									<TableRow key={rate.id}>
										<TableCell className="font-medium">{rate.name}</TableCell>
										<TableCell className="text-right font-mono">
											{(Number(rate.rate) * 100).toFixed(1)}%
										</TableCell>
										<TableCell>
											{rate.isDefault && (
												<Badge variant="secondary">Default</Badge>
											)}
										</TableCell>
										<TableCell className="text-right">
											<div className="flex justify-end gap-1">
												<Button
													variant="ghost"
													size="sm"
													onClick={() => openEdit(rate)}
												>
													Edit
												</Button>
												<Button
													variant="ghost"
													size="sm"
													className="text-destructive hover:text-destructive"
													onClick={() => deleteRate.mutate({ id: rate.id })}
												>
													Delete
												</Button>
											</div>
										</TableCell>
									</TableRow>
								))
							)}
						</TableBody>
					</Table>
				</CardContent>
			</Card>

			<Dialog open={showDialog} onOpenChange={setShowDialog}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>
							{editingRate ? "Edit Tax Rate" : "Add Tax Rate"}
						</DialogTitle>
					</DialogHeader>
					<form onSubmit={handleSubmit} className="flex flex-col gap-4">
						<div className="flex flex-col gap-1.5">
							<Label htmlFor="tax-name">Name</Label>
							<Input
								id="tax-name"
								placeholder="e.g. VAT, Sales Tax"
								value={formName}
								onChange={(e) => setFormName(e.target.value)}
								required
							/>
						</div>
						<div className="flex flex-col gap-1.5">
							<Label htmlFor="tax-rate">Rate (%)</Label>
							<Input
								id="tax-rate"
								type="number"
								step="0.1"
								min="0"
								max="100"
								placeholder="e.g. 14"
								value={formRate}
								onChange={(e) => setFormRate(e.target.value)}
								required
							/>
						</div>
						<div className="flex items-center gap-2">
							<input
								id="tax-default"
								type="checkbox"
								checked={formDefault}
								onChange={(e) => setFormDefault(e.target.checked)}
								className="h-4 w-4 rounded border-input"
							/>
							<Label htmlFor="tax-default">Set as default tax rate</Label>
						</div>
						{previewRate > 0 && (
							<div className="rounded-md border border-border bg-muted/50 p-3 text-muted-foreground text-xs">
								Preview: A $1,000 item → $
								{previewTax.toLocaleString("en-US", {
									minimumFractionDigits: 0,
									maximumFractionDigits: 2,
								})}{" "}
								tax →{" "}
								<span className="font-bold text-foreground">
									$
									{previewTotal.toLocaleString("en-US", {
										minimumFractionDigits: 0,
										maximumFractionDigits: 2,
									})}{" "}
									total
								</span>
							</div>
						)}
						<DialogFooter>
							<Button type="button" variant="outline" onClick={closeDialog}>
								Cancel
							</Button>
							<Button
								type="submit"
								disabled={createRate.isPending || updateRateMut.isPending}
							>
								{(createRate.isPending || updateRateMut.isPending) && (
									<Loader2 className="mr-2 size-4 animate-spin" />
								)}
								{editingRate ? "Update" : "Create"}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
		</>
	);
}

// ── Receipt Config Tab ────────────────────────────────────────────────

function ReceiptConfigTab() {
	const queryClient = useQueryClient();

	const { data: org } = useQuery(
		orpc.settings.getOrganization.queryOptions({ input: {} }),
	);

	const { data: config, isLoading } = useQuery({
		...orpc.settings.getReceiptConfig.queryOptions({ input: {} }),
		enabled: true,
	});

	const [form, setForm] = useState({
		businessName: "",
		tagline: "",
		addressLine1: "",
		addressLine2: "",
		phone: "",
		footerMessage: "",
		promoMessage: "",
		showLogo: true,
	});
	const [initialized, setInitialized] = useState(false);

	// Populate form when config loads
	if (config && !initialized) {
		setForm({
			businessName: config.businessName ?? "",
			tagline: config.tagline ?? "",
			addressLine1: config.addressLine1 ?? "",
			addressLine2: config.addressLine2 ?? "",
			phone: config.phone ?? "",
			footerMessage: config.footerMessage ?? "",
			promoMessage: config.promoMessage ?? "",
			showLogo: config.showLogo ?? true,
		});
		setInitialized(true);
	}

	const updateConfig = useMutation(
		orpc.settings.updateReceiptConfig.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.settings.getReceiptConfig.queryOptions({ input: {} })
						.queryKey,
				});
				toast.success("Receipt settings saved");
			},
			onError: (err) =>
				toast.error(err.message || "Failed to save receipt settings"),
		}),
	);

	function handleSave(e: React.FormEvent) {
		e.preventDefault();
		updateConfig.mutate({
			organizationId: org?.id ?? "",
			businessName: form.businessName,
			tagline: form.tagline || null,
			addressLine1: form.addressLine1 || null,
			addressLine2: form.addressLine2 || null,
			phone: form.phone || null,
			footerMessage: form.footerMessage || null,
			promoMessage: form.promoMessage || null,
			showLogo: form.showLogo,
		});
	}

	function setField(key: keyof typeof form, value: string | boolean) {
		setForm((prev) => ({ ...prev, [key]: value }));
	}

	if (isLoading) return <LoadingCard />;

	return (
		<div className="grid gap-6 lg:grid-cols-2">
			{/* Form */}
			<Card>
				<CardHeader>
					<CardTitle>Receipt Settings</CardTitle>
					<CardDescription>
						Customize what appears on printed receipts.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<form onSubmit={handleSave} className="flex flex-col gap-4">
						<div className="flex flex-col gap-1.5">
							<Label htmlFor="rc-name">Business Name</Label>
							<Input
								id="rc-name"
								value={form.businessName}
								onChange={(e) => setField("businessName", e.target.value)}
								required
							/>
						</div>
						<div className="flex flex-col gap-1.5">
							<Label htmlFor="rc-tagline">Tagline</Label>
							<Input
								id="rc-tagline"
								placeholder="'A True Guyanese Gem'"
								value={form.tagline}
								onChange={(e) => setField("tagline", e.target.value)}
							/>
						</div>
						<div className="grid gap-4 sm:grid-cols-2">
							<div className="flex flex-col gap-1.5">
								<Label htmlFor="rc-addr1">Address Line 1</Label>
								<Input
									id="rc-addr1"
									placeholder="Street address"
									value={form.addressLine1}
									onChange={(e) => setField("addressLine1", e.target.value)}
								/>
							</div>
							<div className="flex flex-col gap-1.5">
								<Label htmlFor="rc-addr2">Address Line 2</Label>
								<Input
									id="rc-addr2"
									placeholder="City, Country"
									value={form.addressLine2}
									onChange={(e) => setField("addressLine2", e.target.value)}
								/>
							</div>
						</div>
						<div className="flex flex-col gap-1.5">
							<Label htmlFor="rc-phone">Phone</Label>
							<Input
								id="rc-phone"
								placeholder="+592-227-0000"
								value={form.phone}
								onChange={(e) => setField("phone", e.target.value)}
							/>
						</div>
						<div className="flex flex-col gap-1.5">
							<Label htmlFor="rc-footer">Footer Message</Label>
							<Textarea
								id="rc-footer"
								rows={2}
								placeholder="Thank you message"
								value={form.footerMessage}
								onChange={(e) => setField("footerMessage", e.target.value)}
							/>
						</div>
						<div className="flex flex-col gap-1.5">
							<Label htmlFor="rc-promo">Promo Message (optional)</Label>
							<Textarea
								id="rc-promo"
								rows={2}
								placeholder="Current promotion text"
								value={form.promoMessage}
								onChange={(e) => setField("promoMessage", e.target.value)}
							/>
						</div>
						<div className="flex items-center gap-2">
							<input
								id="rc-logo"
								type="checkbox"
								checked={form.showLogo}
								onChange={(e) => setField("showLogo", e.target.checked)}
								className="h-4 w-4 rounded border-input"
							/>
							<Label htmlFor="rc-logo">Show logo on receipt</Label>
						</div>
						<Button type="submit" disabled={updateConfig.isPending}>
							{updateConfig.isPending && (
								<Loader2 className="mr-2 size-4 animate-spin" />
							)}
							Save Receipt Settings
						</Button>
					</form>
				</CardContent>
			</Card>

			{/* Live Preview */}
			<Card>
				<CardHeader>
					<CardTitle>Receipt Preview</CardTitle>
					<CardDescription>
						Live preview of your receipt layout.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="rounded-lg border border-border bg-background p-5 font-mono text-xs leading-relaxed">
						<div className="mb-3 text-center">
							<p className="font-bold text-sm">
								{form.businessName || "Business Name"}
							</p>
							{form.tagline && (
								<p className="text-[10px] text-muted-foreground italic">
									{form.tagline}
								</p>
							)}
							{form.addressLine1 && (
								<p className="text-muted-foreground">{form.addressLine1}</p>
							)}
							{form.addressLine2 && (
								<p className="text-muted-foreground">{form.addressLine2}</p>
							)}
							{form.phone && (
								<p className="text-muted-foreground">Tel: {form.phone}</p>
							)}
						</div>
						<div className="mb-2 border-border border-t border-dashed pt-2">
							<div className="flex justify-between">
								<span>Order</span>
								<span className="font-bold">#001234</span>
							</div>
							<div className="flex justify-between">
								<span>Date</span>
								<span>{new Date().toLocaleDateString()}</span>
							</div>
							<div className="flex justify-between">
								<span>Served by</span>
								<span className="font-medium">Cashier</span>
							</div>
						</div>
						<div className="mb-2 border-border border-t border-dashed pt-2">
							<div className="flex justify-between">
								<span>2x Chicken Curry</span>
								<span>$3,000</span>
							</div>
							<div className="flex justify-between">
								<span>1x Roti</span>
								<span>$500</span>
							</div>
							<div className="flex justify-between">
								<span>1x Local Juice</span>
								<span>$400</span>
							</div>
						</div>
						<div className="mb-2 border-border border-t border-dashed pt-2">
							<div className="flex justify-between font-bold">
								<span>TOTAL</span>
								<span>$3,900</span>
							</div>
						</div>
						<div className="mt-3 text-center text-muted-foreground">
							{form.footerMessage && <p>{form.footerMessage}</p>}
							{form.promoMessage && (
								<p className="mt-1 font-medium text-[10px] text-primary">
									{form.promoMessage}
								</p>
							)}
						</div>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}

// ── Shared Loading Card ────────────────────────────────────────────────

function LoadingCard() {
	return (
		<Card>
			<CardContent className="flex items-center justify-center py-12">
				<Loader2 className="size-6 animate-spin text-muted-foreground" />
			</CardContent>
		</Card>
	);
}
