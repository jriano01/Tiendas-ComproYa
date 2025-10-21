import express from "express";
import { crearPedido, listarPedidos } from "../controllers/order.controller.js";

const router = express.Router();

// Crear pedido
router.post("/", crearPedido);

// Obtener pedidos (solo admin)
router.get("/", listarPedidos);

export default router;
