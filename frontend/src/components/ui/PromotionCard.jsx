import { promoValue, when } from '../../utils/formatters';

export default function PromotionCard({ promotion }) {
  return (
    <article className={`promo-card ${promotion.eligible_for_guest === false ? 'ineligible' : 'eligible'}`}>
      <div className="promo-card-head">
        <strong>{promotion.promotion_name}</strong>
        <span>{promotion.scope_type}</span>
      </div>
      <p>{promoValue(promotion)}</p>
      <div className="promo-card-meta">
        <span>{promotion.brand_name || promotion.scope_hotel_name || 'Global offer'}</span>
        <span>{promotion.member_only_flag ? 'Member offer' : 'Public offer'}</span>
        <span>{promotion.min_nights ? `${promotion.min_nights}+ nights` : 'Flexible stay'}</span>
        <span>{promotion.applies_to}</span>
      </div>
      <small className="muted-copy">
        Valid stay until {when(promotion.stay_end_date)}.
        {promotion.eligible_for_guest === false ? ' Guest is not eligible with current loyalty chain.' : ''}
      </small>
    </article>
  );
}
