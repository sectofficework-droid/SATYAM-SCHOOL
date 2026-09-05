import java.util.Properties
import java.io.FileInputStream

plugins {
    id("com.android.application")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

// Release signing - key.properties/upload-keystore.jks are gitignored and
// generated locally (see https://flutter.dev/to/reference-keystore). Falls
// back to null (and thus the debug key, below) when they're absent, so a
// fresh checkout still builds without them.
val keystoreProperties = Properties()
val keystorePropertiesFile = rootProject.file("key.properties")
val hasReleaseSigning = keystorePropertiesFile.exists()
if (hasReleaseSigning) {
    keystoreProperties.load(FileInputStream(keystorePropertiesFile))
}

android {
    namespace = "com.example.satyam_school"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildFeatures {
        // Needed for the per-flavor resValue("string", "app_name", ...) calls below.
        resValues = true
    }

    defaultConfig {
        // Overridden per-flavor below - this base value is never actually
        // shipped (every real build picks the teacher or student flavor).
        applicationId = "com.example.satyam_school"
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    signingConfigs {
        if (hasReleaseSigning) {
            create("release") {
                keyAlias = keystoreProperties["keyAlias"] as String
                keyPassword = keystoreProperties["keyPassword"] as String
                storeFile = file(keystoreProperties["storeFile"] as String)
                storePassword = keystoreProperties["storePassword"] as String
            }
        }
    }

    buildTypes {
        release {
            // Uses the real upload key once key.properties exists (see above);
            // falls back to the debug key so a fresh checkout without it can
            // still run `flutter run --release` locally. Play Store uploads
            // require key.properties to be present.
            signingConfig = if (hasReleaseSigning) signingConfigs.getByName("release") else signingConfigs.getByName("debug")
        }
    }

    // Two separately publishable apps built from this one codebase - a
    // distinct applicationId is what actually makes them two different Play
    // Store listings; the app_name resValue drives the label on the device's
    // home screen (see AndroidManifest.xml's android:label="@string/app_name").
    // Launcher icons can be overridden per flavor by adding files under
    // android/app/src/teacher/res/mipmap-*/ and android/app/src/student/res/mipmap-*/
    // (Android merges flavor-specific res/ on top of src/main/res/) - both
    // flavors still share the src/main/res/ icon until distinct ones are provided.
    flavorDimensions += "role"
    productFlavors {
        create("teacher") {
            dimension = "role"
            applicationId = "com.satyamstars.teacher"
            resValue("string", "app_name", "Teacher App - Satyam School")
        }
        create("student") {
            dimension = "role"
            applicationId = "com.satyamstars.student"
            resValue("string", "app_name", "SATYAM SCHOOL")
        }
        // Standalone kiosk app for face-scan staff attendance - meant to run
        // on one shared tablet/phone at the entrance, not installed per-user.
        create("attendance") {
            dimension = "role"
            applicationId = "com.satyamstars.attendance"
            resValue("string", "app_name", "Staff Attendance")
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

flutter {
    source = "../.."
}
