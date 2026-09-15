package com.example.satyam_school

import android.view.ContextThemeWrapper
import android.widget.SeekBar
import android.widget.TextView
import android.widget.Toast
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

// The attendance kiosk's face-punch confirm step reproducibly corrupted
// Flutter's own rendering right after the on-device face-detection/TFLite
// pipeline ran (multiple screens' text painted stacked on top of each
// other) - reproduced across every Flutter-side fix tried (layout
// widgets, rendering backend, camera preview, even a fresh route) and two
// different Flutter SDK versions, so the fix here is to not ask Flutter to
// paint that confirmation at all: a native Android AlertDialog/Toast is
// composited entirely outside Flutter's engine and never touches whatever
// Flutter-side state the ML pipeline was corrupting.
//
// confirmPunchCode below is the same fix applied to the code-entry fallback
// screen (enter_punch_code_page.dart): that screen is only ever reached
// straight from this one (face match failed / "Not Me"), so it inherited
// the exact same corrupted-paint symptom the first time it tried a
// Flutter-rendered confirm step.
class MainActivity : FlutterActivity() {
    private val channelName = "com.satyamstars.attendance/native_ui"

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, channelName).setMethodCallHandler { call, result ->
            when (call.method) {
                "confirmPunch" -> {
                    val name = call.argument<String>("name") ?: ""
                    runOnUiThread {
                        val view = layoutInflater.inflate(R.layout.dialog_confirm_punch, null)
                        view.findViewById<TextView>(R.id.dialog_employee_name).text = name
                        // MaterialAlertDialogBuilder checks the ACTIVITY's own theme for an
                        // AppCompat/MaterialComponents ancestor before it'll even look at the
                        // styleResId below - Flutter's NormalTheme/LaunchTheme (styles.xml)
                        // descend from the plain platform Theme.Light, so that check fails and
                        // the dialog throws instead of showing. Wrapping the context in a real
                        // MaterialComponents theme satisfies that check without touching the
                        // app's actual theme; PunchConfirmDialogTheme still layers the brand
                        // colors/shape on top of it.
                        val dialogContext = ContextThemeWrapper(this, com.google.android.material.R.style.Theme_MaterialComponents_Light_Dialog_Alert)
                        MaterialAlertDialogBuilder(dialogContext, R.style.PunchConfirmDialogTheme)
                            .setView(view)
                            .setCancelable(false)
                            .setPositiveButton("Yes, Punch In") { dialog, _ ->
                                dialog.dismiss()
                                result.success("confirmed")
                            }
                            .setNegativeButton("Not Me · Enter Code") { dialog, _ ->
                                dialog.dismiss()
                                result.success("notMe")
                            }
                            .setNeutralButton("Cancel") { dialog, _ ->
                                dialog.dismiss()
                                result.success("cancelled")
                            }
                            .show()
                    }
                }
                "confirmPunchCode" -> {
                    val name = call.argument<String>("name") ?: ""
                    val maxTimeMillis = call.argument<Number>("maxTimeMillis")?.toLong() ?: System.currentTimeMillis()
                    val maxOffsetMinutes = call.argument<Int>("maxOffsetMinutes") ?: 0
                    runOnUiThread {
                        val view = layoutInflater.inflate(R.layout.dialog_confirm_punch_code, null)
                        view.findViewById<TextView>(R.id.dialog_employee_name).text = name
                        val timeView = view.findViewById<TextView>(R.id.dialog_checkin_time)
                        val seekBar = view.findViewById<SeekBar>(R.id.dialog_time_seekbar)
                        val sliderHint = view.findViewById<TextView>(R.id.dialog_slider_hint)
                        val fmt = SimpleDateFormat("h:mm a", Locale.getDefault())
                        var offsetMinutes = 0
                        fun updateTime() {
                            timeView.text = fmt.format(Date(maxTimeMillis - offsetMinutes * 60_000L))
                        }
                        updateTime()
                        if (maxOffsetMinutes > 0) {
                            seekBar.max = maxOffsetMinutes
                            seekBar.progress = 0
                            seekBar.setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
                                override fun onProgressChanged(sb: SeekBar, progress: Int, fromUser: Boolean) {
                                    offsetMinutes = progress
                                    updateTime()
                                }
                                override fun onStartTrackingTouch(sb: SeekBar) {}
                                override fun onStopTrackingTouch(sb: SeekBar) {}
                            })
                        } else {
                            seekBar.visibility = android.view.View.GONE
                            sliderHint.visibility = android.view.View.GONE
                        }
                        // Same theme-wrapper workaround as confirmPunch above (Flutter's base
                        // theme has no AppCompat/MaterialComponents ancestor).
                        val dialogContext = ContextThemeWrapper(this, com.google.android.material.R.style.Theme_MaterialComponents_Light_Dialog_Alert)
                        MaterialAlertDialogBuilder(dialogContext, R.style.PunchConfirmDialogTheme)
                            .setView(view)
                            .setCancelable(false)
                            .setPositiveButton("Punch In") { dialog, _ ->
                                dialog.dismiss()
                                result.success(mapOf("confirmed" to true, "offsetMinutes" to offsetMinutes))
                            }
                            .setNegativeButton("Not Me") { dialog, _ ->
                                dialog.dismiss()
                                result.success(mapOf("confirmed" to false, "offsetMinutes" to 0))
                            }
                            .show()
                    }
                }
                "showToast" -> {
                    val message = call.argument<String>("message") ?: ""
                    runOnUiThread {
                        Toast.makeText(this, message, Toast.LENGTH_LONG).show()
                    }
                    result.success(null)
                }
                else -> result.notImplemented()
            }
        }
    }
}
