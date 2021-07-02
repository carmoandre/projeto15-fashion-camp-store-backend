import express from "express";
import cors from "cors";
import joi from "joi";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
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
app.post("/fashioncamp/sign-in", async (req, res) => {
    const validation = signInSchema.validate(req.body);
    if (validation.error) {
        res.sendStatus(400);
        return;
    }

    const { email, password } = req.body;
    try {
        const result = await connection.query(
            `SELECT * FROM users
            WHERE email=$1`,
            [email]
        );
        const user = result.rows[0];
        if (user && bcrypt.compareSync(password, user.password)) {
            const data = { user: user.id };
            const secretKey = process.env.JWT_SCRET;
            const configs = { expiresIn: 60 * 60 * 24 * 30 };
            const token = jwt.sign(data, secretKey, configs);

            await connection.query(
                `INSERT INTO sessions ("userId", token)
                VALUES ($1, $2)`,
                [user.id, token]
            );

            res.status(200).send({ name: user.name, token });
        } else {
            res.status(404).send(
                "Usuário não encontrado (email ou senha incorretos)."
            );
        }
    } catch (err) {
        console.log(err);
        res.sendStatus(500);
    }
});

/* Show Products */
app.get("/products", async (req, res) => {
    const category = req.query.category;
    const search = req.query.search?.replace(" ", "");
    try {
        const result = category
            ? search
                ? await connection.query(
                      `SELECT * FROM products WHERE category = $1 AND name ILIKE $2`,
                      [category, "%" + search + "%"]
                  )
                : await connection.query(
                      `SELECT * FROM products WHERE category = $1`,
                      [category]
                  )
            : search
            ? await connection.query(
                  `SELECT * FROM products WHERE name ILIKE $1`,
                  ["%" + search + "%"]
              )
            : await connection.query(`SELECT * FROM products`);
        res.send(result.rows);
    } catch (err) {
        console.log(err);
        res.sendStatus(400);
    }
});

app.get("/categories", async (req, res) => {
    try {
        const result = await connection.query(`SELECT category FROM products`);
        const resultToArray = [];
        result.rows.forEach((c) => {
            resultToArray.push(c.category);
        });
        const uniqueArray = [...new Set(resultToArray)];
        console.log(uniqueArray);
        res.send(uniqueArray);
    } catch (err) {
        console.log(err);
        res.sendStatus(400);
    }
});

/* Add product to Cart */
app.post("/product/add/:id", async (req, res) => {
    const productId = req.params.id;
    const authorization = req.headers["authorization"];
    const token = authorization.replace("Bearer ", "");
    const secretKey = process.env.JWT_SCRET;
    try {
        const data = jwt.verify(token, secretKey);
        const user = await connection.query(
            `SELECT * FROM sessions WHERE "userId" = $1 AND token = $2`,
            [data.user, token]
        );
        if (user.rows.length) {
            const cart = await connection.query(
                `SELECT * FROM carts WHERE "userId" = $1 AND "isActive" = TRUE`,
                [data.user]
            );
            const cartId = cart.rows.length
                ? cart.rows[0].id
                : (
                      await connection.query(
                          `INSERT INTO carts ("userId", "isActive") VALUES ($1, TRUE) RETURNING id`,
                          [data.user]
                      )
                  ).rows[0].id;
            const alreadyHasProduct = await connection.query(
                `SELECT * FROM cartproducts WHERE "cartId" = $1 AND "productId" = $2`,
                [cartId, productId]
            );
            if (!alreadyHasProduct.rows.length) {
                await connection.query(
                    `INSERT INTO cartproducts ("cartId", "productId", quantity) VALUES ($1, $2, '1')`,
                    [cartId, productId]
                );
            }
            res.sendStatus(200);
        } else {
            res.sendStatus(401);
        }
    } catch (err) {
        console.log(err);
        res.sendStatus(400);
    }
});

/* Cart Routes */
app.get("/fashioncamp/cart/", async (req, res) => {
    const authorization = req.header("Authorization");
    const token = authorization?.replace("Bearer ", "");

    if (!token) return res.sendStatus(401);

    const result = await connection.query(
        `SELECT * FROM sessions
        WHERE token=$1`,
        [token]
    );

    const userId = result.rows.length ? result.rows[0].userId : null;
    if (!userId) return res.status(404).send("Usuário não encontrado");

    try {
        const activeCart = await connection.query(
            `SELECT * FROM carts WHERE "userId"=$1 AND "isActive"=TRUE`,
            [userId]
        );
        const cart = activeCart.rows.length
            ? activeCart.rows[0]
            : (
                  await connection.query(
                      `INSERT INTO carts ("userId", "isActive")
                      VALUES ($1, $2) RETURNING *`,
                      [userId, "TRUE"]
                  )
              ).rows[0];
        const cartProducts = await connection.query(
            `SELECT products.id, products.name, 
            products.value, products.quantity AS stock, 
            cartproducts.quantity, products.image
            FROM cartproducts JOIN products
            ON cartproducts."productId"=products.id 
            WHERE "cartId"=$1`,
            [cart.id]
        );
        res.status(200).send({
            cartid: cart.id,
            cartProducts: cartProducts.rows,
        });
    } catch (err) {
        console.log(err);
        res.sendStatus(400);
    }
});

app.put("/fashioncamp/cart/alter-product-quantity", async (req, res) => {
    const authorization = req.header("Authorization");
    const token = authorization?.replace("Bearer ", "");

    if (!token) return res.sendStatus(401);

    const result = await connection.query(
        `SELECT * FROM sessions
        WHERE token=$1`,
        [token]
    );

    const userId = result.rows.length ? result.rows[0].userId : null;
    if (!userId) return res.status(404).send("Usuário não encontrado");

    const validation = customersSchema.validate(req.body);
    if (validation.error) {
        res.sendStatus(400);
        return;
    }

    const { cartId, productId, quantity } = req.body;
    const existentCart = await connection.query(
        `SELECT * FROM carts WHERE id=$1 AND "isActive"=TRUE`,
        [cartId]
    );

    if (existentCart.rows.length) {
        res.sendStatus(409);
        return;
    }
    try {
        await connection.query(
            `UPDATE cartproducts SET quantity=$1 WHERE "cartId"=$2 AND "productId"=$3`,
            [quantity, cartId, productId]
        );
        res.sendStatus(200);
    } catch (err) {
        console.log(err);
        res.sendStatus(400);
    }
});

app.delete(
    "/fashioncamp/cart/remove-product/:cartId/:productId",
    async (req, res) => {
        const authorization = req.header("Authorization");
        const token = authorization?.replace("Bearer ", "");

        if (!token) return res.sendStatus(401);

        const result = await connection.query(
            `SELECT * FROM sessions
        WHERE token=$1`,
            [token]
        );
        const userId = result.rows.length ? result.rows[0].userId : null;
        const { cartId, productId } = req.params;
        const existentCart = await connection.query(
            `SELECT * FROM carts WHERE id=$1`,
            [cartId]
        );
        const existentProduct = await connection.query(
            `SELECT * FROM products WHERE id=$1`,
            [productId]
        );
        if (
            !userId ||
            !existentCart.rows.length ||
            !existentProduct.rows.length
        ) {
            res.sendStatus(404);
            return;
        }

        try {
            connection.query(
                `DELETE FROM cartproducts WHERE "cartId"=$1 ANDND "productId"=$2`,
                [cartId, productId]
            );
            res.sendStatus(200);
        } catch (err) {
            console.log(err);
            res.status(400).send(
                "Erro ao tentar excluir o produto do carrinho"
            );
        }
    }
);

export default app;
