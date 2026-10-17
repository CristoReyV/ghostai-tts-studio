import { activateMember, type ActivationResponse } from "./adminService";
import { setGatewayAuthToken } from "./gateway";

const inFlight = new Map<string, Promise<ActivationResponse>>();
// React StrictMode can mount the activation effect twice; both callers share one consume.
export function activateOnce(token: string): Promise<ActivationResponse> {
  const existing = inFlight.get(token);
  if (existing) return existing;
  const pending = activateMember(token).finally(() => inFlight.delete(token));
  inFlight.set(token, pending);
  return pending;
}

export function persistActivationCredential(result: ActivationResponse): boolean {
  if (!result.ok || !result.accessKey) throw new Error("No se recibió la key de acceso. Contacta al soporte de GhostAI.");
  return setGatewayAuthToken(result.accessKey);
}
