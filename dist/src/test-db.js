"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const adapter_pg_1 = require("@prisma/adapter-pg");
const pg_1 = require("pg");
require("dotenv/config");
const connectionString = process.env.DATABASE_URL;
const pool = new pg_1.Pool({ connectionString });
const adapter = new adapter_pg_1.PrismaPg(pool);
const prisma = new client_1.PrismaClient({ adapter });
async function main() {
    console.log("Testing database connection...");
    // Try to create a dummy user
    const user = await prisma.user.create({
        data: {
            email: `test-${Date.now()}@example.com`,
            password: "hashedpassword123", // normally hashed securely
            name: "Test User",
        },
    });
    console.log("Successfully created user:", user);
    // Fetch all users
    const users = await prisma.user.findMany();
    console.log(`Total users in DB: ${users.length}`);
}
main()
    .catch((e) => {
    console.error("Error connecting to the database:", e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
