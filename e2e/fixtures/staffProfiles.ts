import manifest from "../../config/e2e-staff-profiles.json";

export interface E2eStaffProfile {
  email: string;
  key: string;
  localPart: string;
  name: string;
  roles: string[];
}

export interface E2eStaffManifest {
  emailDomain: string;
  profiles: Array<{
    key: string;
    localPart: string;
    name: string;
    roles: string[];
  }>;
}

export function loadE2eStaffProfiles(): E2eStaffProfile[] {
  const data = manifest as E2eStaffManifest;
  return data.profiles.map((profile) => ({
    ...profile,
    email: `${profile.localPart}@${data.emailDomain}`,
  }));
}

export function e2eStaffEmail(key: string) {
  const profile = loadE2eStaffProfiles().find((entry) => entry.key === key);
  if (!profile) {
    throw new Error(`Unknown E2E staff profile: ${key}`);
  }
  return profile.email;
}

export const E2E_ROLE_PROFILE_KEYS = [
  "admin",
  "sales",
  "contracting",
  "operations",
  "ticketing",
  "finance",
  "hr",
] as const;

export type E2eRoleProfileKey = (typeof E2E_ROLE_PROFILE_KEYS)[number];
