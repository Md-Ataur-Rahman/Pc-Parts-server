const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const stripe = require("stripe")(process.env.SECRET_STRIPE_KEY);
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.tzvj1.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

console.log(uri);

async function run() {
  try {
    await client.connect();
    const toolsCollection = client.db("pc_parts").collection("tools");
    const ordersCollection = client.db("pc_parts").collection("orders");
    const paymentCollection = client.db("pc_parts").collection("payments");
    const reviewCollection = client.db("pc_parts").collection("reviews");

    app.post("/create-payment-intent", async (req, res) => {
      const paymentService = req.body;
      console.log(paymentService, "service");
      // const orderQuantity = paymentService.orderQuantity;
      // const amount = orderQuantity * perPrice * 100;
      // console.log(amount);
      const perPrice = await paymentService.perPrice;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: perPrice,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({ clientSecret: paymentIntent.client_secret });
    });

    app.get("/tools", async (req, res) => {
      const query = {};
      const cursor = toolsCollection.find(query);
      const tools = await cursor.toArray();
      res.send(tools);
    });
    app.get("/purchase/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const bookingTool = await toolsCollection.findOne(query);
      res.send(bookingTool);
    });
    app.post("/order", async (req, res) => {
      const order = req.body;
      const result = await ordersCollection.insertOne(order);
      res.send(result);
    });
    app.get("/myorders", async (req, res) => {
      const { email } = req.query;
      const query = { email };
      const result = await ordersCollection.find(query).toArray();
      res.send(result);
    });
    app.get("/paymentorder/:paymentId", async (req, res) => {
      const id = req.params.paymentId;
      const query = { _id: ObjectId(id) };
      const result = await ordersCollection.findOne(query);
      console.log(result);
      res.send(result);
    });
    app.patch("/purchase/:id", async (req, res) => {
      const id = req.params.id;
      const payment = req.body;
      const filter = { _id: ObjectId(id) };
      const updatedDoc = {
        $set: {
          paid: true,
          transactionId: payment.transactionId,
        },
      };

      const result = await paymentCollection.insertOne(payment);
      const updatedBooking = await bookingCollection.updateOne(
        filter,
        updatedDoc
      );
      res.send(updatedBooking);
    });

    app.post("/addreview", async (req, res) => {
      const review = req.body;
      const result = await reviewCollection.insertOne(review);
      res.send(result);
    });
    app.get("/reviews", async (req, res) => {
      const query = {};
      const cursor = reviewCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });
  } finally {
  }
}
run().catch(console.dir);
app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
