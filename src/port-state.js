export function mergePortState(desired = {}, runtime = {}) {
	return {
		...runtime, ...desired,
		link: { ...(desired.link ?? {}), ...(runtime.link ?? {}) },
		capabilities: { ...(desired.capabilities ?? {}), ...(runtime.capabilities ?? {}) },
		poe: { ...(runtime.poe ?? {}), ...(desired.poe ?? {}), power: runtime.poe?.power },
		vlan: { ...(runtime.vlan ?? {}), ...(desired.vlan ?? {}) },
		stp: { ...(runtime.stp ?? {}), ...(desired.stp ?? {}), state: runtime.stp?.state, role: runtime.stp?.role },
	};
}
