pluginManagement {
    val flutterSdkPath =
        run {
            val properties = java.util.Properties()
            file("local.properties").inputStream().use { properties.load(it) }
            val flutterSdkPath = properties.getProperty("flutter.sdk")
            require(flutterSdkPath != null) { "flutter.sdk not set in local.properties" }
            flutterSdkPath
        }

    includeBuild("$flutterSdkPath/packages/flutter_tools/gradle")

    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

plugins {
    id("dev.flutter.flutter-plugin-loader") version "1.0.0"
    // Pinned below 9.0 - AGP 9's built-in Kotlin support needs Flutter 3.47+
    // to opt into (this project is on 3.44.4), and without that opt-in some
    // plugins that gate their own Kotlin plugin application on "AGP >= 9"
    // (e.g. file_picker) end up with nothing compiling their .kt sources at
    // all - "cannot find symbol" for a class that genuinely exists in the
    // package. AGP <9 lets those plugins apply their own (working) Kotlin
    // plugin the old way. Revisit once the Flutter SDK here is upgraded to
    // 3.47+ and android.builtInKotlin=true is set.
    id("com.android.application") version "8.13.0" apply false
    id("org.jetbrains.kotlin.android") version "2.3.20" apply false
}

include(":app")
