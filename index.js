require("dotenv").config();
const express = require("express");
const app = express();
const jwt = require("jsonwebtoken");
const cors = require("cors");
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

// jwt verify
const jwtVerify = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, message: "unauthorized access" });
  }
  //bearer token
  const token = authorization.split(" ")[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (error, decoded) => {
    if (error) {
      return res
        .status(401)
        .send({ error: true, message: "unauthorized access" });
    }
    req.decoded = decoded;
    next();
  });
};

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.gaxw2ro.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const usersCollection = client.db("mindFullHeaven").collection("users");
    const classesCollection = client.db("mindFullHeaven").collection("classes");
    const paymentCollection = client
      .db("mindFullHeaven")
      .collection("payments");
    const selectedClassesCollection = client
      .db("mindFullHeaven")
      .collection("selectedClasses");

    // create token(jwt)
    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token });
    });
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      if (user?.role !== "admin") {
        return res
          .status(403)
          .send({ error: true, message: "Forbidden message" });
      }
      next();
    };

    // users related api
    app.put("/users/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const filter = { email: email };
      const options = { upsert: true };
      const updateDoc = {
        $set: user,
      };
      const result = await usersCollection.updateOne(
        filter,
        updateDoc,
        options
      );
      res.send(result);
    });
    app.get("/users", jwtVerify, verifyAdmin, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });
    app.get("/users/admin/:email", jwtVerify, async (req, res) => {
      const email = req.params.email;
      if (req.decoded.email !== email) {
        res.send({ admin: false });
        return;
      }
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const result = { admin: user?.role === "admin" };
      res.send(result);
    });
    app.get("/users/instructor/:email", jwtVerify, async (req, res) => {
      const email = req.params.email;
      if (req.decoded.email !== email) {
        res.send({ instructor: false });
        return;
      }
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const result = { instructor: user?.role === "instructor" };
      res.send(result);
    });
    app.get("/users/student/:email", jwtVerify, async (req, res) => {
      const email = req.params.email;
      if (req.decoded.email !== email) {
        res.send({ student: false });
        return;
      }
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const result = { student: user?.role === undefined };
      res.send(result);
    });
    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await usersCollection.updateOne(query, updateDoc);
      res.send(result);
    });
    app.patch("/users/instructor/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "instructor",
        },
      };
      const result = await usersCollection.updateOne(query, updateDoc);
      res.send(result);
    });
    app.delete("/users/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await usersCollection.deleteOne(query);
      res.send(result);
    });
    app.get("/users/instructor", async (req, res) => {
      const query = { role: "instructor" };
      const result = await usersCollection.find(query).toArray();
      res.send(result);
    });
    app.get("/users/popularInstructor", async (req, res) => {
      const query = { role: "instructor" };
      const result = await usersCollection.find(query).limit(6).toArray();
      res.send(result);
    });

    // all classes collection related api
    app.post("/addClass", async (req, res) => {
      const addClass = req.body;
      const result = await classesCollection.insertOne(addClass);
      res.send(result);
    });
    app.get("/manageClass", async (req, res) => {
      const result = await classesCollection.find().toArray();
      res.send(result);
    });
    app.patch("/manageClass/approve/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: "approve",
        },
      };
      const result = await classesCollection.updateOne(query, updateDoc);
      res.send(result);
    });
    app.patch("/manageClass/denied/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: "denied",
        },
      };
      const result = await classesCollection.updateOne(query, updateDoc);
      res.send(result);
    });
    app.put("/manageClass/feedback/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          feedback: req.body.feedback,
        },
      };
      const result = await classesCollection.updateOne(query, updateDoc);
      res.send(result);
    });
    app.put("/manageClass/update/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updated = req.body;
      const updateDoc = {
        $set: {
          className: updated.name,
          availableSeats: updated.seats,
          price: updated.price,
        },
      };
      const options = { upsert: true };
      const result = await classesCollection.updateOne(
        query,
        updateDoc,
        options
      );
      res.send(result);
    });
    app.get("/approveClasses", async (req, res) => {
      const query = { status: "approve" };
      const result = await classesCollection.find(query).toArray();
      res.send(result);
    });
    app.get("/myClass/:email", async (req, res) => {
      const email = req.params.email;
      const query = { instructorEmail: email };
      const result = await classesCollection.find(query).toArray();
      res.send(result);
    });

    // selected class related API
    app.post("/selectedClass", async (req, res) => {
      const selectedClass = req.body;
      const result = await selectedClassesCollection.insertOne(selectedClass);
      res.send(result);
    });
    app.get("/selectedClass/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await selectedClassesCollection.find(query).toArray();
      res.send(result);
    });
    app.get("/selectedClass/:id", async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const query = { _id: new ObjectId(id) };
      const result = await selectedClassesCollection.findOne(query).toArray();
      res.send(result);
    });
    app.delete("/selectedClass/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await selectedClassesCollection.deleteOne(query);
      res.send(result);
    });

    // create payment intent
    app.post("/create-payment-intent", jwtVerify, async (req, res) => {
      const { price } = req.body;
      const amount = price * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    // payment related api
    app.post("/payments", jwtVerify, async (req, res) => {
      const paymentData = req.body;
      const id = req.body.selectClassId;
      const insertResult = await paymentCollection.insertOne(paymentData);
      const query = { _id: new ObjectId(id) };
      const selectedClassResult = await selectedClassesCollection.deleteOne(
        query
      );
      const classId = req.body.classesId;
      const classQuery = { _id: new ObjectId(classId) };
      const classResult = await classesCollection.findOne(classQuery);
      const availableSeats = classResult.availableSeats;
      const newSeats = availableSeats - 1;
      const enrolled = classResult.enrolled;
      const newEnrolled = enrolled + 1;
      const updateDoc = {
        $set: {
          availableSeats: newSeats,
          enrolled: newEnrolled,
        },
      };
      const options = { upsert: true };
      const modifiedClassResult = await classesCollection.updateOne(
        classResult,
        updateDoc,
        options
      );
      res.send({
        insertResult,
        selectedClassResult,
        classResult,
        modifiedClassResult,
      });
    });

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Mind full heaven server running");
});

app.listen(port, () => {
  console.log(`Mind full server is running on: ${port}`);
});
