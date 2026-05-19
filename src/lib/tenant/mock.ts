import { useSyncExternalStore } from "react";
import type { Organization, User } from "./types";

const ORGS: Organization[] = [
  { id: "org_1", name: "Acme Inc.", slug: "acme", plan: "growth", membersCount: 12 },
  { id: "org_2", name: "Northwind Labs", slug: "northwind", plan: "starter", membersCount: 4 },
  { id: "org_3", name: "Helix Studio", slug: "helix", plan: "scale", membersCount: 28 },
];

const USER: User = {
  id: "user_1",
  name: "Daniel Souza",
  email: "daniel@leaderei.com",
  isMaster: true,
};

let currentOrgId = ORGS[0].id;
const listeners = new Set<() => void>();
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};
const emit = () => listeners.forEach((l) => l());

export function setCurrentOrg(id: string) {
  currentOrgId = id;
  emit();
}

export function useOrganizations() {
  return ORGS;
}

export function useCurrentOrg() {
  const id = useSyncExternalStore(
    subscribe,
    () => currentOrgId,
    () => currentOrgId,
  );
  return ORGS.find((o) => o.id === id) ?? ORGS[0];
}

export function useCurrentUser() {
  return USER;
}
