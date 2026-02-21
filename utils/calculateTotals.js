export const calculateTotals = (items, couponDiscount = 0) => {
  let saletotal = 0;

  for (const item of items) {
    saletotal += item.price * item.quantity;
  }

  couponDiscount = Math.min(couponDiscount, saletotal);

  const shipping = saletotal === 0 ? 0 : saletotal >= 1000 ? 0 : 50;
  const tax = 0;

  const finalAmount = Math.max(
    saletotal - couponDiscount + shipping + tax,
    0
  );

  return {
    saletotal, 
         
    couponDiscount,  
    shipping,
    tax,
    finalAmount      
  };
};
