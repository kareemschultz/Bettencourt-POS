export function toCents(amount: number): number {
	return Math.round(amount * 100);
}

export function fromCents(cents: number): number {
	return cents / 100;
}

export function roundMoney(amount: number): number {
	return Math.round(amount * 100) / 100;
}
