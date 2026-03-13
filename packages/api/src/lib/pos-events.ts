type PosEvent =
	| {
			type: "product:86";
			productId: string;
			locationId: string;
			isAvailable: boolean;
			productName: string;
	  }
	| {
			type: "order:created";
			orderId: string;
			orderNumber: string;
	  }
	| {
			type: "table:status_changed";
			tableId: string;
			status: string;
	  };

type Listener = (event: PosEvent) => void;

const listeners = new Set<Listener>();

export function onPosEvent(listener: Listener): () => void {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

export function emitPosEvent(event: PosEvent): void {
	for (const listener of listeners) {
		try {
			listener(event);
		} catch {
			// Ignore listener errors
		}
	}
}

export type { PosEvent };
