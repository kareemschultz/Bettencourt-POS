// Re-exported from context so the connection lives at the app root,
// not per receipt dialog — avoids repeated trust prompts in anonymous mode.
export type { QzStatus } from "@/contexts/qz-printer-context";
export { useQzPrinter } from "@/contexts/qz-printer-context";
