import express from "express";
import cors from "cors";
import joi from "joi";
import bcrypt from "bcrypt";
import connection from "./database.js";

const app = express();
app.use(cors());
app.use(express.json());

/* Register Route */

/* Login Route */

/* Show Products Route */

export default app;
