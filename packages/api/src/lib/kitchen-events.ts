type KitchenEvent =
	| { type: "ticket:created"; ticketId: string; orderId: string }
	| {
			type: "ticket:printed";
			ticketId: string;
			orderId: string;
			targets: string[];
	  }
	| {
			type: "ticket:updated";
			ticketId: string;
			status: string;
	  }
	| {
			type: "item:updated";
			ticketId: string;
			itemId: string;
			status: string;
	  };

type Listener = (event: KitchenEvent) => void;

const listeners = new Set<Listener>();

export function onKitchenEvent(listener: Listener): () => void {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

export function emitKitchenEvent(event: KitchenEvent): void {
	for (const listener of listeners) {
		try {
			listener(event);
		} catch {
			// Ignore listener errors
		}
	}
}

export type { KitchenEvent };
