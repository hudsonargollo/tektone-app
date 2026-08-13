-- Payment tracking for the internal cost ledger — which payment method was
-- used, and (for credit cards) a human-chosen alias so a transaction can be
-- bound to "which card" without ever storing real card numbers/data.
ALTER TABLE costs ADD COLUMN payment_method TEXT; -- pix | boleto | cartao | transferencia | dinheiro | outro
ALTER TABLE costs ADD COLUMN card_alias TEXT;      -- only meaningful when payment_method = 'cartao'
