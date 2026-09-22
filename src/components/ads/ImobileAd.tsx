"use client";

import { ExternalLink, LayoutGrid } from "lucide-react";
import { useState } from "react";

import {
  AD_CONFIG,
  ADSENSE_TAGS,
  AFFILIATE_TAGS,
  IMOBILE_TAGS,
  type AdProvider,
  type AdSlotId,
} from "@/config/ads";

interface ImobileAdProps {
  placement: "top" | "result";
  slot: AdSlotId;
}

function buildAdDocument(tag: string) {
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;min-width:0;overflow:hidden;background:transparent}body{display:grid;min-height:100%;place-items:center}img,iframe,ins{max-width:100%}</style></head><body>${tag}</body></html>`;
}

export function ImobileAd({ placement, slot }: ImobileAdProps) {
  const [failedProviders, setFailedProviders] = useState<readonly AdProvider[]>([]);
  const slotConfig = AD_CONFIG.slots[slot];
  const providerTags: Partial<Record<AdProvider, string>> = {
    imobile: IMOBILE_TAGS[slot].trim(),
    adsense: ADSENSE_TAGS[slot].trim(),
    affiliate: AFFILIATE_TAGS[slot].trim(),
  };
  const provider = AD_CONFIG.providerPriority.find((candidate) =>
    candidate === "house" || (Boolean(providerTags[candidate]) && !failedProviders.includes(candidate)),
  );
  const adTag = provider ? providerTags[provider] : undefined;
  const useExternalAd = provider !== undefined && provider !== "house" && Boolean(adTag);

  if (!AD_CONFIG.enabled || !provider) return null;

  return (
    <aside
      className={`ad-slot ad-slot-${placement}`}
      aria-label={slotConfig.label}
      data-ad-provider={provider}
      style={{ minHeight: slotConfig.minHeight }}
    >
      <span className="ad-disclosure">{useExternalAd ? "広告" : "自社サービス案内"}</span>
      {useExternalAd ? (
        <iframe
          className="imobile-frame"
          title={slotConfig.label}
          srcDoc={buildAdDocument(adTag ?? "")}
          sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          onError={() => setFailedProviders((current) => current.includes(provider) ? current : [...current, provider])}
        />
      ) : (
        <div className="house-ad">
          <span className="house-ad-icon" aria-hidden="true"><LayoutGrid size={20} /></span>
          <span className="house-ad-copy">
            <small>{AD_CONFIG.house.eyebrow}</small>
            <strong>{AD_CONFIG.house.title}</strong>
            <span>{AD_CONFIG.house.description}</span>
          </span>
          <a className="house-ad-link" href={AD_CONFIG.house.href} target="_blank" rel="noopener noreferrer sponsored">
            {AD_CONFIG.house.linkLabel}<ExternalLink size={13} aria-hidden="true" />
          </a>
        </div>
      )}
    </aside>
  );
}
