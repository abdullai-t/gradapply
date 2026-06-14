/** Shared Firebase service account parsing (Node + Workers-safe consumers). */
export type FirebaseServiceAccount = {
  project_id: string;
  client_email: string;
  private_key: string;
};

export function getFirebaseServiceAccount(): FirebaseServiceAccount | null {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (json) {
    try {
      const parsed = JSON.parse(json) as FirebaseServiceAccount;
      if (
        parsed.project_id?.trim() &&
        parsed.client_email?.trim() &&
        parsed.private_key?.trim()
      ) {
        return {
          project_id: parsed.project_id.trim(),
          client_email: parsed.client_email.trim(),
          private_key: parsed.private_key,
        };
      }
    } catch {
      return null;
    }
  }

  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n").trim();

  if (!projectId || !clientEmail || !privateKey) return null;

  return {
    project_id: projectId,
    client_email: clientEmail,
    private_key: privateKey,
  };
}

export function firebaseMessagingProjectId(): string | null {
  return (
    getFirebaseServiceAccount()?.project_id ??
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim() ??
    null
  );
}
