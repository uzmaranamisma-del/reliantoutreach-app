// Publish only after the signed APK is finished and its artifact has been checked.
// Both the download page and in-app update check use this one release record.
export const androidRelease = {
  version: "1.0.1",
  build: 3,
  notes: "Android push notification setup, permission reminders and in-app update checks.",
  apk: "https://github.com/uzmaranamisma-del/reliantoutreach-app/releases/download/android-v1.0.1-build3/ReliantOutreach-1.0.1-build3.apk",
};
