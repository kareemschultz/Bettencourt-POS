// i18n packages (i18next, react-i18next) are not yet installed.
// This file exports only the language metadata used by the UI.
// Multi-language support is planned for a future release.

export const SUPPORTED_LANGUAGES = [
	{ code: "en", label: "English", flag: "🇺🇸" },
	{ code: "es", label: "Español", flag: "🇪🇸" },
	{ code: "fr", label: "Français", flag: "🇫🇷" },
	{ code: "ht", label: "Kreyòl Ayisyen", flag: "🇭🇹" },
] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]["code"];
