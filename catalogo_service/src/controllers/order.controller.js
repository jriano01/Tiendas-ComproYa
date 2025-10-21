import Order from "../models/order.model.js";

// Crear una nueva "factura" (pedido)
export const crearPedido = async (req, res) => {
  try {
    const { cliente_nombre, total, detalles } = req.body;

    if (!cliente_nombre || !detalles || !total) {
      return res.status(400).json({ message: "Faltan datos del pedido." });
    }

    const nuevoPedido = await Order.create({
      cliente_nombre,
      total,
      detalles,
    });

    res.status(201).json({
      message: "✅ Pedido registrado correctamente",
      pedido: nuevoPedido,
    });
  } catch (error) {
    console.error("Error al crear pedido:", error);
    res.status(500).json({ message: "Error al crear pedido" });
  }
};

// Listar pedidos (solo administrador)
export const listarPedidos = async (req, res) => {
  try {
    const pedidos = await Order.findAll();
    res.json(pedidos);
  } catch (error) {
    res.status(500).json({ message: "Error al listar pedidos" });
  }
};
