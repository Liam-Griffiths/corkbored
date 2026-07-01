import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/db";

const BOOST_DAYS: Record<string, number> = {
  // Map price IDs to boost duration. Set STRIPE_BOOST_PRICE_ID in env.
  [process.env.STRIPE_BOOST_PRICE_ID ?? "__unset__"]: 30,
};

export async function POST(req: NextRequest): Promise<NextResponse> {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const sig = req.headers.get("stripe-signature");

  if (!secretKey || !webhookSecret) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }
  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const stripe = new Stripe(secretKey);

  // Verify the signature against the raw body — rejects forged events.
  let event: Stripe.Event;
  try {
    const rawBody = await req.text();
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error("[stripe] signature verification failed", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const projectId = session.client_reference_id ?? undefined;

    // Resolve the purchased price to a boost duration.
    let priceId: string | undefined;
    try {
      const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 1 });
      priceId = lineItems.data[0]?.price?.id ?? undefined;
    } catch (err) {
      console.error("[stripe] could not list line items", err);
    }

    if (projectId && priceId && BOOST_DAYS[priceId]) {
      const days = BOOST_DAYS[priceId];
      const boostedUntil = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
      await prisma.project.update({
        where: { id: projectId },
        data: { boostedUntil },
      });
    }
  }

  return NextResponse.json({ received: true });
}
