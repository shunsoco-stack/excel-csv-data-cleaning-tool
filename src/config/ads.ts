export type AdProvider = "imobile" | "adsense" | "house" | "affiliate";
export type AdSlotId = "tool-top" | "tool-result";

interface AdSlotConfig {
  label: string;
  minHeight: number;
}

/**
 * Paste the complete, unmodified tag copied from the i-mobile dashboard between
 * the backticks for each slot. Keep an empty string until the official tag is
 * available; the app will show the house-ad fallback instead of a fake ad.
 */
export const IMOBILE_TAGS: Record<AdSlotId, string> = {
  "tool-top": String.raw``,
  "tool-result": String.raw``,
};

/** Optional future providers use the same slot contract and remain disabled while empty. */
export const ADSENSE_TAGS: Record<AdSlotId, string> = {
  "tool-top": String.raw``,
  "tool-result": String.raw``,
};

export const AFFILIATE_TAGS: Record<AdSlotId, string> = {
  "tool-top": String.raw``,
  "tool-result": String.raw``,
};

export const AD_CONFIG = {
  enabled: true,
  providerPriority: ["imobile", "adsense", "affiliate", "house"] satisfies readonly AdProvider[],
  slots: {
    "tool-top": {
      label: "広告枠 1",
      minHeight: 112,
    },
    "tool-result": {
      label: "広告枠 2",
      minHeight: 112,
    },
  } satisfies Record<AdSlotId, AdSlotConfig>,
  house: {
    eyebrow: "おすすめWebアプリ",
    title: "ブラウザで使える業務効率化ツール",
    description: "Excel・CSV、PDFなどの関連ツールをまとめて確認できます。",
    href: "https://tsukutta.app/portfolio/9b7d1d1e-1ad0-46b0-a83f-cacc36a2840f",
    linkLabel: "関連ツールを見る",
  },
} as const;
