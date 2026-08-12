allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

val newBuildDir: Directory =
    rootProject.layout.buildDirectory
        .dir("../../build")
        .get()
rootProject.layout.buildDirectory.value(newBuildDir)

subprojects {
    val newSubprojectBuildDir: Directory = newBuildDir.dir(project.name)
    project.layout.buildDirectory.value(newSubprojectBuildDir)
}
subprojects {
    project.evaluationDependsOn(":app")
}

// Some plugins (tflite_flutter, pulled in for the face-scan attendance
// feature) don't pin their own Java/Kotlin compile targets, so they inherit
// mismatched defaults (Java 11 vs Kotlin 21) from newer AGP/Kotlin Gradle
// Plugin versions and fail to build. Force every subproject to the same
// JVM target as the app module (17, see app/build.gradle.kts) instead of
// patching each plugin individually.
subprojects {
    // Skip :app - it's forced to evaluate eagerly above (evaluationDependsOn),
    // so by the time this runs it's already evaluated and afterEvaluate would
    // throw; it also already configures its own Java/Kotlin target (17)
    // consistently on its own, so it doesn't need this fix anyway.
    if (project.name == "app") return@subprojects

    // afterEvaluate so this runs after each plugin's own build.gradle has
    // already set its (often lower, e.g. Java 8/11) compileOptions - only
    // applying second guarantees this wins instead of being silently
    // overwritten by the plugin's own DSL.
    afterEvaluate {
        extensions.findByType<com.android.build.gradle.BaseExtension>()?.let { android ->
            android.compileOptions.sourceCompatibility = JavaVersion.VERSION_17
            android.compileOptions.targetCompatibility = JavaVersion.VERSION_17
        }
        tasks.withType<org.jetbrains.kotlin.gradle.tasks.KotlinCompile>().configureEach {
            compilerOptions.jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
        }
    }
}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}
