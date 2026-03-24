const transactions = new Map();

function startPayment({ amount, phone }) {
  const txId = `TB-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  transactions.set(txId, {
    amount,
    phone: phone || null,
    paid: false,
    createdAt: Date.now()
  });
  return { txId };
}

function verifyPayment({ txId, amount }) {
  const transaction = transactions.get(txId);
  if (!transaction) {
    return { ok: false, error: "Transaction not found." };
  }

  // Mock verification rule:
  // amount must be at least 50 ETB and txId must exist.
  const paid = Number(amount) >= 50;
  transaction.paid = paid;
  transactions.set(txId, transaction);

  return { ok: paid, premiumUnlocked: paid };
}

module.exports = {
  startPayment,
  verifyPayment
};
