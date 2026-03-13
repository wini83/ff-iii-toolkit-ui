export type InviteResult = {
  username?: string;
  userId?: string;
  inviteUrl: string | null;
  token: string;
  expiresAt: string;
};
