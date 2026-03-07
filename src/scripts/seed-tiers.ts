import "dotenv/config";
import mongoose from "mongoose";
import { ensureDefaultSubscriptionTiers } from "../lib/platform-billing/subscription-tiers";

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not configured");
  }

  await mongoose.connect(uri);

  try {
    const tiers = await ensureDefaultSubscriptionTiers();
    console.log(
      JSON.stringify(
        {
          seeded: tiers.length,
          tiers: tiers.map((tier) => ({
            id: String(tier._id),
            code: tier.code,
            name: tier.name,
            priceMinor: tier.priceMinor,
            provisional: tier.provisional,
          })),
        },
        null,
        2
      )
    );
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
