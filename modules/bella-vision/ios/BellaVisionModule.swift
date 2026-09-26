import CoreImage
import ExpoModulesCore
import Vision

// On-device background removal for Bella, built on Apple's Vision framework.
public class BellaVisionModule: Module {
  public func definition() -> ModuleDefinition {
    Name("BellaVision")

    // Lifting the subject out of a photo needs iOS 17.
    Constant("canRemoveBackground") { () -> Bool in
      if #available(iOS 17.0, *) {
        return true
      }
      return false
    }

    // Cuts the item out of the photo at `uri` and writes it, cropped to the
    // item, to a transparent PNG in the cache folder. Returns the PNG's file URI.
    AsyncFunction("removeBackgroundAsync") { (uri: URL) throws -> String in
      guard #available(iOS 17.0, *) else {
        throw BackgroundRemovalUnavailableException()
      }
      let image = try loadImage(uri)
      let handler = VNImageRequestHandler(ciImage: image)
      let request = VNGenerateForegroundInstanceMaskRequest()
      try handler.perform([request])
      guard let observation = request.results?.first, !observation.allInstances.isEmpty else {
        throw NoSubjectException()
      }
      let buffer = try observation.generateMaskedImage(
        ofInstances: observation.allInstances,
        from: handler,
        croppedToInstancesExtent: true
      )
      var cutout = CIImage(cvPixelBuffer: buffer)
      let scale = min(1, maxOutputSide / max(cutout.extent.width, cutout.extent.height))
      if scale < 1 {
        cutout = cutout.transformed(by: CGAffineTransform(scaleX: scale, y: scale))
      }
      guard
        let colorSpace = CGColorSpace(name: CGColorSpace.sRGB),
        let png = CIContext().pngRepresentation(of: cutout, format: .RGBA8, colorSpace: colorSpace)
      else {
        throw ImageWriteException()
      }
      let output = FileManager.default.temporaryDirectory
        .appendingPathComponent("bella-cutout-\(UUID().uuidString).png")
      try png.write(to: output)
      return output.absoluteString
    }
  }
}

private let maxOutputSide: CGFloat = 1600

// Loads the photo upright, following its EXIF orientation.
private func loadImage(_ uri: URL) throws -> CIImage {
  guard let image = CIImage(contentsOf: uri, options: [.applyOrientationProperty: true]) else {
    throw ImageLoadException()
  }
  return image
}

internal final class BackgroundRemovalUnavailableException: Exception {
  override var reason: String {
    "Background removal needs iOS 17 or later"
  }
}

internal final class NoSubjectException: Exception {
  override var reason: String {
    "No item found in the photo"
  }
}

internal final class ImageLoadException: Exception {
  override var reason: String {
    "Couldn't open the photo"
  }
}

internal final class ImageWriteException: Exception {
  override var reason: String {
    "Couldn't save the cut-out photo"
  }
}
