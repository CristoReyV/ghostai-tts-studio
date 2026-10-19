import type { AdminMember, MemberOperationalState } from "./adminService";

// The Gateway computes the canonical operational state. Components consume one contract.
export function getMemberOperationalState(member: AdminMember): MemberOperationalState {
  return member.operational || { status: "NEEDS_REVIEW", label: "REVISAR", recommendedAction: "Actualiza el panel para consultar la operación", severity: "info", needsAction: true, emailType: "NEW_ACCESS" };
}

export function matchesMemberFilters(member: AdminMember, filters: { search: string; plan: string; status: string; needsAction: boolean }): boolean {
  const search = filters.search.trim().toLocaleLowerCase();
  return (!search || member.name.toLocaleLowerCase().includes(search) || member.email.toLocaleLowerCase().includes(search))
    && (filters.plan === "all" || member.access_plan === filters.plan)
    && (filters.status === "all" || member.status === filters.status)
    && (!filters.needsAction || getMemberOperationalState(member).needsAction);
}

export const EMAIL_TYPE_LABELS = { NEW_ACCESS: "Acceso nuevo", ACCESS_REPLACEMENT: "Reemplazo de acceso", RESEND: "Reenvío", RENEWAL: "Renovación" };
