/**
 * Customer-facing vehicle line from order + driver_profiles join.
 * Example: "White Toyota Corolla — CA 123-456"
 */
export function formatDriverVehicleLine(order) {
  if (!order) return null;
  const color = order.vehicle_color != null ? String(order.vehicle_color).trim() : '';
  const make = order.vehicle_make != null ? String(order.vehicle_make).trim() : '';
  const model = order.vehicle_model != null ? String(order.vehicle_model).trim() : '';
  const plate = order.vehicle_plate != null ? String(order.vehicle_plate).trim() : '';
  const vehicleParts = [color, make, model].filter(Boolean);
  const desc = vehicleParts.join(' ');
  if (desc && plate) return `${desc} — ${plate}`;
  if (desc) return desc;
  if (plate) return `Plate: ${plate}`;
  return null;
}
