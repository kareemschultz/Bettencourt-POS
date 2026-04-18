import { Badge } from "@/components/ui/badge";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

export function KdsHeader({
	station,
	onStationChange,
	counts,
}: {
	station: string;
	onStationChange: (station: string) => void;
	counts: { pending: number; preparing: number; ready: number };
}) {
	return (
		<div className="flex flex-wrap items-center justify-between gap-3 border-b bg-background/95 px-4 py-3">
			<div>
				<h1 className="font-bold text-lg">Kitchen Display</h1>
			</div>
			<div className="flex items-center gap-2">
				<Select value={station} onValueChange={onStationChange}>
					<SelectTrigger className="h-8 w-36">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All stations</SelectItem>
						<SelectItem value="kitchen">Kitchen</SelectItem>
						<SelectItem value="bar">Bar</SelectItem>
					</SelectContent>
				</Select>
				<Badge variant="outline">Pending {counts.pending}</Badge>
				<Badge variant="outline">Preparing {counts.preparing}</Badge>
				<Badge variant="outline">Ready {counts.ready}</Badge>
			</div>
		</div>
	);
}
