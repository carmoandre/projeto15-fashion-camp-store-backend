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
