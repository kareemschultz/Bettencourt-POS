import { useEffect, useMemo, useRef, useState } from "react";

type WebSocketStatus = "connecting" | "open" | "closed";

type UseWebSocketOptions = {
	channels: string[];
	enabled?: boolean;
	onMessage?: (event: MessageEvent) => void;
	maxBackoffMs?: number;
};

function getWsUrl(channels: string[]) {
	const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
	const url = new URL(`${protocol}//${window.location.host}/ws`);
	if (channels.length > 0) {
		url.searchParams.set("channels", channels.join(","));
	}
	return url.toString();
}

export function useWebSocket({
	channels,
	enabled = true,
	onMessage,
	maxBackoffMs = 15_000,
}: UseWebSocketOptions) {
	const [status, setStatus] = useState<WebSocketStatus>("closed");
	const [lastMessage, setLastMessage] = useState<MessageEvent | null>(null);
	const socketRef = useRef<WebSocket | null>(null);
	const reconnectRef = useRef<number | null>(null);
	const attemptsRef = useRef(0);
	const onMessageRef = useRef(onMessage);

	onMessageRef.current = onMessage;

	const channelKey = useMemo(
		() => channels.slice().sort().join(","),
		[channels],
	);
	const stableChannels = useMemo(
		() => (channelKey ? channelKey.split(",") : []),
		[channelKey],
	);

	useEffect(() => {
		if (!enabled) return;

		let cancelled = false;

		const clearReconnectTimer = () => {
			if (reconnectRef.current !== null) {
				window.clearTimeout(reconnectRef.current);
				reconnectRef.current = null;
			}
		};

		const connect = () => {
			setStatus("connecting");
			const ws = new WebSocket(getWsUrl(stableChannels));
			socketRef.current = ws;

			ws.onopen = () => {
				attemptsRef.current = 0;
				setStatus("open");
			};

			ws.onmessage = (event) => {
				setLastMessage(event);
				onMessageRef.current?.(event);
			};

			ws.onclose = () => {
				if (cancelled) return;
				setStatus("closed");
				const delay = Math.min(500 * 2 ** attemptsRef.current, maxBackoffMs);
				attemptsRef.current += 1;
				clearReconnectTimer();
				reconnectRef.current = window.setTimeout(connect, delay);
			};

			ws.onerror = () => {
				ws.close();
			};
		};

		connect();

		return () => {
			cancelled = true;
			clearReconnectTimer();
			if (socketRef.current) {
				socketRef.current.close();
				socketRef.current = null;
			}
		};
	}, [enabled, maxBackoffMs, stableChannels]);

	return {
		status,
		lastMessage,
		send: (data: string) => {
			if (socketRef.current?.readyState === WebSocket.OPEN) {
				socketRef.current.send(data);
			}
		},
	};
}
