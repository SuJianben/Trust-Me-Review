import { useCallback, useEffect, useState } from "react";
import type { AuthenticatedRequest } from "../../api";
import type { ShopSettings } from "./types";

export const defaultShopSettings: ShopSettings = {
  request_enabled: true,
  request_delay_days: 14,
  max_products_per_order: 10,
  product_selection_strategy: "highest_price",
  request_spacing_days: 0,
  customer_request_cooldown_days: 0,
  show_verified_badge: true,
  star_color: "#f59e0b",
  email_subject_en: "How was your purchase?",
  email_subject_zh: "您的购买体验如何？",
};

type UseShopSettingsOptions = {
  request: AuthenticatedRequest;
  onError: (message: string) => void;
};

export function useShopSettings({ request, onError }: UseShopSettingsOptions) {
  const [settings, setSettings] = useState<ShopSettings>(defaultShopSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await request<Partial<ShopSettings>>("/api/admin/settings");
      setSettings({ ...defaultShopSettings, ...data });
    } catch (issue) {
      onError((issue as Error).message);
    } finally {
      setLoading(false);
    }
  }, [onError, request]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await request<{ ok: boolean }>("/api/admin/settings", {
        method: "PATCH",
        body: JSON.stringify({
          requestEnabled: settings.request_enabled,
          requestDelayDays: settings.request_delay_days,
          maxProductsPerOrder: settings.max_products_per_order,
          productSelectionStrategy: settings.product_selection_strategy,
          requestSpacingDays: settings.request_spacing_days,
          customerRequestCooldownDays: settings.customer_request_cooldown_days,
          showVerifiedBadge: settings.show_verified_badge,
          starColor: settings.star_color,
          emailSubjectEn: settings.email_subject_en,
          emailSubjectZh: settings.email_subject_zh,
        }),
      });
      setSaved(true);
    } catch (issue) {
      onError((issue as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return { settings, setSettings, loading, saving, saved, save };
}
