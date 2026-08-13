import { useState } from "react";
import { isInAppBrowser } from "../utils/inAppBrowser.js";

// RISKS.md #7: the primary sharing mechanic (share-as-image in group chats) routes people
// through exactly the in-app browsers that break "Add to Home Screen" on iOS. Session-only
// dismissal is enough here — this isn't a preference worth persisting across visits.
export function InAppBrowserBanner() {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || typeof navigator === "undefined" || !isInAppBrowser(navigator.userAgent)) {
    return null;
  }

  return (
    <div className="bg-marker px-4 py-2 text-center text-sm text-ink">
      For the full experience (and to save this app to your home screen), open this page in
      Safari or Chrome using the{" "}
      <span aria-hidden="true" className="font-semibold">
        ⋯
      </span>{" "}
      menu.{" "}
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="ml-1 font-semibold underline underline-offset-2 transition-opacity active:opacity-70"
      >
        Dismiss
      </button>
    </div>
  );
}
