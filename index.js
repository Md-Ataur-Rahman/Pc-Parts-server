const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
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

function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: "UnAuthorized access" });
  }
  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: "Forbidden access" });
    }
    req.decoded = decoded;
    next();
  });
}

async function run() {
  try {
    await client.connect();
    const toolsCollection = client.db("pc_parts").collection("tools");
    const ordersCollection = client.db("pc_parts").collection("orders");
    const paymentCollection = client.db("pc_parts").collection("payments");
    const reviewCollection = client.db("pc_parts").collection("reviews");
    const userCollection = client.db("pc_parts").collection("users");
    const userProfileCollection = client
      .db("pc_parts")
      .collection("userProfile");

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
    app.put("/user/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const filter = { email: email };
      const options = { upsert: true };
      const updateDoc = {
        $set: user,
      };
      const result = await userCollection.updateOne(filter, updateDoc, options);
      const token = jwt.sign(
        { email: email },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: "1h" }
      );
      res.send({ result, token });
    });
    app.get("/users", async (req, res) => {
      const users = await userCollection.find().toArray();
      res.send(users);
    });
    app.put("/user/admin/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      const requester = req.decoded.email;
      const requesterAccount = await userCollection.findOne({
        email: requester,
      });
      if (requesterAccount.role === "admin") {
        const filter = { email: email };
        const updateDoc = {
          $set: { role: "admin" },
        };
        const result = await userCollection.updateOne(filter, updateDoc);
        res.send(result);
      } else {
        res.status(403).send({ message: "forbidden" });
      }
    });
    app.post("/product", async (req, res) => {
      const doctor = req.body;
      const result = await toolsCollection.insertOne(doctor);
      res.send(result);
    });

    app.put("/myprofile/:email", async (req, res) => {
      const email = req.params.email;
      const userProfile = req.body;
      const filter = { email: email };
      const options = { upsert: true };
      const updateDoc = {
        $set: userProfile,
      };
      const result = await userProfileCollection.updateOne(
        filter,
        updateDoc,
        options
      );
      res.send(result);
    });
    app.get("/myprofile/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await userProfileCollection.findOne(query);
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
