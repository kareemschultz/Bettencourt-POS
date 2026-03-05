import { HomeLayout } from "fumadocs-ui/layouts/home";
import { Link } from "react-router";

import { baseOptions } from "@/lib/layout.shared";

import type { Route } from "./+types/not-found";

export function meta({}: Route.MetaArgs) {
	return [{ title: "Not Found" }];
}

export default function NotFound() {
	return (
		<HomeLayout {...baseOptions()}>
			<div className="flex flex-1 flex-col items-center justify-center p-4 text-center">
				<h1 className="mb-2 font-bold text-xl">Not Found</h1>
				<p className="mb-4 text-fd-muted-foreground">
					This page could not be found.
				</p>
				<Link
					className="rounded-full bg-fd-primary px-4 py-2.5 font-medium text-fd-primary-foreground text-sm"
					to="/docs"
				>
					Back to Docs
				</Link>
			</div>
		</HomeLayout>
	);
}
