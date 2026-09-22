"use client";

import { ExternalLink, LayoutGrid } from "lucide-react";
import { useState } from "react";

import { AD_CONFIG, IMOBILE_TAGS, type AdSlotId } from "@/config/ads";

interface ImobileAdProps {
  placement: "top" | "result";
  slot: AdSlotId;
}

function buildAdDocument(tag: string) {
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;min-width:0;overflow:hidden;background:transparent}body{display:grid;min-height:100%;place-items:center}img,iframe,ins{max-width:100%}</style></head><body>${tag}</body></html>`;
}

export function ImobileAd({ placement, slot }: ImobileAdProps) {
  const [imobileFailed, setImobileFailed] = useState(false);
  const slotConfig = AD_CONFIG.slots[slot];
  const officialTag = IMOBILE_TAGS[slot].trim();
  const useImobile = AD_CONFIG.providerPriority.includes("imobile") && officialTag.length > 0 && !imobileFailed;
  const useHouse = AD_CONFIG.providerPriority.includes("house");

  if (!AD_CONFIG.enabled || (!useImobile && !useHouse)) return null;

  return (
    <aside
      className={`ad-slot ad-slot-${placement}`}
      aria-label={slotConfig.label}
      data-ad-provider={useImobile ? "imobile" : "house"}
      style={{ minHeight: slotConfig.minHeight }}
    >
      <span className="ad-disclosure">{useImobile ? "広告" : "自社サービス案内"}</span>
      {useImobile ? (
        <iframe
          className="imobile-frame"
          title={slotConfig.label}
          srcDoc={buildAdDocument(officialTag)}
          sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          onError={() => setImobileFailed(true)}
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
