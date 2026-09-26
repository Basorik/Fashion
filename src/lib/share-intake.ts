import { router, useRootNavigationState } from 'expo-router';
import { useEffect } from 'react';

import BellaShare from '../../modules/bella-share';
import { extractLink } from '@/lib/link-import';

// Text shared to Bella from another app's share menu. A product link opens
// Add item and imports it; anything else, like a selected order email, opens
// the order email import with the text already read.

let pending: string | null = null;
const listeners = new Set<() => void>();

// The shared email waiting for the import screen, once.
export function takeSharedEmail() {
  const text = pending;
  pending = null;
  return text;
}

// Calls `listener` when an email is shared while the import screen is open.
export function onSharedEmail(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// A short share that is mostly a link, like "Look at this! https://shop.com/item".
function isProductLink(text: string) {
  return extractLink(text) !== null && text.trim().length < 400 && text.split('\n').length <= 3;
}

function open(text: string) {
  if (isProductLink(text)) {
    router.navigate({ pathname: '/add-item', params: { url: text.trim() } });
    return;
  }
  pending = text;
  router.navigate('/import-order');
  for (const listener of listeners) listener();
}

// Used once, in the root layout. Waits for navigation to be ready so a share
// that opened the app can move to its screen.
export function useShareIntake() {
  const ready = useRootNavigationState()?.key !== undefined;
  useEffect(() => {
    if (!ready || !BellaShare) return;
    const initial = BellaShare.takeSharedText();
    if (initial) open(initial);
    const subscription = BellaShare.addListener('onShare', ({ text }) => open(text));
    return () => subscription.remove();
  }, [ready]);
}
