import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const Product = sequelize.define("Product", {
  id_producto: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  nom_producto: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  cat_producto: {
    type: DataTypes.STRING(30),
    allowNull: false
  },
  pre_producto: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  sto_producto: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  imagen: {
    type: DataTypes.STRING,
    allowNull: true
  }
}, {
  tableName: "producto",
  timestamps: true
});

export default Product;
