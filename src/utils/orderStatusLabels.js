/** Maps backend `orders.status` to customer-facing copy. */
export function getStatusLabel(status) {
  const labels = {
    pending: 'Confirmed',
    matching: 'Finding driver',
    accepted: 'Driver assigned',
    pickup_en_route: 'Driver on the way',
    pickup_arrived: 'Driver arrived',
    collected: 'Parcel collected',
    delivery_en_route: 'Out for delivery',
    delivery_arrived: 'Driver at door',
    delivered: 'Delivered',
    completed: 'Completed',
    cancelled: 'Cancelled',
    unmatched: 'No drivers available',
    disputed: 'Disputed',
  };
  const key = String(status || '');
  return labels[key] || (key ? key.replace(/_/g, ' ') : '');
}
