import { index, type RouteConfig, route } from "@react-router/dev/routes";

export default [
	route("manual", "routes/docs.tsx"),
	route("manual/api/search", "routes/search.ts"),
	route("manual/*", "routes/docs.tsx"),

	// LLM integration (no /manual prefix — consumed by AI tools, not browsers):
	route("llms.txt", "llms/index.ts"),
	route("llms-full.txt", "llms/full.ts"),
	route("llms.mdx/docs/*", "llms/mdx.ts"),

	route("*", "routes/not-found.tsx"),
] satisfies RouteConfig;
