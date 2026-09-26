import { NativeModule, requireOptionalNativeModule } from 'expo';

type BellaShareEvents = {
  // Text shared to Bella while it's already running.
  onShare: (event: { text: string }) => void;
};

declare class BellaShareModule extends NativeModule<BellaShareEvents> {
  // The text Bella was opened with from another app's share menu, once; null
  // after it has been read or when Bella wasn't opened that way.
  takeSharedText(): string | null;
}

// Null where the native code isn't compiled in: Expo Go, iOS (not built yet) and the web.
export default requireOptionalNativeModule<BellaShareModule>('BellaShare');
