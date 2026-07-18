import profilesManifest from "../../config/e2e-staff-profiles.json";
import { normalizeEmail } from "./lib/staffAccess";

export interface E2eStaffProfileSeed {
  email: string;
  emailNormalized: string;
  key: string;
  name: string;
  roles: string[];
}

export function listE2eStaffProfileSeeds(): E2eStaffProfileSeed[] {
  return profilesManifest.profiles.map((profile) => {
    const email = `${profile.localPart}@${profilesManifest.emailDomain}`;
    return {
      email,
      emailNormalized: normalizeEmail(email),
      key: profile.key,
      name: profile.name,
      roles: profile.roles,
    };
  });
}
