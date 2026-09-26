package expo.modules.bellashare

import android.content.Intent
import android.net.Uri
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// Shared emails can be long, but anything past this isn't an order email.
private const val MAX_CHARS = 5_000_000

// Receives text and email files shared to Bella from other apps (the share
// menu entry is added to the manifest by app.plugin.js).
class BellaShareModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("BellaShare")

    Events("onShare")

    // The share Bella was opened with. Cleared once read, so reopening the
    // app or a reload doesn't import the same email twice.
    Function("takeSharedText") {
      val activity = appContext.currentActivity ?: return@Function null
      val text = sharedText(activity.intent) ?: return@Function null
      activity.intent = Intent(activity.intent).setAction(Intent.ACTION_MAIN)
      text
    }

    // A share while Bella is already open arrives as a new intent.
    OnNewIntent { intent ->
      val text = sharedText(intent) ?: return@OnNewIntent
      intent.action = Intent.ACTION_MAIN
      sendEvent("onShare", mapOf("text" to text))
    }
  }

  private fun sharedText(intent: Intent?): String? {
    if (intent?.action != Intent.ACTION_SEND) return null
    // An email file (.eml) or other attachment, when the app shares one.
    streamUri(intent)?.let { uri -> readText(uri)?.let { return it } }
    val html = intent.getStringExtra(Intent.EXTRA_HTML_TEXT)
    val text = intent.getCharSequenceExtra(Intent.EXTRA_TEXT)?.toString()
    // Mail apps put the subject in EXTRA_SUBJECT; it can name the shop.
    val subject = intent.getStringExtra(Intent.EXTRA_SUBJECT)
    val body = html?.takeIf { it.isNotBlank() } ?: text?.takeIf { it.isNotBlank() } ?: return null
    return if (subject.isNullOrBlank()) body else "Subject: $subject\n\n$body"
  }

  private fun streamUri(intent: Intent): Uri? =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri::class.java)
    } else {
      @Suppress("DEPRECATION")
      intent.getParcelableExtra(Intent.EXTRA_STREAM)
    }

  private fun readText(uri: Uri): String? =
    try {
      appContext.reactContext?.contentResolver?.openInputStream(uri)?.use { stream ->
        val text = stream.bufferedReader().readText()
        if (text.length > MAX_CHARS) null else text
      }
    } catch (e: Exception) {
      null
    }
}
