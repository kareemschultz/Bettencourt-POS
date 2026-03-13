import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

import en from "./locales/en.json";
import es from "./locales/es.json";
import fr from "./locales/fr.json";
import ht from "./locales/ht.json";

export const SUPPORTED_LANGUAGES = [
	{ code: "en", label: "English", flag: "🇺🇸" },
	{ code: "es", label: "Español", flag: "🇪🇸" },
	{ code: "fr", label: "Français", flag: "🇫🇷" },
	{ code: "ht", label: "Kreyòl Ayisyen", flag: "🇭🇹" },
] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]["code"];

i18n
	.use(LanguageDetector)
	.use(initReactI18next)
	.init({
		resources: {
			en: { translation: en },
			es: { translation: es },
			fr: { translation: fr },
			ht: { translation: ht },
		},
		fallbackLng: "en",
		defaultNS: "translation",
		detection: {
			order: ["localStorage", "navigator"],
			caches: ["localStorage"],
			lookupLocalStorage: "i18n_language",
		},
		interpolation: {
			escapeValue: false,
		},
	});

export default i18n;
