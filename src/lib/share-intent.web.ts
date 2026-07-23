/** Inert stand-in for expo-share-intent, which has no web implementation. */
export function useShareIntent() {
  return {
    hasShareIntent: false,
    shareIntent: { text: null, webUrl: null },
    resetShareIntent: () => {},
  };
}
