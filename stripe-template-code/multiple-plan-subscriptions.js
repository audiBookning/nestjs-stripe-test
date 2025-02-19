const express = require("express");
const app = express();
const { resolve } = require("path");
// Replace if using a different env file or config
const env = require("dotenv").config({ path: "./.env" });
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

app.use(express.static(process.env.STATIC_DIR));

app.use(
  express.json({
    // We need the raw body to verify webhook signatures.
    // Let's compute it only when hitting the Stripe webhook endpoint.
    verify: function(req, res, buf) {
      if (req.originalUrl.startsWith("/webhook")) {
        req.rawBody = buf.toString();
      }
    }
  })
);

const asyncMiddleware = fn => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

app.get("/", (req, res) => {
  const path = resolve(process.env.STATIC_DIR + "/index.html");
  res.sendFile(path);
});

app.get("/setup-page", asyncMiddleware(async (req, res, next) => {
    animals = process.env.ANIMALS.split(',');

    var lookup_keys = [];
    animals.forEach(animal => lookup_keys.push(animal + "-monthly-usd"));

    const prices = await stripe.prices.list({
      lookup_keys: lookup_keys,
      expand:["data.product"]});

    var products = [];
    prices.data.forEach(price => {
      var product = {
        price: {id: price.id, unit_amount: price.unit_amount},
        title: price.product.metadata.title,
        emoji: price.product.metadata.emoji
      };
      products.push(product);
    });

    res.send({
      publicKey: process.env.STRIPE_PUBLISHABLE_KEY,
      minProductsForDiscount: process.env.MIN_PRODUCTS_FOR_DISCOUNT,
      discountFactor: process.env.DISCOUNT_FACTOR,
      products: products
    });
  })
);

app.post(
  "/create-customer",
  asyncMiddleware(async (req, res, next) => {
    // This creates a new Customer and attaches
    // the PaymentMethod to be default for invoice in one API call.
    const customer = await stripe.customers.create({
      payment_method: req.body.payment_method,
      email: req.body.email,
      invoice_settings: {
        default_payment_method: req.body.payment_method
      }
    });

    // In this example, we apply the coupon if the number of plans purchased
    // meets or exceeds the threshold.
    priceIds = req.body.price_ids;
    const eligibleForDiscount = priceIds.length >= process.env.MIN_PRODUCTS_FOR_DISCOUNT;
    const coupon = eligibleForDiscount ? process.env.COUPON_ID : null;

    // At this point, associate the ID of the Customer object with your
    // own internal representation of a customer, if you have one.
    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: priceIds.map(priceId => {
        return { price: priceId };
      }),
      expand: ["latest_invoice.payment_intent"],
      coupon: coupon
    });

    res.send(subscription);
  })
);

app.post(
  "/subscription",
  asyncMiddleware(async (req, res) => {
    let subscription = await stripe.subscriptions.retrieve(
      req.body.subscriptionId
    );
    res.send(subscription);
  })
);

// Webhook handler for asynchronous events.
app.post("/webhook", async (req, res) => {
  let data;
  let eventType;
  // Check if webhook signing is configured.
  if (process.env.STRIPE_WEBHOOK_SECRET) {
    // Retrieve the event by verifying the signature using the raw body and secret.
    let event;
    let signature = req.headers["stripe-signature"];

    try {
      event = stripe.webhooks.constructEvent(
        req.rawBody,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.log(`⚠️  Webhook signature verification failed.`);
      return res.sendStatus(400);
    }
    // Extract the object from the event.
    dataObject = event.data.object;
    eventType = event.type;

    // Handle the event
    // Review important events for Billing webhooks
    // https://stripe.com/docs/billing/webhooks
    // Remove comment to see the various objects sent for this sample
    switch (event.type) {
      case "customer.created":
        // console.log(dataObject);
        break;
      case "customer.updated":
        // console.log(dataObject);
        break;
      case "invoice.upcoming":
        // console.log(dataObject);
        break;
      case "invoice.created":
        // console.log(dataObject);
        break;
      case "invoice.finalized":
        // console.log(dataObject);
        break;
      case "invoice.payment_succeeded":
        // console.log(dataObject);
        break;
      case "invoice.payment_failed":
        // console.log(dataObject);
        break;
      case "customer.subscription.created":
        // console.log(dataObject);
        break;
      // ... handle other event types
      default:
        // Unexpected event type
        return res.status(400).end();
    }
  } else {
    // Webhook signing is recommended, but if the secret is not configured in `config.js`,
    // retrieve the event data directly from the request body.
    data = req.body.data;
    eventType = req.body.type;
  }

  res.sendStatus(200);
});

function errorHandler(err, req, res, next) {
  res.status(500).send({ error: { message: err.message } });
}

app.use(errorHandler);

app.listen(4242, () => console.log(`Node server listening on port ${4242}!`));