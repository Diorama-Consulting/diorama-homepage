// src/lib/sheets.ts
//
// Appends contact form submissions to a Google Sheet, using a service
// account (no OAuth popup, no end-user Google login — this authenticates
// as the service account itself, same category of auth as the GitHub App
// used for Keystatic).
//
// Credential storage: the downloaded service-account JSON key contains a
// multi-line RSA private key. Storing that directly as a .env value is
// exactly the kind of thing that already corrupted the deploy SSH key
// earlier in this project (a missing trailing newline or altered line
// endings from copy-pasting a multi-line secret — see the "error in
// libcrypto" incident). To avoid a repeat: base64-encode the ENTIRE
// downloaded JSON file into one single-line env var. A base64 blob has no
// internal structure to break — no newlines, no quotes — so it survives
// copy-paste into .env, GitHub secrets, anywhere, byte-for-byte.
//
//   base64 -i service-account-key.json | pbcopy   # macOS — copies the encoded blob directly
//
// then paste that as GOOGLE_SERVICE_ACCOUNT_KEY_BASE64 in .env.
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

// Change this if your sheet's tab isn't named exactly this.
const SHEET_TAB_NAME = 'Contact Submissions';

type ServiceAccountKey = { client_email: string; private_key: string };

function loadServiceAccountKey(): ServiceAccountKey {
  const base64 = import.meta.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64;
  if (!base64) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY_BASE64 is not set');
  }
  const json = Buffer.from(base64, 'base64').toString('utf-8');
  const parsed = JSON.parse(json);
  if (!parsed.client_email || !parsed.private_key) {
    throw new Error('Decoded service account key is missing client_email or private_key');
  }
  return parsed;
}

// Cached across requests — this process is a long-running Node server (PM2),
// not a serverless cold-start each time, so there's no reason to re-authenticate
// and re-fetch sheet metadata on every single form submission.
let cachedSheet: Awaited<ReturnType<typeof loadSheet>> | null = null;

async function loadSheet() {
  const { client_email, private_key } = loadServiceAccountKey();
  const auth = new JWT({
    email: client_email,
    key: private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheetId = import.meta.env.GOOGLE_SHEET_ID;
  if (!sheetId) {
    throw new Error('GOOGLE_SHEET_ID is not set');
  }

  const doc = new GoogleSpreadsheet(sheetId, auth);
  await doc.loadInfo();

  const sheet = doc.sheetsByTitle[SHEET_TAB_NAME];
  if (!sheet) {
    throw new Error(
      `No tab named "${SHEET_TAB_NAME}" found in the sheet. Rename a tab to match, or change SHEET_TAB_NAME in src/lib/sheets.ts.`,
    );
  }
  return sheet;
}

export async function appendContactSubmission(row: {
  submissionId: number;
  submittedAt: string;
  name: string;
  email: string;
  message: string;
}) {
  if (!cachedSheet) {
    cachedSheet = await loadSheet();
  }
  // google-spreadsheet maps object keys to column headers — the sheet's
  // first row must already contain these exact header names (see setup
  // instructions). Any header not in this object is just left blank.
  await cachedSheet.addRow({
    'Submission ID': row.submissionId,
    'Submitted At': row.submittedAt,
    Name: row.name,
    Email: row.email,
    Message: row.message,
  });
}