export type PromotionPopupMode = 'text' | 'image' | 'both';

export interface PromotionPopupConfig {
  enabled: boolean;
  mode: PromotionPopupMode;
  title: string;
  text: string;
  imageUrl: string;
  ctaText?: string;
  ctaUrl?: string;
  validFrom?: string;
  validUntil?: string;
  updatedAt?: string;
}

export const EMPTY_PROMOTION_POPUP: PromotionPopupConfig = {
  enabled: false,
  mode: 'text',
  title: '',
  text: '',
  imageUrl: '',
  ctaText: '',
  ctaUrl: '',
  validFrom: '',
  validUntil: '',
  updatedAt: '',
};
