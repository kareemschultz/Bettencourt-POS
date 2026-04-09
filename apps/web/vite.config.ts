import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
	build: {
		rollupOptions: {
			output: {
				// Merge chunks smaller than 4 KB into their importers.
				// Prevents 50+ tiny icon files (~0.5 KB each) from becoming
				// separate HTTP requests. Reduces request count by ~30-40.
				experimentalMinChunkSize: 4096,
			},
		},
	},
	server: {
		proxy: {
			"/api": {
				target: "http://localhost:3000",
				changeOrigin: true,
			},
			"/rpc": {
				target: "http://localhost:3000",
				changeOrigin: true,
			},
		},
	},
	plugins: [
		tailwindcss(),
		reactRouter(),
		tsconfigPaths(),
		VitePWA({
			registerType: "autoUpdate",
			includeAssets: [
				"favicon.ico",
				"images/bettencourts-logo.png",
				"logo.png",
			],
			manifest: {
				name: "Bettencourt's POS",
				short_name: "Bettencourt's",
				description:
					"Enterprise Point of Sale for Bettencourt's Food Inc. — manage registers, inventory, kitchen operations, and reporting.",
				theme_color: "#0c0c0c",
				background_color: "#0c0c0c",
				display: "standalone",
				orientation: "any",
				start_url: "/dashboard",
				scope: "/",
				categories: ["business", "food"],
				icons: [
					{
						src: "pwa-64x64.png",
						sizes: "64x64",
						type: "image/png",
						purpose: "any",
					},
					{
						src: "pwa-192x192.png",
						sizes: "192x192",
						type: "image/png",
						purpose: "any",
					},
					{
						src: "pwa-512x512.png",
						sizes: "512x512",
						type: "image/png",
						purpose: "any",
					},
					{
						src: "maskable-icon-512x512.png",
						sizes: "512x512",
						type: "image/png",
						purpose: "maskable",
					},
				],
			},
			pwaAssets: { disabled: false, config: true },
			workbox: {
				// Cache app shell (JS, CSS, HTML)
				globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
				// SPA fallback: serve index.html for any navigation request that
				// isn't a precached file (e.g. /dashboard, /dashboard/pos offline).
				navigateFallback: "index.html",
				navigateFallbackDenylist: [/^\/api\//, /^\/rpc\//],
				// Runtime caching strategies for API calls
				runtimeCaching: [
					{
						// Session check — stale-while-revalidate so the user stays
						// logged in during a shift even if connectivity drops.
						// Cache expires after 8 hours (one full shift window).
						urlPattern: /\/api\/auth\/get-session/,
						handler: "StaleWhileRevalidate",
						options: {
							cacheName: "auth-session",
							expiration: { maxEntries: 5, maxAgeSeconds: 60 * 60 * 8 },
						},
					},
					{
						// All other auth endpoints (login, logout, etc.) — network only
						urlPattern: /\/api\/auth\//,
						handler: "NetworkOnly",
					},
					{
						// Product catalog — stale while revalidate
						urlPattern: /\/rpc\/pos\.getProducts/,
						handler: "StaleWhileRevalidate",
						options: {
							cacheName: "pos-products",
							expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 },
						},
					},
					{
						// Menu board data — cache-first for public display
						urlPattern: /\/rpc\/menuBoard\./,
						handler: "StaleWhileRevalidate",
						options: {
							cacheName: "menu-board",
							expiration: { maxEntries: 10, maxAgeSeconds: 60 * 30 },
						},
					},
					{
						// Dashboard summary — network first, fall back to cache
						urlPattern: /\/rpc\/dashboard\./,
						handler: "NetworkFirst",
						options: {
							cacheName: "dashboard-data",
							expiration: { maxEntries: 20, maxAgeSeconds: 60 * 5 },
							networkTimeoutSeconds: 5,
						},
					},
					{
						// All other RPC calls — network first with 3s timeout
						urlPattern: /\/rpc\//,
						handler: "NetworkFirst",
						options: {
							cacheName: "api-general",
							expiration: { maxEntries: 100, maxAgeSeconds: 60 * 10 },
							networkTimeoutSeconds: 3,
						},
					},
				],
			},
			devOptions: { enabled: true },
		}),
	],
});
