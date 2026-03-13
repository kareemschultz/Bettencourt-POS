import { Globe } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SUPPORTED_LANGUAGES } from "@/i18n/index";

export function LanguageSwitcher() {
	const { i18n } = useTranslation();

	function changeLanguage(code: string) {
		i18n.changeLanguage(code);
	}

	const currentLang =
		SUPPORTED_LANGUAGES.find((l) => l.code === i18n.language) ??
		SUPPORTED_LANGUAGES[0];

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="ghost" size="sm" className="min-h-[44px] gap-2 px-3">
					<Globe className="h-4 w-4" />
					<span className="hidden sm:inline">{currentLang.flag}</span>
					<span className="hidden md:inline">{currentLang.label}</span>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="min-w-[160px]">
				{SUPPORTED_LANGUAGES.map((lang) => (
					<DropdownMenuItem
						key={lang.code}
						onClick={() => changeLanguage(lang.code)}
						className={`min-h-[44px] cursor-pointer gap-2 ${
							i18n.language === lang.code ? "font-semibold" : ""
						}`}
					>
						<span>{lang.flag}</span>
						<span>{lang.label}</span>
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
