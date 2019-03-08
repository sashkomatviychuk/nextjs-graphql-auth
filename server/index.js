const express = require("express");
const mongoose = require("mongoose");
const { ApolloServer, gql, PubSub } = require("apollo-server-express");
const jwt = require("jsonwebtoken");
const expressPlayground = require("graphql-playground-middleware-express")
  .default;
const { readFileSync } = require("fs");
const { createServer } = require("http");
const cookieParser = require("cookie-parser");
const User = require("./models/User");
const Message = require("./models/Message");
require("dotenv").config();

const typeDefs = gql(
  readFileSync("./graphql/schema.graphql", { encoding: "utf-8" })
);
const resolvers = require("./graphql/resolvers");

const app = express();
const port = process.env.PORT || 8000;
const pubsub = new PubSub();

mongoose.Promise = global.Promise;
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useCreateIndex: true
  })
  .then(() => console.log(`MongoDB connected at ${process.env.MONGO_URI}`))
  .catch(error => console.error(error));

const { ObjectId } = mongoose.Types;
ObjectId.prototype.valueOf = function() {
  return this.toString();
};

app.use(cookieParser());
// use cookie parser to populate current user
app.use((req, res, next) => {
  const { token } = req.cookies;
  if (token) {
    const { _id } = jwt.verify(token, process.env.JWT_SECRET);
    // put the userId onto the req for future requests to access
    req.userId = _id;
  }
  next();
});

const graphQLServer = new ApolloServer({
  typeDefs,
  resolvers,
  context: ({ req, res }) => ({
    User,
    Message,
    req,
    res,
    pubsub
  })
});

graphQLServer.applyMiddleware({
  app,
  path: "/graphql",
  cors: { origin: "http://localhost", credentials: true }
});

app.get(
  "/playground",
  expressPlayground({
    endpoint: "/graphql",
    subscriptionEndpoint: `ws://localhost${graphQLServer.graphqlPath}`
  })
);

const httpServer = createServer(app);
graphQLServer.installSubscriptionHandlers(httpServer);

httpServer.listen({ port }, () => {
  console.log(
    `GraphQL Server running @ http://localhost:${port}${
      graphQLServer.graphqlPath
    }`
  );
});
