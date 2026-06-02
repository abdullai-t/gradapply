import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";

let adminApp: App | undefined;

function getServiceAccount() {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (json) {
    try {
      return JSON.parse(json) as {
        project_id: string;
        client_email: string;
        private_key: string;
      };
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

export function getFirebaseAdminApp(): App | null {
  if (adminApp) return adminApp;
  if (getApps().length > 0) {
    adminApp = getApps()[0]!;
    return adminApp;
  }

  const serviceAccount = getServiceAccount();
  const projectId =
    serviceAccount?.project_id ??
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim();

  if (!serviceAccount && !projectId) return null;

  try {
    adminApp = initializeApp(
      serviceAccount
        ? {
            credential: cert({
              projectId: serviceAccount.project_id,
              clientEmail: serviceAccount.client_email,
              privateKey: serviceAccount.private_key,
            }),
          }
        : { projectId },
    );
    return adminApp;
  } catch {
    return null;
  }
}

export function getFirebaseAdminAuth(): Auth | null {
  const app = getFirebaseAdminApp();
  if (!app) return null;
  return getAuth(app);
}
