import express, { Request, Response } from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import { ProductSku } from './models/ProductSku'; 
import Manual from './models/Manual';

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
// app.get("/api/products/all", async (req: Request, res: Response): Promise<void> => {
//   try {
//     const products = await ProductSku.find().limit(10);
    
//     res.status(200).json({
//       success: true,
//       count: products.length,
//       data: products
//     });
//   } catch (error) {
//     console.error("Error fetching products:", error);
//     res.status(500).json({
//       success: false,
//       message: "เกิดข้อผิดพลาดในการดึงข้อมูลสินค้า"
//     });
//   }
// });

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
          const productNameLower = (prod.product_name ?? '').toLowerCase();
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


// API endpoint Get Manuals by Product SKU code
// app.get("/api/manuals/by-product/:code", async (req: Request, res: Response): Promise<void> => {
//   try {
//     const { code } = req.params;
    
//     if (!code) {
//       res.status(400).json({
//         success: false,
//         message: "กรุณาระบุรหัสสินค้า"
//       });
//       return;
//     }

//     // ค้นหาสินค้าตาม code
//     const product = await ProductSku.findOne({ code });
    
//     if (!product) {
//       res.status(404).json({
//         success: false,
//         message: `ไม่พบสินค้ารหัส ${code}`
//       });
//       return;
//     }

//     // ค้นหาคู่มือที่เชื่อมโยงกับสินค้านี้
//     const manuals = await Manual.find({ _id: product.manual_id });

//     if (manuals.length === 0) {
//       res.status(404).json({
//         success: false,
//         message: `ไม่พบคู่มือสำหรับสินค้ารหัส ${code}`
//       });
//       return;
//     }

//     res.status(200).json({
//       success: true,
//       count: manuals.length,
//       data: manuals
//     });
    
//   } catch (error) {
//     console.error("Error fetching manuals by product code:", error);
//     res.status(500).json({
//       success: false,
//       message: "เกิดข้อผิดพลาดในการดึงข้อมูลคู่มือ"
//     });
//   }
// }
// );


// API endpoint สำหรับค้นหาหน้าจาก chunk text โดยใช้ code ของสินค้า
app.post("/api/manuals/find-page", async (req: Request, res: Response): Promise<void> => {
  try {
    const { code, chunk_text } = req.body;

    // ตรวจสอบว่ามีการส่ง code และ chunk_text มาหรือไม่
    console.log("Received request to find page with code:", code, "and chunk_text:", chunk_text);
    
    
    if (!code || !chunk_text) {
      res.status(400).json({
        success: false,
        message: "กรุณาระบุ code และ chunk_text"
      });
      return;
    }

    // ค้นหาสินค้าจาก code เพื่อดึง manual_id
    const product = await ProductSku.findOne({ code });
    
    if (!product || !product.manual_id) {
      res.status(404).json({
        success: false,
        message: "ไม่พบสินค้าหรือคู่มือที่เกี่ยวข้องกับ code ที่ระบุ"
      });
      return;
    }

    // ค้นหา manual ด้วย manual_id ที่ได้จากสินค้า
    const manual = await Manual.findById(product.manual_id);
    
    if (!manual) {
      res.status(404).json({
        success: false,
        message: "ไม่พบคู่มือที่เกี่ยวข้องกับสินค้านี้"
      });
      return;
    }

    // ฟังก์ชันสำหรับค้นหา text ในหน้าต่างๆ
    const findPageByText = (text: string): { pageNumber: number, confidence: number } | null => {
      // เริ่มด้วยการค้นหาแบบเต็ม text
      for (const page of manual.pages) {
        if (page.mdText.includes(text)) {
          return { pageNumber: page.pageNumber, confidence: 1.0 };
        }
      }
      
      // ถ้าไม่เจอ ลองตัดข้อความจากด้านหลังทีละน้อย
      let searchText = text;
      let minLength = Math.min(50, Math.floor(text.length * 0.3)); // ค้นหาอย่างน้อย 30% ของข้อความหรือ 50 ตัวอักษร
      
      while (searchText.length > minLength) {
        // ตัดข้อความจากด้านหลัง 10% ในแต่ละรอบ
        searchText = searchText.substring(0, Math.floor(searchText.length * 0.9));
        
        for (const page of manual.pages) {
          if (page.mdText.includes(searchText)) {
            // คำนวณความมั่นใจจากความยาวข้อความที่ตรงกัน
            const confidence = searchText.length / text.length;
            return { pageNumber: page.pageNumber, confidence };
          }
        }
      }
      
      // ถ้ายังไม่เจอ ลองแบ่งเป็นประโยคและค้นหาทีละประโยค
      const sentences = text.split(/[.!?]/).filter(s => s.trim().length > 20);
      
      if (sentences.length > 1) {
        for (const sentence of sentences) {
          const trimmedSentence = sentence.trim();
          if (trimmedSentence.length < 20) continue;
          
          for (const page of manual.pages) {
            if (page.mdText.includes(trimmedSentence)) {
              // ความมั่นใจขึ้นอยู่กับความยาวของประโยคเทียบกับ text ทั้งหมด
              const confidence = trimmedSentence.length / text.length * 0.8; // ลดความมั่นใจลง 20% เพราะไม่ใช่การตรงกันทั้งหมด
              return { pageNumber: page.pageNumber, confidence };
            }
          }
        }
      }
      
      // ถ้ายังไม่เจอ ลองหาคำสำคัญที่เป็นเอกลักษณ์
      const words = text.split(/\s+/).filter(word => word.length > 5); // คำที่ยาวกว่า 5 ตัวอักษร
      
      if (words.length > 0) {
        // สร้าง map เก็บคะแนนของแต่ละหน้า
        const pageScores = new Map<number, number>();
        
        for (const word of words) {
          for (const page of manual.pages) {
            if (page.mdText.includes(word)) {
              const currentScore = pageScores.get(page.pageNumber) || 0;
              pageScores.set(page.pageNumber, currentScore + 1);
            }
          }
        }
        
        // หาหน้าที่มีคะแนนสูงสุด
        let maxScore = 0;
        let bestPage = null;
        
        for (const [pageNumber, score] of pageScores.entries()) {
          if (score > maxScore) {
            maxScore = score;
            bestPage = pageNumber;
          }
        }
        
        if (bestPage !== null) {
          // คำนวณความมั่นใจจากสัดส่วนของคำที่พบ
          const confidence = maxScore / words.length * 0.6; // ลดความมั่นใจลง 40% เพราะเป็นการตรงกันแบบคำ
          return { pageNumber: bestPage, confidence };
        }
      }
      
      return null; // ไม่พบข้อความที่ตรงกันเลย
    };
    
    const result = findPageByText(chunk_text);
    
    if (result) {
      // ดึงข้อมูลของหน้าที่พบ
      const foundPage = manual.pages.find(p => p.pageNumber === result.pageNumber);
      
      res.status(200).json({
        success: true,
        data: {
          pageNumber: result.pageNumber,
          confidence: result.confidence,
          hasImg: foundPage?.hasImg || false,
          imgUrl: foundPage?.imgUrl || null,
          product_name: product.product_name || "",
          code: product.code
        }
      });
    } else {
      res.status(404).json({
        success: false,
        message: "ไม่พบข้อความนี้ในคู่มือ",
        product_name: product.product_name || "",
        code: product.code
      });
    }
    
  } catch (error) {
    console.error("Error finding page from chunk:", error);
    res.status(500).json({
      success: false,
      message: "เกิดข้อผิดพลาดในการค้นหาหน้า"
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
