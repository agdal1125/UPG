let isUnlockFlowActive = false;

function getCurrentPath() {
  if (typeof window === 'undefined') {
    return '/';
  }

  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

export function getProtectedUnlockUrl(nextPath = getCurrentPath()) {
  return `/api/auth/verify?next=${encodeURIComponent(nextPath)}`;
}

export function requestProtectedActionAccess(message?: string) {
  if (typeof window === 'undefined') {
    return;
  }

  if (isUnlockFlowActive) {
    return;
  }

  const shouldContinue = window.confirm(
    message || 'This action requires authentication. Unlock protected actions now?'
  );

  if (!shouldContinue) {
    return;
  }

  isUnlockFlowActive = true;
  window.location.assign(getProtectedUnlockUrl());
}

export async function ensureAuthorizedResponse(
  response: Response,
  message?: string,
) {
  if (response.status !== 401) {
    return true;
  }

  requestProtectedActionAccess(message);
  return false;
}
