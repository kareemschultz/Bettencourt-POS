import { createElement, useRef, useState } from "react";
import { SupervisorOverrideDialog } from "@/components/pos/supervisor-override-dialog";

interface SupervisorInfo {
	supervisorId: string;
	supervisorName: string;
}

/**
 * Hook that provides an imperative API for requesting supervisor authorization.
 *
 * Usage:
 * ```tsx
 * const { requestOverride, SupervisorDialog } = useSupervisorOverride()
 *
 * // In JSX:
 * <>{SupervisorDialog}</>
 *
 * // In event handler:
 * try {
 *   const supervisor = await requestOverride("discounts.apply", "Apply Discount")
 *   // proceed with authorized action
 * } catch {
 *   // user cancelled
 * }
 * ```
 */
function selfHasPermission(
	perms: Record<string, string[]>,
	required: string,
): boolean {
	const [resource, action] = required.split(".");
	if (!resource || !action) return false;
	return perms[resource]?.includes(action) ?? false;
}

export function useSupervisorOverride(
	userPermissions?: Record<string, string[]>,
) {
	const [isOpen, setIsOpen] = useState(false);
	const [permission, setPermission] = useState("");
	const [permissionLabel, setPermissionLabel] = useState<string | undefined>();
	const resolveRef = useRef<((info: SupervisorInfo) => void) | null>(null);
	const rejectRef = useRef<(() => void) | null>(null);

	function requestOverride(
		requiredPermission: string,
		label?: string,
	): Promise<SupervisorInfo> {
		if (
			userPermissions &&
			selfHasPermission(userPermissions, requiredPermission)
		) {
			return Promise.resolve({ supervisorId: "self", supervisorName: "self" });
		}
		setPermission(requiredPermission);
		setPermissionLabel(label);
		setIsOpen(true);
		return new Promise<SupervisorInfo>((resolve, reject) => {
			resolveRef.current = resolve;
			rejectRef.current = reject;
		});
	}

	function handleAuthorized(supervisorId: string, supervisorName: string) {
		setIsOpen(false);
		resolveRef.current?.({ supervisorId, supervisorName });
		resolveRef.current = null;
		rejectRef.current = null;
	}

	function handleCancel() {
		setIsOpen(false);
		rejectRef.current?.();
		resolveRef.current = null;
		rejectRef.current = null;
	}

	const SupervisorDialog = createElement(SupervisorOverrideDialog, {
		open: isOpen,
		requiredPermission: permission,
		permissionLabel,
		onAuthorized: handleAuthorized,
		onCancel: handleCancel,
	});

	return { requestOverride, isOpen, SupervisorDialog };
}
