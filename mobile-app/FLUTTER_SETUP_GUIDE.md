# Flutter Setup Guide — Windows

## Step 1: Install Flutter SDK

1. Go to https://docs.flutter.dev/get-started/install/windows
2. Click **"Download Flutter SDK"** — download the .zip file (about 1 GB)
3. Extract it to `C:\flutter` (NOT in Program Files, no spaces in path)
4. Add Flutter to your PATH:
   - Search "Environment Variables" in Windows search
   - Click "Environment Variables"
   - Under "User variables", find "Path" → Edit → New
   - Add: `C:\flutter\bin`
   - Click OK on all dialogs

## Step 2: Install Android Studio

1. Download from https://developer.android.com/studio
2. Run the installer — use all default settings
3. On first launch, it will download Android SDK (this takes 10-15 minutes)
4. After install, open Android Studio → More Actions → SDK Manager
5. Under **SDK Platforms**: check Android 14 (API 34) → Apply
6. Under **SDK Tools**: check:
   - Android SDK Build-Tools
   - Android Emulator
   - Android SDK Platform-Tools
7. Click OK and wait for download

## Step 3: Accept Android Licenses

Open a new **Command Prompt** and run:
```
flutter doctor --android-licenses
```
Type `y` and press Enter for each question (about 5-6 times).

## Step 4: Create a Virtual Device (Emulator)

1. In Android Studio → More Actions → Virtual Device Manager
2. Click "Create Device" → Choose **Pixel 8** → Next
3. Select **API 34** (Tiramisu) → Download if needed → Next → Finish
4. Click the Play button ▶ to start the emulator

## Step 5: Verify Everything Works

Open a new Command Prompt and run:
```
flutter doctor
```
You should see checkmarks (✓) for:
- Flutter
- Android toolchain
- Android Studio

If you see ✗ for "Visual Studio" — that's only needed for Windows desktop apps, ignore it.

## Step 6: Configure the App

1. Open `D:\SATYAM-SCHOOL\mobile-app\lib\main.dart`
2. Replace `YOUR_PROJECT_ID` and `YOUR_ANON_KEY` with your actual Supabase values
   - Find them at: Supabase Dashboard → Settings → API
3. Copy your school logo image to `assets/images/school_logo.png`

## Step 7: Run the App

Open Command Prompt in the mobile-app folder:
```
cd D:\SATYAM-SCHOOL\mobile-app
flutter pub get
flutter run
```

The app will compile and open in the emulator (first build takes 3-5 minutes).

---

## Step 8: Set Up Supabase Database

1. Open Supabase Dashboard → SQL Editor
2. Copy and paste the content of `SUPABASE_SETUP.sql`
3. Click "Run"

## Step 9: Create App Login Accounts for Teachers & Students

In Supabase Dashboard → SQL Editor, run this for each teacher/student:

```sql
-- Create teacher login (Employee ID: EMP001)
SELECT create_teacher_login('EMP001', 'Satyam@123');

-- Create student login (Enrollment No: 2024001)  
SELECT create_student_login('2024001', 'Satyam@123');
```

Or we will add a bulk "Generate App Logins" button to the web admin panel.

---

## Troubleshooting

**`flutter: command not found`** — Restart Command Prompt after adding to PATH

**`No devices found`** — Start the emulator first, then run `flutter run`

**`SDK not found`** — Run `flutter config --android-sdk C:\Users\YOUR_NAME\AppData\Local\Android\Sdk`

**App shows "Invalid credentials"** — The teacher/student auth account hasn't been created in Supabase yet (Step 9)
