export function getInboxIdFromEmail(email: string) {
  return email.split("@").at(0);
}

export function getInboxEmail(inboxId: string) {
  return `${inboxId}@inbox.tamias.xyz`;
}
