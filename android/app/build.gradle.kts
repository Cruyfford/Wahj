plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val serverUrl = (project.findProperty("serverUrl") as String?) ?: ""
val nativeRev = (project.findProperty("nativeRev") as String?) ?: ""
val webrtcVersion = (project.findProperty("webrtcVersion") as String?) ?: "150.7871.01"

android {
    namespace = "com.cruyfford.wahj"
    compileSdk = 34
    defaultConfig {
        applicationId = "com.cruyfford.wahj"
        minSdk = 26
        targetSdk = 34
        versionCode = 1
        versionName = "1.0"
        buildConfigField("String", "SERVER_URL", "\"$serverUrl\"")
        buildConfigField("String", "NATIVE_REV", "\"$nativeRev\"")
        ndk { abiFilters += listOf("arm64-v8a", "armeabi-v7a") }
    }
    signingConfigs {
        create("release") {
            storeFile = file("wahj.jks")
            storePassword = "wahj1234"
            keyAlias = "wahj"
            keyPassword = "wahj1234"
        }
    }
    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("release")
        }
    }
    buildFeatures { buildConfig = true }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    packaging { jniLibs { useLegacyPackaging = true } }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.work:work-runtime-ktx:2.9.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("io.github.webrtc-sdk:android:$webrtcVersion")
}
