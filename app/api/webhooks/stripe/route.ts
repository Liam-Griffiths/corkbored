import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// TODO: install stripe package and replace with real SDK verification
// npm install stripe
// import Stripe from "stripe";
// const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const BOOST_DAYS: Record<string, number> = {
  // Map price IDs to boost duration. Set STRIPE_BOOST_PRICE_ID in env.
  [process.env.STRIPE_BOOST_PRICE_ID ?? "__unset__"]: 30,
};

export async function POST(req: NextRequest): Promise<NextResponse> {
  const sig = req.headers.get("stripe-signature");
  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  // TODO: replace with real Stripe webhook verification once SDK is installed:
  // const event = stripe.webhooks.constructEvent(await req.text(), sig, process.env.STRIPE_WEBHOOK_SECRET!);

  // Stub — parse raw body as JSON for now (NOT safe for production without sig verification)
  let event: { type: string; data: { object: Record<string, unknown> } };
  try {
    event = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const projectId = session.client_reference_id as string | undefined;
    const priceId = (session as Record<string, unknown>).price_id as string | undefined;

    if (!projectId || !priceId || !BOOST_DAYS[priceId]) {
      return NextResponse.json({ received: true });
    }

    const days = BOOST_DAYS[priceId];
    const boostedUntil = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    await prisma.project.update({
      where: { id: projectId },
      data: { boostedUntil },
    });
  }

  return NextResponse.json({ received: true });
}
