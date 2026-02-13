export const QUERY_KEYS = {
  groups: ['groups'] as const,
  storedGroups: ['storedGroups'] as const,
  messages: (groupId: string) => ['messages', groupId] as const,
  profile: (pubkey: string) => ['profile', pubkey] as const,
  readState: ['readState'] as const,
  groupMembers: (groupId: string) => ['groupMembers', groupId] as const,
  keyPackages: ['keyPackages'] as const,
  pendingInvites: ['pendingInvites'] as const,
  contacts: (pubkey: string) => ['contacts', pubkey] as const,
};
