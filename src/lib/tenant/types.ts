export type Role = "owner" | "admin" | "member" | "master";

export type Organization = {
  id: string;
  name: string;
  slug: string;
  plan: "free" | "starter" | "growth" | "scale";
  membersCount: number;
};

export type User = {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  isMaster?: boolean;
};

export type Membership = {
  orgId: string;
  userId: string;
  role: Role;
};
