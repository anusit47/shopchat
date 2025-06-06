import express, { Request, Response } from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import ProductSku from './models/ProductSku'; 

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/product-db';

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.get('/', (req: Request, res: Response) => {
  res.send('Product API is running');
});

// เพิ่ม endpoint นี้ใน server.ts
app.get("/api/products/all", async (req: Request, res: Response): Promise<void> => {
  try {
    const products = await ProductSku.find().limit(10);
    
    res.status(200).json({
      success: true,
      count: products.length,
      data: products
    });
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({
      success: false,
      message: "เกิดข้อผิดพลาดในการดึงข้อมูลสินค้า"
    });
  }
});

// Add this helper function before the routes
const escapeRegExp = (string: string): string => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

// API endpoint สำหรับค้นหาสินค้าด้วยชื่อ
app.get("/api/products/search", async (req: Request, res: Response): Promise<void> => {
  try {
    const { product_name } = req.query;
    
    if (!product_name) {
      res.status(400).json({
        success: false,
        message: "กรุณาระบุชื่อสินค้าที่ต้องการค้นหา"
      });
      return;
    }
    
    // Clean up the input string
    const cleanedInput = String(product_name).replace(/['"]/g, '');
    
    // Try exact match first
    let products = await ProductSku.find({
      product_name: cleanedInput
    }).limit(1);
    
    // If no exact match, fall back to partial search
    if (products.length === 0) {
      const searchTerms = cleanedInput.split(' ').filter(term => term.length > 1);
      const searchQuery = {
        $or: searchTerms.map(term => ({
          product_name: { $regex: escapeRegExp(term), $options: "i" }
        }))
      };
      products = await ProductSku.find(searchQuery).limit(5);
    }
    
    res.status(200).json({
      success: true,
      count: products.length,
      data: products
    });
    
  } catch (error) {
    console.error("Error searching products:", error);
    res.status(500).json({
      success: false,
      message: "เกิดข้อผิดพลาดในการค้นหาสินค้า"
    });
  }
});



// Connect to MongoDB
mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    // Start server
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error('MongoDB connection error:', error);
  });
