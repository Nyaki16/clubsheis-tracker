// Who client emails come from. Sent through the Tracker's Gmail account, with
// Gizelle's name on it and her address for replies.
export const CLIENT_SENDER = {
  name: "Gizelle | ClubSheIs",
  replyTo: "gizelle@clubsheis.com",
  /** Copied on every proposal that goes out. */
  proposalCc: "gizelle@clubsheis.com",
  signOff: "Warm regards,\nGizelle\nClient Success Manager · ClubSheIs",
} as const;
