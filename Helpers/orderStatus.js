export function resolveOrderStatus(order) {
  const statuses = order.orderedProducts.map(i => i.status);

  const all = s => statuses.every(x => x === s);
  const some = s => statuses.some(x => x === s);


  if (all("Cancelled")) return "Cancelled";
  if (all("Returned")) return "Returned";
  if (all("Delivered")) return "Delivered";
  if (all("Shipped")) return "Shipped";

  if (some("Returned")) return "Partially Returned";
  if (some("Delivered")) return "Partially Delivered";

  if (some("Return Requested")) return "Return Requested";
  if (some("Shipped")) return "Processing";
  if (some("Processing")) return "Processing";

  return "Pending";
}
