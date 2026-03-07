import { HomeLayout } from "fumadocs-ui/layouts/home";
import { Link } from "react-router";

import { baseOptions } from "@/lib/layout.shared";

import type { Route } from "./+types/home";

export function meta({}: Route.MetaArgs) {
	return [
		{ title: "Bettencourt's POS — User Manual" },
		{
			name: "description",
			content:
				"Complete user manual and staff guide for Bettencourt's Food Inc. POS system.",
		},
	];
}

export default function Home() {
	return (
		<HomeLayout {...baseOptions()}>
			<div className="flex flex-1 flex-col items-center justify-center p-4 text-center">
				<h1 className="mb-2 font-bold text-2xl">
					{"Bettencourt's POS — User Manual"}
				</h1>
				<p className="mb-1 text-fd-muted-foreground">
					Complete guide for staff at Bettencourt's Food Inc.
				</p>
				<p className="mb-6 text-fd-muted-foreground text-sm">
					System live at{" "}
					<a
						href="https://pos.karetechsolutions.com"
						className="underline"
						target="_blank"
						rel="noreferrer"
					>
						pos.karetechsolutions.com
					</a>
				</p>
				<Link
					className="rounded-full bg-fd-primary px-4 py-2.5 font-medium text-fd-primary-foreground text-sm"
					to="/docs"
				>
					Open Manual
				</Link>
			</div>
		</HomeLayout>
	);
}
