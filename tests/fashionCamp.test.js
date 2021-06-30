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

    it("returns status 400 for invalid params on body", async () => {
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
            `INSERT INTO users (name, email, password) VALUES ('Testeiro2', $1, '789451')`,
            [body.email]
        );

        const response = await supertest(app)
            .post("/fashioncamp/sign-up")
            .send(body);
        expect(response.status).toEqual(409);
    });
});
