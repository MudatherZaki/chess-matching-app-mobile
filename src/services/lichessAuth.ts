import { AppState, Linking } from 'react-native';
import { LinkedAccount } from '@/types';
import { apiClient } from './api';

// Must match Lichess:RedirectUri on the backend and the AndroidManifest intent-filter
export const LICHESS_REDIRECT_URI = 'com.chessmatchingapp://oauth/lichess';

// How long to wait after the app comes back to the foreground for the
// deep link to arrive before treating the sign-in as abandoned
const RETURN_GRACE_MS = 2000;

// The user denied access on Lichess, or a newer attempt replaced this one
export class LichessAuthCancelled extends Error {}

let abandonPending: (() => void) | null = null;

/**
 * Links the signed-in user's Lichess account:
 * backend creates the PKCE challenge -> Lichess login in the browser ->
 * deep link back with ?code&state -> backend exchanges the code and stores the account.
 */
export async function connectLichess(): Promise<LinkedAccount> {
  const { authorizeUrl, state } = await apiClient.startLichessAuth();
  const params = parseQuery(await openAndWaitForRedirect(authorizeUrl));

  if (params.error) {
    throw new LichessAuthCancelled(params.error_description || params.error);
  }
  if (!params.code || params.state !== state) {
    throw new Error('Lichess sign-in failed. Please try again.');
  }
  return apiClient.completeLichessAuth(params.code, state);
}

function openAndWaitForRedirect(authorizeUrl: string): Promise<string> {
  abandonPending?.();

  return new Promise((resolve, reject) => {
    let leftApp = false;
    let graceTimer: ReturnType<typeof setTimeout> | undefined;

    const urlSub = Linking.addEventListener('url', ({ url }) => {
      if (url.startsWith(LICHESS_REDIRECT_URI)) finish(() => resolve(url));
    });

    // The user can close the browser without finishing; there is no redirect then
    const appStateSub = AppState.addEventListener('change', status => {
      if (status !== 'active') {
        leftApp = true;
      } else if (leftApp) {
        clearTimeout(graceTimer);
        // Either the browser was closed early, or Lichess redirected but the
        // deep link didn't reach the app (intent-filter missing from the build)
        graceTimer = setTimeout(
          () =>
            finish(() =>
              reject(new Error("Lichess sign-in didn't finish. Please try connecting again.")),
            ),
          RETURN_GRACE_MS,
        );
      }
    });

    function finish(settle: () => void) {
      clearTimeout(graceTimer);
      urlSub.remove();
      appStateSub.remove();
      abandonPending = null;
      settle();
    }

    abandonPending = () => finish(() => reject(new LichessAuthCancelled('Superseded')));
    Linking.openURL(authorizeUrl).catch(error => finish(() => reject(error)));
  });
}

function parseQuery(url: string): Record<string, string> {
  const query = url.split('?')[1]?.split('#')[0] ?? '';
  const params: Record<string, string> = {};
  for (const pair of query.split('&')) {
    if (!pair) continue;
    const [key, value = ''] = pair.split('=');
    params[decodeURIComponent(key)] = decodeURIComponent(value.replace(/\+/g, ' '));
  }
  return params;
}
