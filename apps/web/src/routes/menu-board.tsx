import { useQuery } from "@tanstack/react-query";
import { Maximize, Minimize } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatGYD } from "@/lib/types";
import { orpc } from "@/utils/orpc";

interface MenuProduct {
	id: string;
	name: string;
	price: number;
	imageUrl: string | null;
}

interface MenuDepartment {
	name: string;
	sortOrder: number;
	products: MenuProduct[];
}

// Department color palette for headers
const DEPT_COLORS = [
	"from-amber-700 to-amber-600",
	"from-emerald-700 to-emerald-600",
	"from-blue-700 to-blue-600",
	"from-purple-700 to-purple-600",
	"from-rose-700 to-rose-600",
	"from-cyan-700 to-cyan-600",
	"from-orange-700 to-orange-600",
	"from-indigo-700 to-indigo-600",
];

export default function MenuBoardPage() {
	const [isFullscreen, setIsFullscreen] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);
	const scrollRef = useRef<HTMLDivElement>(null);
	const [autoScroll, setAutoScroll] = useState(true);

	const { data: departments } = useQuery({
		...orpc.menuBoard.getMenuProducts.queryOptions({ input: undefined }),
		refetchInterval: 60_000, // Auto-refresh every 60 seconds
	});

	const menuDepts = (departments || []) as MenuDepartment[];

	// Auto-scroll logic
	useEffect(() => {
		if (!autoScroll || !scrollRef.current) return;
		const el = scrollRef.current;
		let animationId: number;
		const scrollSpeed = 0.5; // pixels per frame

		function step() {
			if (!el) return;
			el.scrollTop += scrollSpeed;
			// Reset to top when reaching bottom
			if (el.scrollTop + el.clientHeight >= el.scrollHeight - 2) {
				el.scrollTop = 0;
			}
			animationId = requestAnimationFrame(step);
		}

		// Start after 3 seconds
		const timeout = setTimeout(() => {
			animationId = requestAnimationFrame(step);
		}, 3000);

		return () => {
			clearTimeout(timeout);
			cancelAnimationFrame(animationId);
		};
	}, [autoScroll]);

	// Pause auto-scroll on hover/touch
	const handleInteractionStart = useCallback(() => setAutoScroll(false), []);
	const handleInteractionEnd = useCallback(() => {
		// Resume after 5 seconds of no interaction
		const timeout = setTimeout(() => setAutoScroll(true), 5000);
		return () => clearTimeout(timeout);
	}, []);

	// Fullscreen toggle
	const toggleFullscreen = useCallback(async () => {
		if (!document.fullscreenElement) {
			await containerRef.current?.requestFullscreen();
			setIsFullscreen(true);
		} else {
			await document.exitFullscreen();
			setIsFullscreen(false);
		}
	}, []);

	useEffect(() => {
		function onFsChange() {
			setIsFullscreen(!!document.fullscreenElement);
		}
		document.addEventListener("fullscreenchange", onFsChange);
		return () => document.removeEventListener("fullscreenchange", onFsChange);
	}, []);

	return (
		<div
			ref={containerRef}
			className="flex min-h-screen flex-col bg-gray-950 text-gray-50"
		>
			{/* Header */}
			<header className="flex items-center justify-between border-gray-800 border-b bg-gray-900 px-6 py-4">
				<div>
					<h1 className="font-bold text-3xl text-white tracking-tight">
						{"Bettencourt's Food Inc."}
					</h1>
					<p className="mt-0.5 text-gray-400 text-sm">Menu</p>
				</div>
				<button
					onClick={toggleFullscreen}
					className="rounded-lg bg-gray-800 p-2.5 text-gray-300 transition-colors hover:bg-gray-700 hover:text-white"
					aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
				>
					{isFullscreen ? (
						<Minimize className="size-6" />
					) : (
						<Maximize className="size-6" />
					)}
				</button>
			</header>

			{/* Menu Content */}
			<div
				ref={scrollRef}
				className="flex-1 overflow-y-auto p-6"
				onMouseEnter={handleInteractionStart}
				onMouseLeave={handleInteractionEnd}
				onTouchStart={handleInteractionStart}
				onTouchEnd={handleInteractionEnd}
			>
				{menuDepts.length === 0 ? (
					<div className="flex items-center justify-center py-20 text-gray-500 text-xl">
						Menu loading...
					</div>
				) : (
					<div className="mx-auto flex max-w-7xl flex-col gap-8">
						{menuDepts.map((dept, deptIdx) => (
							<section key={dept.name}>
								{/* Department Header */}
								<div
									className={`mb-4 rounded-lg bg-gradient-to-r ${DEPT_COLORS[deptIdx % DEPT_COLORS.length]} px-6 py-3`}
								>
									<h2 className="font-bold text-2xl text-white uppercase tracking-wide">
										{dept.name}
									</h2>
								</div>

								{/* Products Grid */}
								<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
									{dept.products.map((product) => (
										<div
											key={product.id}
											className="flex flex-col rounded-lg border border-gray-800 bg-gray-900 p-4 transition-colors hover:border-gray-700"
										>
											{product.imageUrl && (
												<div className="mb-3 aspect-square overflow-hidden rounded-md bg-gray-800">
													<img
														src={product.imageUrl}
														alt={product.name}
														className="size-full object-cover"
														loading="lazy"
													/>
												</div>
											)}
											<h3 className="font-semibold text-lg text-white leading-tight">
												{product.name}
											</h3>
											<p className="mt-auto pt-2 font-bold text-amber-400 text-xl">
												{formatGYD(product.price)}
											</p>
										</div>
									))}
								</div>
							</section>
						))}
					</div>
				)}
			</div>

			{/* Footer */}
			<footer className="border-gray-800 border-t bg-gray-900 px-6 py-3 text-center text-gray-500 text-sm">
				Prices subject to change. Tax not included.
			</footer>
		</div>
	);
}
