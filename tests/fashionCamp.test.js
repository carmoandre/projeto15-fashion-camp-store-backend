import supertest from "supertest";
import connection from "../src/database.js";
import app from "../src/app.js";

beforeAll(async () => {});

afterEach(async () => {});

afterAll(async () => {
    await connection.end();
});

describe("POST /fashioncamp/sign-up", () => {
    beforeEach(async () => {
        await connection.query("DELETE FROM users");
    });

    it("returns status 201 for valid params and no conflict of email", async () => {
        const body = {
            name: "Testeiro",
            email: "teste@teste.com",
            password: "654321",
        };

        const response = await supertest(app)
            .post("/fashioncamp/sign-up")
            .send(body);
        expect(response.status).toEqual(201);
    });

    it("returns status 400 for invalid params", async () => {
        const body = {
            name: "",
            email: "teste@teste.com",
            password: "654321",
        };

        const firstTry = await supertest(app)
            .post("/fashioncamp/sign-up")
            .send(body);
        expect(firstTry.status).toEqual(400);

        const secondTry = await supertest(app)
            .post("/fashioncamp/sign-up")
            .send({ ...body, name: "Testeiro", email: "teste" });
        expect(secondTry.status).toEqual(400);

        const thirdTry = await supertest(app)
            .post("/fashioncamp/sign-up")
            .send({ ...body, name: "Testeiro", password: "" });
        expect(thirdTry.status).toEqual(400);
    });

    it("returns status 409 for conflicted email", async () => {
        const body = {
            name: "Testeiro",
            email: "teste@teste.com",
            password: "654321",
        };

        await connection.query(
            `INSERT INTO users (name, email, password) VALUES ($1, $2, $3)`,
            ["Testeiro2", body.email, "756342"]
        );

        const response = await supertest(app)
            .post("/fashioncamp/sign-up")
            .send(body);
        expect(response.status).toEqual(409);
    });
});

describe("POST /fashioncamp/sign-in", () => {
    beforeEach(async () => {
        await connection.query("DELETE FROM users");
        await connection.query("DELETE FROM sessions");
    });

    it("returns status 200 for valid params", async () => {
        const body = {
            email: "teste@teste.com",
            password: "654321",
        };

        await supertest(app)
            .post("/fashioncamp/sign-up")
            .send({ ...body, name: "Testeiro" });

        const response = await supertest(app)
            .post("/fashioncamp/sign-in")
            .send(body);
        expect(response.status).toEqual(200);
        expect(response.body).toEqual(
            expect.objectContaining({
                name: expect.any(String),
                token: expect.any(String),
            })
        );
    });

    it("returns status 400 for invalid params", async () => {
        const body = {
            email: "teste@teste.com",
            password: "654321",
        };

        await connection.query(
            `INSERT INTO users (name, email, password) VALUES ($1, $2, $3)`,
            ["Testeiro", body.email, body.password]
        );

        const firstTry = await supertest(app)
            .post("/fashioncamp/sign-in")
            .send({ ...body, email: "teste" });
        expect(firstTry.status).toEqual(400);

        const secondTry = await supertest(app)
            .post("/fashioncamp/sign-in")
            .send({ ...body, password: "" });
        expect(secondTry.status).toEqual(400);
    });

    it("returns status 404 for user not found", async () => {
        const body = {
            email: "teste@teste.com",
            password: "654321",
        };

        const response = await supertest(app)
            .post("/fashioncamp/sign-in")
            .send(body);
        expect(response.status).toEqual(404);
    });
});

describe("GET /categories", () => {
    const body = {
        name:"roberval",
        category:"Chinelo",
        value:1000,
        image:"this is a image"
    }
    beforeEach(async () => {
        await connection.query(`INSERT INTO products (name, category, value, image) VALUES ($1,$2,$3,$4)`,[body.name, body.category, body.value, body.image]);
    });
    afterEach(async () => {
        await connection.query(`DELETE FROM products`);
    });

    it("returns status 200", async () => {
        const response = await supertest(app)
            .get("/categories");
        expect(response.status).toEqual(200);
    });

});

describe("GET /products", () => {
    const body = {
        name:"roberval",
        category:"Chinelo",
        value:1000,
        image:"this is a image"
    }
    beforeEach(async () => {
        await connection.query(`INSERT INTO products (name, category, value, image) VALUES ($1,$2,$3,$4)`,[body.name, body.category, body.value, body.image]);
    });
    afterEach(async () => {
        await connection.query(`DELETE FROM products`);
    });

    it("returns an array of objects containing some products and status 200", async () => {
        const firstTry = await supertest(app).get("/products?search=rob");
        expect(firstTry.status).toEqual(200);

        const secondTry = await supertest(app).get("/products?category=Chinelo");
        expect(secondTry.status).toEqual(200);

        const thirdTry = await supertest(app).get("/products?category=Chinelo&search=erva");
        expect(thirdTry.status).toEqual(200);
    });

    it("returns an empty array as no product was found and status 200", async () => {
        const firstTry = await supertest(app).get("/products?category=China&search=erva");
        expect(firstTry.status).toEqual(200);

        const secondTry = await supertest(app).get("/products?category=Chinelo&search=abelha");
        expect(secondTry.status).toEqual(200);

        const thirdTry = await supertest(app).get("/products?category=Chinelo&search=abelha");
        expect(thirdTry.status).toEqual(200);
    });
});

describe("POST /product/add/:id", () => {
    
    it("inserts a product in a cart and returns status 200", async () => {
        const body = {
            email: "teste@teste.com",
            password: "654321",
        };
        const register = await supertest(app)
            .post("/fashioncamp/sign-up") 
            .send({...body,name:"Testeiro"})
        const user = await supertest(app)
            .post("/fashioncamp/sign-in")
            .send(body);
        const authHeader = `Bearer ${user.body.token}`;
        const result = await supertest(app)
            .post("/product/add/1")
            .set('Authorization', authHeader)
            .send();
        expect(result.status).toEqual(200);
    });

    it("tries to insert a new product to cart but user is not signed-in", async () => {
        const body = {
            email: "teste@teste.com",
            password: "654321",
        };
        const register = await supertest(app)
            .post("/fashioncamp/sign-up") 
            .send({...body,name:"Testeiro"})
        const user = await supertest(app)
            .post("/fashioncamp/sign-in")
            .send({email: "test@test.com", password:"123456"});
        const authHeader = `Bearer ${user.body.token}`;
        const result = await supertest(app)
            .post("/product/add/1")
            .set('Authorization', authHeader)
            .send();
        expect(result.status).toEqual(400);
    });
});