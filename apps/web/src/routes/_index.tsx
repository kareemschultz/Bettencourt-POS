import { Navigate } from "react-router";

import type { Route } from "./+types/_index";

export function meta({}: Route.MetaArgs) {
	return [
		{ title: "Bettencourt POS" },
		{ name: "description", content: "Bettencourt's Food Inc. Point of Sale" },
	];
}

export default function Home() {
	return <Navigate to="/login" replace />;
}
