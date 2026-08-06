plugins {
    id("com.android.application")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
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

    buildTypes {
        release {
            // TODO: Add your own signing config for the release build.
            // Signing with the debug keys for now, so `flutter run --release` works.
            signingConfig = signingConfigs.getByName("debug")
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
            resValue("string", "app_name", "Satyam Stars - Teacher")
        }
        create("student") {
            dimension = "role"
            applicationId = "com.satyamstars.student"
            resValue("string", "app_name", "Satyam Stars - Student")
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
