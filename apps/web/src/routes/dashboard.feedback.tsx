import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	Download,
	MessageSquare,
	Star,
	ThumbsDown,
	ThumbsUp,
	TrendingUp,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { downloadCsv } from "@/lib/csv-export";
import { todayGY } from "@/lib/utils";
import { orpc } from "@/utils/orpc";

function defaultStartDate(): string {
	const d = new Date();
	d.setDate(d.getDate() - 30);
	return d.toISOString().slice(0, 10);
}

type FeedbackRow = {
	id: string;
	rating: number;
	foodRating: number | null;
	serviceRating: number | null;
	ambienceRating: number | null;
	comment: string | null;
	customerName: string | null;
	customerEmail: string | null;
	source: string;
	createdAt: string;
};

type Summary = {
	total_reviews: number;
	avg_rating: string;
	avg_food: string;
	avg_service: string;
	avg_ambience: string;
	positive_count: number;
	negative_count: number;
	five_star: number;
	four_star: number;
	three_star: number;
	two_star: number;
	one_star: number;
};

export default function FeedbackPage() {
	const qc = useQueryClient();
	const [startDate, setStartDate] = useState(defaultStartDate());
	const [endDate, setEndDate] = useState(todayGY());
	const [addOpen, setAddOpen] = useState(false);

	const listKey = orpc.feedback.list.queryOptions({
		input: { startDate, endDate },
	}).queryKey;

	const { data: feedbacks = [], isLoading } = useQuery(
		orpc.feedback.list.queryOptions({
			input: { startDate, endDate },
		}),
	);

	const { data: summary } = useQuery(
		orpc.feedback.summary.queryOptions({
			input: { startDate, endDate },
		}),
	);

	const submitMut = useMutation(
		orpc.feedback.submit.mutationOptions({
			onSuccess: () => {
				qc.invalidateQueries({ queryKey: listKey });
				setAddOpen(false);
				toast.success("Feedback recorded");
			},
		}),
	);

	const rows = feedbacks as FeedbackRow[];
	const stats = summary as Summary | undefined;

	function renderStars(rating: number) {
		return Array.from({ length: 5 }, (_, i) => (
			<Star
				key={i}
				className={`size-3.5 ${i < rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`}
			/>
		));
	}

	function handleExport() {
		downloadCsv(
			`feedback-${startDate}-to-${endDate}.csv`,
			rows.map((r) => ({
				Date: new Date(r.createdAt).toLocaleDateString(),
				Rating: r.rating,
				Food: r.foodRating ?? "",
				Service: r.serviceRating ?? "",
				Ambience: r.ambienceRating ?? "",
				Customer: r.customerName || "",
				Comment: r.comment || "",
				Source: r.source,
			})),
		);
	}

	// Rating distribution bar
	const distribution = stats
		? [
				{ label: "5", count: stats.five_star, color: "bg-green-500" },
				{ label: "4", count: stats.four_star, color: "bg-lime-500" },
				{ label: "3", count: stats.three_star, color: "bg-yellow-500" },
				{ label: "2", count: stats.two_star, color: "bg-orange-500" },
				{ label: "1", count: stats.one_star, color: "bg-red-500" },
			]
		: [];

	const maxCount = Math.max(...distribution.map((d) => d.count), 1);

	return (
		<div className="space-y-6 p-4 md:p-6">
			<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="font-bold text-2xl tracking-tight">
						Customer Feedback
					</h1>
					<p className="text-muted-foreground text-sm">
						Reviews, ratings, and satisfaction metrics
					</p>
				</div>
				<div className="flex items-center gap-2">
					<div className="flex items-center gap-1.5">
						<Label className="text-xs">From</Label>
						<Input
							type="date"
							value={startDate}
							onChange={(e) => setStartDate(e.target.value)}
							className="h-8 w-36 text-xs"
						/>
					</div>
					<div className="flex items-center gap-1.5">
						<Label className="text-xs">To</Label>
						<Input
							type="date"
							value={endDate}
							onChange={(e) => setEndDate(e.target.value)}
							className="h-8 w-36 text-xs"
						/>
					</div>
					<Dialog open={addOpen} onOpenChange={setAddOpen}>
						<DialogTrigger asChild>
							<Button size="sm">
								<MessageSquare className="mr-1 size-3.5" /> Add
							</Button>
						</DialogTrigger>
						<DialogContent>
							<DialogHeader>
								<DialogTitle>Record Feedback</DialogTitle>
							</DialogHeader>
							<FeedbackForm
								onSubmit={(data) => submitMut.mutate(data)}
								isSubmitting={submitMut.isPending}
							/>
						</DialogContent>
					</Dialog>
					<Button
						variant="outline"
						size="sm"
						onClick={handleExport}
						disabled={rows.length === 0}
					>
						<Download className="mr-1 size-3.5" /> CSV
					</Button>
				</div>
			</div>

			{/* KPI Cards */}
			{isLoading ? (
				<div className="grid grid-cols-2 gap-4 md:grid-cols-5">
					{Array.from({ length: 5 }).map((_, i) => (
						<Skeleton key={i} className="h-24 rounded-lg" />
					))}
				</div>
			) : (
				<div className="grid grid-cols-2 gap-4 md:grid-cols-5">
					<Card>
						<CardHeader className="pb-1">
							<CardTitle className="font-normal text-muted-foreground text-xs">
								Total Reviews
							</CardTitle>
						</CardHeader>
						<CardContent>
							<p className="font-bold text-2xl">{stats?.total_reviews ?? 0}</p>
						</CardContent>
					</Card>
					<Card>
						<CardHeader className="pb-1">
							<CardTitle className="flex items-center gap-1 font-normal text-muted-foreground text-xs">
								<Star className="size-3 fill-yellow-400 text-yellow-400" /> Avg
								Rating
							</CardTitle>
						</CardHeader>
						<CardContent>
							<p className="font-bold text-2xl">
								{stats ? Number(stats.avg_rating).toFixed(1) : "–"}
							</p>
						</CardContent>
					</Card>
					<Card>
						<CardHeader className="pb-1">
							<CardTitle className="flex items-center gap-1 font-normal text-muted-foreground text-xs">
								<ThumbsUp className="size-3 text-green-500" /> Positive
							</CardTitle>
						</CardHeader>
						<CardContent>
							<p className="font-bold text-2xl text-green-600">
								{stats?.positive_count ?? 0}
							</p>
						</CardContent>
					</Card>
					<Card>
						<CardHeader className="pb-1">
							<CardTitle className="flex items-center gap-1 font-normal text-muted-foreground text-xs">
								<ThumbsDown className="size-3 text-red-500" /> Negative
							</CardTitle>
						</CardHeader>
						<CardContent>
							<p className="font-bold text-2xl text-red-600">
								{stats?.negative_count ?? 0}
							</p>
						</CardContent>
					</Card>
					<Card>
						<CardHeader className="pb-1">
							<CardTitle className="flex items-center gap-1 font-normal text-muted-foreground text-xs">
								<TrendingUp className="size-3" /> Satisfaction
							</CardTitle>
						</CardHeader>
						<CardContent>
							<p className="font-bold text-2xl">
								{stats && stats.total_reviews > 0
									? `${((stats.positive_count / stats.total_reviews) * 100).toFixed(0)}%`
									: "–"}
							</p>
						</CardContent>
					</Card>
				</div>
			)}

			{/* Rating Distribution */}
			{distribution.length > 0 && stats && stats.total_reviews > 0 && (
				<Card>
					<CardHeader>
						<CardTitle className="text-base">Rating Distribution</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="space-y-2">
							{distribution.map((d) => (
								<div key={d.label} className="flex items-center gap-3">
									<span className="w-6 text-right font-medium text-sm">
										{d.label}
									</span>
									<Star className="size-3.5 fill-yellow-400 text-yellow-400" />
									<div className="h-4 flex-1 overflow-hidden rounded-full bg-muted">
										<div
											className={`h-full rounded-full ${d.color}`}
											style={{
												width: `${(d.count / maxCount) * 100}%`,
												minWidth: d.count > 0 ? "8px" : "0",
											}}
										/>
									</div>
									<span className="w-8 text-right text-muted-foreground text-xs">
										{d.count}
									</span>
								</div>
							))}
						</div>
					</CardContent>
				</Card>
			)}

			{/* Category Averages */}
			{stats && stats.total_reviews > 0 && (
				<div className="grid grid-cols-3 gap-4">
					{[
						{ label: "Food", value: stats.avg_food },
						{ label: "Service", value: stats.avg_service },
						{ label: "Ambience", value: stats.avg_ambience },
					].map((cat) => (
						<Card key={cat.label}>
							<CardContent className="py-4 text-center">
								<p className="mb-1 text-muted-foreground text-xs">
									{cat.label}
								</p>
								<div className="flex items-center justify-center gap-1">
									{renderStars(Math.round(Number(cat.value)))}
								</div>
								<p className="mt-1 font-bold text-lg">
									{Number(cat.value).toFixed(1)}
								</p>
							</CardContent>
						</Card>
					))}
				</div>
			)}

			{/* Recent Feedback */}
			<Card>
				<CardHeader>
					<CardTitle className="text-base">Recent Feedback</CardTitle>
				</CardHeader>
				<CardContent className="p-0">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Date</TableHead>
								<TableHead>Rating</TableHead>
								<TableHead>Customer</TableHead>
								<TableHead>Comment</TableHead>
								<TableHead>Source</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{rows.length === 0 ? (
								<TableRow>
									<TableCell
										colSpan={5}
										className="py-12 text-center text-muted-foreground"
									>
										No feedback yet
									</TableCell>
								</TableRow>
							) : (
								rows.map((r) => (
									<TableRow key={r.id}>
										<TableCell className="text-muted-foreground text-xs">
											{new Date(r.createdAt).toLocaleDateString("en-GY", {
												month: "short",
												day: "numeric",
											})}
										</TableCell>
										<TableCell>
											<div className="flex">{renderStars(r.rating)}</div>
										</TableCell>
										<TableCell className="text-sm">
											{r.customerName || "Anonymous"}
										</TableCell>
										<TableCell className="max-w-[300px] truncate text-muted-foreground text-xs">
											{r.comment || "–"}
										</TableCell>
										<TableCell>
											<Badge variant="outline" className="text-xs">
												{r.source}
											</Badge>
										</TableCell>
									</TableRow>
								))
							)}
						</TableBody>
					</Table>
				</CardContent>
			</Card>
		</div>
	);
}

function FeedbackForm({
	onSubmit,
	isSubmitting,
}: {
	onSubmit: (data: {
		rating: number;
		foodRating?: number | null;
		serviceRating?: number | null;
		ambienceRating?: number | null;
		comment?: string | null;
		customerName?: string | null;
		customerEmail?: string | null;
		source?: "pos" | "online" | "qr";
	}) => void;
	isSubmitting: boolean;
}) {
	const [rating, setRating] = useState(5);
	const [food, setFood] = useState(0);
	const [service, setService] = useState(0);
	const [ambience, setAmbience] = useState(0);
	const [comment, setComment] = useState("");
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");

	function StarPicker({
		value,
		onChange,
	}: {
		value: number;
		onChange: (v: number) => void;
	}) {
		return (
			<div className="flex gap-1">
				{Array.from({ length: 5 }, (_, i) => (
					<button
						key={i}
						type="button"
						onClick={() => onChange(i + 1)}
						className="focus:outline-none"
					>
						<Star
							className={`size-5 cursor-pointer ${i < value ? "fill-yellow-400 text-yellow-400" : "text-gray-300 hover:text-yellow-200"}`}
						/>
					</button>
				))}
			</div>
		);
	}

	return (
		<>
			<div className="space-y-4 py-4">
				<div className="space-y-1.5">
					<Label>Overall Rating</Label>
					<StarPicker value={rating} onChange={setRating} />
				</div>
				<div className="grid grid-cols-3 gap-3">
					<div className="space-y-1.5">
						<Label className="text-xs">Food</Label>
						<StarPicker value={food} onChange={setFood} />
					</div>
					<div className="space-y-1.5">
						<Label className="text-xs">Service</Label>
						<StarPicker value={service} onChange={setService} />
					</div>
					<div className="space-y-1.5">
						<Label className="text-xs">Ambience</Label>
						<StarPicker value={ambience} onChange={setAmbience} />
					</div>
				</div>
				<div className="grid grid-cols-2 gap-3">
					<div className="space-y-1.5">
						<Label>Customer Name</Label>
						<Input
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="Optional"
						/>
					</div>
					<div className="space-y-1.5">
						<Label>Email</Label>
						<Input
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							placeholder="Optional"
						/>
					</div>
				</div>
				<div className="space-y-1.5">
					<Label>Comment</Label>
					<Textarea
						value={comment}
						onChange={(e) => setComment(e.target.value)}
						placeholder="What did you think?"
						rows={3}
					/>
				</div>
			</div>
			<DialogFooter>
				<Button
					onClick={() =>
						onSubmit({
							rating,
							foodRating: food || null,
							serviceRating: service || null,
							ambienceRating: ambience || null,
							comment: comment || null,
							customerName: name || null,
							customerEmail: email || null,
							source: "pos",
						})
					}
					disabled={rating < 1 || isSubmitting}
				>
					Submit Feedback
				</Button>
			</DialogFooter>
		</>
	);
}
