import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

import { Sequelize } from "sequelize";
const s = new Sequelize(
  process.env.MYSQL_DATABASE,
  process.env.MYSQL_USER,
  process.env.MYSQL_PASSWORD,
  { host: process.env.MYSQL_HOST, port: process.env.MYSQL_PORT, dialect: "mysql", logging: false }
);

console.log("ENV USER:", process.env.MYSQL_USER);
console.log("ENV DB  :", process.env.MYSQL_DATABASE);

try {
  await s.authenticate();
  console.log("✅ Conexión MySQL OK");
} catch (e) {
  console.error("❌ Error MySQL:", e.message);
} finally {
  process.exit(0);
}
