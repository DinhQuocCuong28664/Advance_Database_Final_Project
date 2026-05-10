export const nextDate = (days: number) => {
  const value = new Date();
  value.setDate(value.getDate() + days);
  return value.toISOString().slice(0, 10);
};

export const money = (value: number | string | null | undefined, currency = 'VND') =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'VND' ? 0 : 2,
  }).format(Number(value || 0));

export const when = (value: string | number | Date | null | undefined) =>
  value
    ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date(value))
    : 'N/A';

type PromotionLike = {
  promotion_type?: string;
  discount_value?: number | string | null;
  currency_code?: string | null;
} | null | undefined;

export const promoValue = (promotion: PromotionLike) =>
  promotion?.promotion_type === 'PERCENT_OFF'
    ? `${Number(promotion.discount_value || 0)}% off`
    : `${money(promotion?.discount_value, promotion?.currency_code || 'USD')} credit`;
