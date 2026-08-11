// RISKS.md #7 / ARCHITECTURE.md §2: Messenger/Facebook/TikTok in-app browsers can break the
// "Add to Home Screen" PWA-install flow, exactly on the channels this app is meant to spread
// through. Detect by user-agent signature and prompt users to open in a real browser instead.
const IN_APP_UA_PATTERNS = [
  /FBAN|FBAV|FB_IAB/i, // Facebook app
  /Messenger/i, // Messenger app
  /Instagram/i, // Instagram app
  /musical_ly|tiktok|bytedancewebview/i, // TikTok app
  /\bLine\//i, // LINE app
];

export function isInAppBrowser(userAgent: string): boolean {
  return IN_APP_UA_PATTERNS.some((pattern) => pattern.test(userAgent));
}
