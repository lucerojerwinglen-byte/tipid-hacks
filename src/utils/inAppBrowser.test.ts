// Milestone 3 (ROADMAP.md): in-app-browser detection banner (RISKS.md #7).

import { describe, expect, it } from "vitest";
import { isInAppBrowser } from "./inAppBrowser.js";

const REAL_CHROME_ANDROID =
  "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
const REAL_SAFARI_IOS =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const FACEBOOK_IOS =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/450.0.0.0]";
const MESSENGER_ANDROID =
  "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.0.0 Mobile Safari/537.36 [FB_IAB/Messenger;FBAV/450.0.0.0]";
const INSTAGRAM_IOS =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 300.0.0.0";
const TIKTOK_ANDROID =
  "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.0.0 Mobile Safari/537.36 musical_ly_2023";

describe("isInAppBrowser", () => {
  it("does not flag real Chrome or Safari", () => {
    expect(isInAppBrowser(REAL_CHROME_ANDROID)).toBe(false);
    expect(isInAppBrowser(REAL_SAFARI_IOS)).toBe(false);
  });

  it("flags Facebook, Messenger, Instagram, and TikTok in-app browsers", () => {
    expect(isInAppBrowser(FACEBOOK_IOS)).toBe(true);
    expect(isInAppBrowser(MESSENGER_ANDROID)).toBe(true);
    expect(isInAppBrowser(INSTAGRAM_IOS)).toBe(true);
    expect(isInAppBrowser(TIKTOK_ANDROID)).toBe(true);
  });
});
