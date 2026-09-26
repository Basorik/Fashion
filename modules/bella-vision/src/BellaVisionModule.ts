import { NativeModule, requireOptionalNativeModule } from 'expo';

export type ImageLabel = { label: string; confidence: number };

declare class BellaVisionModule extends NativeModule {
  // False on iOS before 17, where Vision can't lift the subject out of a photo.
  readonly canRemoveBackground: boolean;
  // Resolves with the file URI of a transparent PNG cropped to the item.
  removeBackgroundAsync(uri: string): Promise<string>;
  // What's in the photo, most likely first.
  labelImageAsync(uri: string): Promise<ImageLabel[]>;
}

// Null where the native code isn't compiled in: Expo Go, and the web.
export default requireOptionalNativeModule<BellaVisionModule>('BellaVision');
