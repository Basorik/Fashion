package expo.modules.bellavision

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.media.ExifInterface
import android.net.Uri
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.label.ImageLabeling
import com.google.mlkit.vision.label.defaults.ImageLabelerOptions
import com.google.mlkit.vision.segmentation.subject.SubjectSegmentation
import com.google.mlkit.vision.segmentation.subject.SubjectSegmenterOptions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileOutputStream
import java.util.UUID

private const val MAX_SIDE = 1600
private const val MIN_LABEL_CONFIDENCE = 0.4f
private const val MAX_LABELS = 20

// On-device photo tools for Bella, built on Google ML Kit.
class BellaVisionModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private val segmenter by lazy {
    SubjectSegmentation.getClient(
      SubjectSegmenterOptions.Builder().enableForegroundBitmap().build()
    )
  }

  private val labeler by lazy {
    ImageLabeling.getClient(
      ImageLabelerOptions.Builder().setConfidenceThreshold(MIN_LABEL_CONFIDENCE).build()
    )
  }

  override fun definition() = ModuleDefinition {
    Name("BellaVision")

    // ML Kit's subject segmentation runs through Google Play services on Android 7+.
    Constant("canRemoveBackground") { true }

    // Cuts the item out of the photo at `uri` and writes it, cropped to the
    // item, to a transparent PNG in the cache folder. Resolves with the PNG's file URI.
    AsyncFunction("removeBackgroundAsync") { uri: String, promise: Promise ->
      val bitmap = loadBitmap(uri)
      segmenter.process(InputImage.fromBitmap(bitmap, 0))
        .addOnSuccessListener { result ->
          try {
            val foreground = result.foregroundBitmap ?: throw NoSubjectException()
            val cutout = cropToVisible(foreground) ?: throw NoSubjectException()
            val output = File(appContext.cacheDirectory, "bella-cutout-${UUID.randomUUID()}.png")
            FileOutputStream(output).use { cutout.compress(Bitmap.CompressFormat.PNG, 100, it) }
            promise.resolve(Uri.fromFile(output).toString())
          } catch (e: CodedException) {
            promise.reject(e)
          } catch (e: Exception) {
            promise.reject(ImageWriteException(e))
          }
        }
        .addOnFailureListener { promise.reject(SegmentationFailedException(it)) }
    }

    // Names what's in the photo (like "Jeans" or "Denim"), most likely first.
    AsyncFunction("labelImageAsync") { uri: String, promise: Promise ->
      labeler.process(InputImage.fromBitmap(loadBitmap(uri), 0))
        .addOnSuccessListener { labels ->
          promise.resolve(
            labels
              .sortedByDescending { it.confidence }
              .take(MAX_LABELS)
              .map { mapOf("label" to it.text, "confidence" to it.confidence.toDouble()) }
          )
        }
        .addOnFailureListener { promise.reject(LabelingFailedException(it)) }
    }
  }

  // Decodes the photo at most MAX_SIDE pixels on its longest side, turned upright.
  private fun loadBitmap(uri: String): Bitmap {
    val parsed = Uri.parse(uri)
    val resolver = context.contentResolver
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    resolver.openInputStream(parsed)?.use { BitmapFactory.decodeStream(it, null, bounds) }
      ?: throw ImageLoadException()
    var sampleSize = 1
    while (maxOf(bounds.outWidth, bounds.outHeight) / (sampleSize * 2) >= MAX_SIDE) {
      sampleSize *= 2
    }
    val options = BitmapFactory.Options().apply { inSampleSize = sampleSize }
    val decoded = resolver.openInputStream(parsed)?.use { BitmapFactory.decodeStream(it, null, options) }
      ?: throw ImageLoadException()
    val rotation = resolver.openInputStream(parsed)?.use {
      when (ExifInterface(it).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)) {
        ExifInterface.ORIENTATION_ROTATE_90 -> 90f
        ExifInterface.ORIENTATION_ROTATE_180 -> 180f
        ExifInterface.ORIENTATION_ROTATE_270 -> 270f
        else -> 0f
      }
    } ?: 0f
    if (rotation == 0f) return decoded
    val matrix = Matrix().apply { postRotate(rotation) }
    return Bitmap.createBitmap(decoded, 0, 0, decoded.width, decoded.height, matrix, true)
  }

  // Crops away the fully transparent border around the cut-out item.
  private fun cropToVisible(bitmap: Bitmap): Bitmap? {
    val width = bitmap.width
    val height = bitmap.height
    val pixels = IntArray(width * height)
    bitmap.getPixels(pixels, 0, width, 0, 0, width, height)
    var left = width
    var top = height
    var right = -1
    var bottom = -1
    for (y in 0 until height) {
      for (x in 0 until width) {
        if ((pixels[y * width + x] ushr 24) > 16) {
          if (x < left) left = x
          if (x > right) right = x
          if (y < top) top = y
          if (y > bottom) bottom = y
        }
      }
    }
    if (right < left || bottom < top) return null
    return Bitmap.createBitmap(bitmap, left, top, right - left + 1, bottom - top + 1)
  }
}

internal class NoSubjectException : CodedException("No item found in the photo")

internal class ImageLoadException : CodedException("Couldn't open the photo")

internal class ImageWriteException(cause: Throwable) :
  CodedException("Couldn't save the cut-out photo", cause)

internal class SegmentationFailedException(cause: Throwable) :
  CodedException("Background removal failed: ${cause.message}", cause)

internal class LabelingFailedException(cause: Throwable) :
  CodedException("Labeling the photo failed: ${cause.message}", cause)
