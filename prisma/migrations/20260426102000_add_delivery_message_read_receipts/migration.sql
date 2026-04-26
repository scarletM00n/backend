ALTER TABLE "DeliveryMessage"
ADD COLUMN "read_at" TIMESTAMP(3);

CREATE INDEX "DeliveryMessage_order_id_read_at_idx"
ON "DeliveryMessage"("order_id", "read_at");
