import express from "express";
import cors from "cors";
import joi from "joi";
import bcrypt from "bcrypt";
import connection from "./database.js";

const signUpSchema = joi.object({
    name: joi.string().required(),
    email: joi
        .string()
        .required()
        .email({ minDomainSegments: 2, tlds: { allow: false } }),
    password: joi.string().required(),
});

const signInSchema = joi.object({
    email: joi
        .string()
        .required()
        .email({ minDomainSegments: 2, tlds: { allow: false } }),
    password: joi.string().required(),
});

const app = express();
app.use(cors());
app.use(express.json());

/* Sign Up Route */
app.post("/fashioncamp/sign-up", async (req, res) => {
    const validation = signUpSchema.validate(req.body);
    if (validation.error) {
        res.sendStatus(400);
        return;
    }

    const { name, email, password } = req.body;
    const result = await connection.query(
        `SELECT * FROM users
        WHERE email=$1`,
        [email]
    );
    if (result.rows.length) {
        res.sendStatus(409);
        return;
    }

    const hash = bcrypt.hashSync(password, 12);
    try {
        await connection.query(
            `INSERT INTO users (name, email, password)
            VALUES ($1, $2, $3)`,
            [name, email, hash]
        );
        res.sendStatus(201);
    } catch (err) {
        console.log(err);
        res.sendStatus(500);
    }
});

/* Sign In Route */

/* Show Products Route */
app.get("/products", async (req, res) => {
    try{
        const result = await connection.query(`SELECT * FROM products`);
        res.send(result.rows);
    }catch(err){
        console.log(err);
        res.sendStatus(400);
    }
});

/* Add product to Cart */
app.post("/product/add/:id", async (req, res) => {
    try{
        const {id} = req.params;
        console.log(id);
        const result = await connection.query(`SELECT * FROM products WHERE id = $1`,[id]);
    }catch(err){
        console.log(err);
        res.sendStatus(400);
    }
});

export default app;
