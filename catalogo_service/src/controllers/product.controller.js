import Product from "../models/product.model.js";

// Obtener todos los productos
export const getProducts = async (req, res) => {
  try {
    const products = await Product.findAll();
    res.status(200).json(products);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener productos", error });
  }
};

// Crear producto (con imagen)
export const createProduct = async (req, res) => {
  try {
    const { nom_producto, cat_producto, pre_producto, sto_producto } = req.body;
    const imagen = req.file ? `/uploads/${req.file.filename}` : null;

    const product = await Product.create({
      nom_producto,
      cat_producto,
      pre_producto,
      sto_producto,
      imagen
    });

    res.status(201).json(product);
  } catch (error) {
    res.status(400).json({ message: "Error al crear producto", error });
  }
};

// Obtener producto por ID
export const getProductById = async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.id);
    if (!product) return res.status(404).json({ message: "Producto no encontrado" });
    res.json(product);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener producto", error });
  }
};

// Actualizar producto
export const updateProduct = async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.id);
    if (!product) return res.status(404).json({ message: "Producto no encontrado" });

    const { nom_producto, cat_producto, pre_producto, sto_producto } = req.body;
    const newImage = req.file ? `/uploads/${req.file.filename}` : product.imagen;

    await product.update({
      nom_producto,
      cat_producto,
      pre_producto,
      sto_producto,
      imagen: newImage,
    });

    res.json({ message: "Producto actualizado correctamente", product });
  } catch (error) {
    res.status(500).json({ message: "Error al actualizar producto", error });
  }
};


// Eliminar producto
export const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.id);
    if (!product) return res.status(404).json({ message: "Producto no encontrado" });
    await product.destroy();
    res.json({ message: "Producto eliminado correctamente" });
  } catch (error) {
    res.status(500).json({ message: "Error al eliminar producto", error });
  }
};

