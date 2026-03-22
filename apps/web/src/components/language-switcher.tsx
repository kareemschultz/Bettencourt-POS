import { Globe } from "lucide-react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SUPPORTED_LANGUAGES } from "@/i18n/index";

// Multi-language support is planned. Currently English only.
export function LanguageSwitcher() {
	const currentLang = SUPPORTED_LANGUAGES[0]; // English

	return (
		<DropdownMenu>
			<DropdownMenuTrigger className="inline-flex min-h-[44px] items-center gap-2 rounded-md px-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground focus-visible:outline-none">
				<Globe className="h-4 w-4" />
				<span className="hidden sm:inline">{currentLang.flag}</span>
				<span className="hidden md:inline">{currentLang.label}</span>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="min-w-[160px]">
				{SUPPORTED_LANGUAGES.map((lang) => (
					<DropdownMenuItem
						key={lang.code}
						disabled={lang.code !== "en"}
						className={`min-h-[44px] gap-2 ${lang.code === "en" ? "font-semibold" : "opacity-50"}`}
					>
						<span>{lang.flag}</span>
						<span>{lang.label}</span>
						{lang.code !== "en" && (
							<span className="ml-auto text-xs text-muted-foreground">Soon</span>
						)}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
