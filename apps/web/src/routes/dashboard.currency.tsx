import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRightLeft, DollarSign, Info, Loader2 } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { formatGYD } from "@/lib/types";
import { orpc } from "@/utils/orpc";

export default function CurrencyPage() {
	const queryClient = useQueryClient();

	const { data: exchangeData, isLoading } = useQuery(
		orpc.settings.getExchangeRates.queryOptions({ input: {} }),
	);

	const [rate, setRate] = useState<string>("");
	const [acceptUsd, setAcceptUsd] = useState(false);
	const [initialized, setInitialized] = useState(false);

	// Populate form when data loads
	if (exchangeData && !initialized) {
		setRate(exchangeData.usdToGydRate.toString());
		setAcceptUsd(exchangeData.acceptUsd);
		setInitialized(true);
	}

	const updateMutation = useMutation(
		orpc.settings.updateExchangeRate.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.settings.getExchangeRates.queryOptions({ input: {} })
						.queryKey,
				});
				toast.success("Exchange rate settings saved");
			},
			onError: (err) =>
				toast.error(err.message || "Failed to save exchange rate"),
		}),
	);

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		const rateNum = Number.parseFloat(rate);
		if (Number.isNaN(rateNum) || rateNum < 1) {
			toast.error("Rate must be at least 1");
			return;
		}
		updateMutation.mutate({ usdToGydRate: rateNum, acceptUsd });
	}

	const previewRate = Number.parseFloat(rate) || 209.21;
	const previewUsd = 10;
	const previewGyd = previewUsd * previewRate;

	if (isLoading) {
		return (
			<div className="flex flex-col gap-6 p-4 md:p-6">
				<div>
					<h1 className="flex items-center gap-2 font-bold text-2xl text-foreground tracking-tight">
						<DollarSign className="size-6 text-primary" /> Multi-Currency
						Settings
					</h1>
					<p className="text-muted-foreground text-sm">
						Configure USD acceptance and exchange rates for GYD/USD.
					</p>
				</div>
				<Card>
					<CardContent className="flex items-center justify-center py-12">
						<Loader2 className="size-6 animate-spin text-muted-foreground" />
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-6 p-4 md:p-6">
			<div>
				<h1 className="flex items-center gap-2 font-bold text-2xl text-foreground tracking-tight">
					<DollarSign className="size-6 text-primary" /> Multi-Currency Settings
				</h1>
				<p className="text-muted-foreground text-sm">
					Configure USD acceptance and exchange rates for GYD/USD. The rate is
					used across the POS for payment conversion.
				</p>
			</div>

			<div className="grid gap-6 lg:grid-cols-2">
				{/* Settings Form */}
				<Card>
					<CardHeader>
						<CardTitle>Exchange Rate Configuration</CardTitle>
						<CardDescription>
							Set the USD to GYD conversion rate used across the POS system.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<form onSubmit={handleSubmit} className="flex flex-col gap-5">
							<div className="flex items-center justify-between rounded-lg border border-border p-4">
								<div className="flex flex-col gap-0.5">
									<Label htmlFor="accept-usd" className="font-medium text-sm">
										Accept USD Payments
									</Label>
									<p className="text-muted-foreground text-xs">
										Allow customers to pay in US Dollars
									</p>
								</div>
								<Switch
									id="accept-usd"
									checked={acceptUsd}
									onCheckedChange={setAcceptUsd}
								/>
							</div>

							<div className="flex flex-col gap-1.5">
								<Label htmlFor="exchange-rate">USD to GYD Rate</Label>
								<div className="relative">
									<Input
										id="exchange-rate"
										type="number"
										step="0.01"
										min="1"
										value={rate}
										onChange={(e) => setRate(e.target.value)}
										className="pl-16"
										required
									/>
									<span className="absolute top-1/2 left-3 -translate-y-1/2 font-medium text-muted-foreground text-xs">
										1 USD =
									</span>
								</div>
								<p className="text-muted-foreground text-xs">
									Enter how many GYD equal 1 USD
								</p>
							</div>

							{/* Live Preview */}
							<div className="rounded-lg border border-border bg-muted/50 p-4">
								<div className="mb-2 flex items-center gap-1.5 font-medium text-muted-foreground text-xs">
									<ArrowRightLeft className="size-3.5" />
									Live Preview
								</div>
								<div className="flex items-center gap-3 font-semibold text-lg">
									<span>USD ${previewUsd.toFixed(2)}</span>
									<ArrowRightLeft className="size-4 text-muted-foreground" />
									<span className="text-primary">
										GYD {formatGYD(previewGyd)}
									</span>
								</div>
							</div>

							{exchangeData?.updatedAt && (
								<p className="text-muted-foreground text-xs">
									Last updated:{" "}
									{new Date(exchangeData.updatedAt).toLocaleString()}
								</p>
							)}

							<Button type="submit" disabled={updateMutation.isPending}>
								{updateMutation.isPending && (
									<Loader2 className="mr-2 size-4 animate-spin" />
								)}
								Save Exchange Rate Settings
							</Button>
						</form>
					</CardContent>
				</Card>

				{/* Info & Status */}
				<div className="flex flex-col gap-6">
					<Card>
						<CardHeader>
							<CardTitle>Current Status</CardTitle>
							<CardDescription>
								Active currency settings used by the POS at checkout.
							</CardDescription>
						</CardHeader>
						<CardContent className="flex flex-col gap-3">
							<div className="flex items-center justify-between">
								<span className="text-muted-foreground text-sm">
									Primary Currency
								</span>
								<Badge variant="default">GYD</Badge>
							</div>
							<div className="flex items-center justify-between">
								<span className="text-muted-foreground text-sm">
									USD Acceptance
								</span>
								<Badge
									variant={exchangeData?.acceptUsd ? "default" : "secondary"}
								>
									{exchangeData?.acceptUsd ? "Enabled" : "Disabled"}
								</Badge>
							</div>
							<div className="flex items-center justify-between">
								<span className="text-muted-foreground text-sm">
									Active Rate
								</span>
								<span className="font-medium font-mono text-sm">
									1 USD = {(exchangeData?.usdToGydRate ?? 209.21).toFixed(2)}{" "}
									GYD
								</span>
							</div>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<div className="flex items-center gap-2">
								<Info className="size-4 text-muted-foreground" />
								<CardTitle className="text-base">
									About GYD/USD Exchange
								</CardTitle>
							</div>
						</CardHeader>
						<CardContent className="text-muted-foreground text-sm leading-relaxed">
							<p className="mb-3">
								The Guyanese Dollar (GYD) has been relatively stable against the
								US Dollar. The rate has hovered around{" "}
								<strong className="text-foreground">
									208-210 GYD per 1 USD
								</strong>{" "}
								for an extended period.
							</p>
							<p className="mb-3">
								Guyana uses a managed float exchange rate regime. The Bank of
								Guyana periodically intervenes to maintain stability.
							</p>
							<p>
								When USD payments are enabled, the POS will record both the USD
								amount and the converted GYD equivalent using the configured
								rate. All reports and totals remain in GYD as the primary
								currency.
							</p>
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}
