-- Add delivery role
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'delivery_person';

-- Add sender enum for delivery chat
DO $$
BEGIN
	CREATE TYPE "DeliveryMessageSender" AS ENUM ('customer', 'delivery', 'system');
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;

-- Address geolocation columns
ALTER TABLE "Address" ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION;
ALTER TABLE "Address" ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION;

-- Delivery tracking fields on Order
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "delivery_person_id" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "delivery_latitude" DOUBLE PRECISION;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "delivery_longitude" DOUBLE PRECISION;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "delivery_location_updated_at" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "assigned_at" TIMESTAMP(3);

DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_constraint
		WHERE conname = 'Order_delivery_person_id_fkey'
	) THEN
		ALTER TABLE "Order"
			ADD CONSTRAINT "Order_delivery_person_id_fkey"
			FOREIGN KEY ("delivery_person_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
	END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Order_delivery_person_id_idx" ON "Order"("delivery_person_id");
CREATE INDEX IF NOT EXISTS "Order_status_idx" ON "Order"("status");

-- Delivery messages table
CREATE TABLE IF NOT EXISTS "DeliveryMessage" (
	"id" TEXT NOT NULL,
	"order_id" TEXT NOT NULL,
	"sender" "DeliveryMessageSender" NOT NULL,
	"message" TEXT NOT NULL,
	"created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

	CONSTRAINT "DeliveryMessage_pkey" PRIMARY KEY ("id"),
	CONSTRAINT "DeliveryMessage_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "DeliveryMessage_order_id_idx" ON "DeliveryMessage"("order_id");