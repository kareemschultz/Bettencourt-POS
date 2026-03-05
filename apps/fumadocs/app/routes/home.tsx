import { HomeLayout } from "fumadocs-ui/layouts/home";
import { Link } from "react-router";

import { baseOptions } from "@/lib/layout.shared";

import type { Route } from "./+types/home";

export function meta({}: Route.MetaArgs) {
	return [
		{ title: "New React Router App" },
		{ name: "description", content: "Welcome to React Router!" },
	];
}

export default function Home() {
	return (
		<HomeLayout {...baseOptions()}>
			<div className="flex flex-1 flex-col items-center justify-center p-4 text-center">
				<h1 className="mb-2 font-bold text-xl">Fumadocs on React Router.</h1>
				<p className="mb-4 text-fd-muted-foreground">
					The truly flexible docs framework on React.js.
				</p>
				<Link
					className="rounded-full bg-fd-primary px-4 py-2.5 font-medium text-fd-primary-foreground text-sm"
					to="/docs"
				>
					Open Docs
				</Link>
			</div>
		</HomeLayout>
	);
}
