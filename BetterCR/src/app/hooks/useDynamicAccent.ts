import { useEffect } from 'react';
import { useTweaks } from '@app/tweaks/useTweaks';
import { extractDominantColor } from '@app/lib/image-color';
import { ACCENT_STORAGE_KEY } from '@shared/config';

/**
 * Temporarily overrides the app's global accent color based on an image URL.
 * Automatically restores the user's preferred settings when unmounted or when
 * the imageUrl is cleared.
 */
export function useDynamicAccent(imageUrl: string | undefined | null): void {
  const { tweaks } = useTweaks();

  useEffect(() => {
    if (!imageUrl) {
      return;
    }

    let active = true;

    void extractDominantColor(imageUrl).then((color) => {
      if (!active || !color) {
        return;
      }
      // Override the CSS variable in the React DOM
      document.documentElement.style.setProperty('--acc', color);
      
      // Mirror to chrome.storage.local so the content script intercepts it
      // and dynamically recolors the native Crunchyroll video player.
      try {
        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
          void chrome.storage.local.set({ [ACCENT_STORAGE_KEY]: color });
        }
      } catch {
        // Not in extension context
      }
    });

    return () => {
      active = false;
      // Restore user's preferred setting when leaving the page or changing anime
      document.documentElement.style.setProperty('--acc', tweaks.accent);
      try {
        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
          void chrome.storage.local.set({ [ACCENT_STORAGE_KEY]: tweaks.accent });
        }
      } catch {
        // Not in extension context
      }
    };
  }, [imageUrl, tweaks.accent]);
}
