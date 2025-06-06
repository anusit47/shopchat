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
// API endpoint สำหรับค้นหาสินค้าด้วยชื่อแบบยืดหยุ่น
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
    const cleanedInput = String(product_name).trim().replace(/['"]/g, '');
    
    // 1. ลองค้นหาแบบตรงเป๊ะก่อน
    let product = await ProductSku.findOne({
      product_name: { $regex: new RegExp(`^${escapeRegExp(cleanedInput)}$`, 'i') }
    });
    
    // 2. ถ้าไม่เจอ ลองค้นหาแบบมีคำนั้นอยู่ในชื่อ
    if (!product) {
      product = await ProductSku.findOne({
        product_name: { $regex: new RegExp(`\\b${escapeRegExp(cleanedInput)}\\b`, 'i') }
      });
    }
    
    // 3. ถ้ายังไม่เจอ ลองค้นหาแบบมีส่วนของคำนั้นอยู่ในชื่อ
    if (!product) {
      product = await ProductSku.findOne({
        product_name: { $regex: new RegExp(escapeRegExp(cleanedInput), 'i') }
      });
    }
    
    // 4. ถ้ายังไม่เจอ ใช้วิธีแยกคำและให้คะแนนความเกี่ยวข้อง
    if (!product) {
      const searchTerms = cleanedInput.split(' ').filter(term => term.length > 1);
      
      // หาสินค้าที่มีคำใดคำหนึ่งตรงกับคำค้นหา
      const potentialMatches = await ProductSku.find({
        $or: searchTerms.map(term => ({
          product_name: { $regex: new RegExp(escapeRegExp(term), 'i') }
        }))
      }).limit(20); // ดึงมาจำนวนหนึ่งเพื่อเปรียบเทียบ
      
      if (potentialMatches.length > 0) {
        // คำนวณคะแนนความเกี่ยวข้องสำหรับแต่ละสินค้า
        const scoredProducts = potentialMatches.map(prod => {
          const productNameLower = prod.product_name.toLowerCase();
          let score = 0;
          
          // ให้คะแนนตามจำนวนคำที่ตรงกัน
          searchTerms.forEach(term => {
            const termLower = term.toLowerCase();
            if (productNameLower.includes(termLower)) {
              score += 1;
              
              // ให้คะแนนเพิ่มถ้าคำอยู่ติดกัน
              if (productNameLower.includes(cleanedInput.toLowerCase())) {
                score += 3;
              }
              
              // ให้คะแนนเพิ่มถ้าเป็นคำที่ขึ้นต้นชื่อสินค้า
              if (productNameLower.startsWith(termLower)) {
                score += 2;
              }
            }
          });
          
          return { product: prod, score };
        });
        
        // เรียงลำดับตามคะแนน
        scoredProducts.sort((a, b) => b.score - a.score);
        
        // เลือกสินค้าที่มีคะแนนสูงสุด
        product = scoredProducts[0].product;
      }
    }
    
    // ส่งผลลัพธ์กลับไป
    if (product) {
      res.status(200).json({
        success: true,
        count: 1,
        data: [product]
      });
    } else {
      res.status(200).json({
        success: true,
        count: 0,
        data: []
      });
    }
    
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
