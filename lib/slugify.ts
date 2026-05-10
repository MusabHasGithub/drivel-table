// Slugify a free-text label (room name or category label) into a stable
// machine key. Used as the Firestore doc id, so:
//   - Lowercase + dash-separated → matches conventional URL slugs
//   - Strips anything but [a-z0-9-] → safe in URLs and field-path syntax
//   - Collapses runs of dashes + trims leading/trailing dashes
//
// Returning the original (post-trim) length-zero result is up to the caller
// to handle (currently: throw "label too sparse" or similar). We don't
// inject a fallback here so callers can't silently end up with id=""
// records in Firestore.

export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip combining accents
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}
