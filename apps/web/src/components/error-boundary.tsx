import { AlertCircle } from "lucide-react";
import { isRouteErrorResponse, Link, useRouteError } from "react-router";
import { Button } from "@/components/ui/button";

export function ErrorBoundary() {
	const error = useRouteError();

	let title = "Something went wrong";
	let message = "An unexpected error occurred.";

	if (isRouteErrorResponse(error)) {
		title = `${error.status} ${error.statusText}`;
		message =
			error.data?.message || "The page you requested could not be found.";
	} else if (error instanceof Error) {
		message = error.message;
	}

	return (
		<div className="flex min-h-screen items-center justify-center p-4">
			<div className="flex max-w-md flex-col items-center gap-4 text-center">
				<AlertCircle className="h-12 w-12 text-destructive" />
				<h1 className="font-bold text-2xl">{title}</h1>
				<p className="text-muted-foreground">{message}</p>
				<div className="flex gap-2">
					<Button onClick={() => window.location.reload()}>Reload Page</Button>
					<Button variant="outline" asChild>
						<Link to="/dashboard">Go to Dashboard</Link>
					</Button>
				</div>
			</div>
		</div>
	);
}
