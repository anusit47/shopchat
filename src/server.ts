import express, { Request, Response } from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import { ProductSku } from './models/ProductSku';
import Manual from './models/Manual';
import ManualSegment from './models/ManualSegment';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import axios from 'axios';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/product-db';

// Dify API configuration
const DIFY_BASE_URL = process.env.DIFY_BASE_URL || 'https://api.dify.ai/v1';
const DIFY_API_KEY = process.env.DIFY_API_KEY;
const DATASET_ID = process.env.DATASET_ID;

// Middleware
app.use(cors());
app.use(express.json());

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ storage });

// Helper function to escape RegExp special characters
const escapeRegExp = (string: string): string => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

// Routes
app.get('/', (req: Request, res: Response) => {
  res.send('Product API is running');
});

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

// Function to process manual text into chunks with page tracking
async function processManualIntoChunks(pages: Array<{pageNumber: number, mdText: string}>) {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
    separators: ["\n## ", "\n### ", "\n#### ", "\n", " ", ""]
  });

  const chunksByPage: Array<{content: string, pageNumber: number}> = [];
  
  // Process each page separately to maintain page number association
  for (const page of pages) {
    const pageChunks = await splitter.createDocuments([page.mdText]);
    
    // Associate each chunk with its page number
    const pageProcessedChunks = pageChunks.map(chunk => ({
      content: chunk.pageContent,
      pageNumber: page.pageNumber
    }));
    
    chunksByPage.push(...pageProcessedChunks);
  }

  return chunksByPage;
}

// Function to upload segments to Dify
async function uploadSegmentsToDify(documentId: string, segments: Array<{content: string, pageNumber: number}>) {
  try {
    if (!DIFY_API_KEY || !DATASET_ID) {
      throw new Error('Missing Dify API configuration');
    }

    const formattedSegments = segments.map(seg => ({
      content: seg.content,
      keywords: [`page:${seg.pageNumber}`, `${seg.pageNumber}`]
    }));

    const response = await axios.post(
      `${DIFY_BASE_URL}/datasets/${DATASET_ID}/documents/${documentId}/segments`,
      { segments: formattedSegments },
      {
        headers: {
          Authorization: `Bearer ${DIFY_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    return response.data.data;
  } catch (error: any) {
    console.error("Failed to upload segments to Dify:", error.response?.data || error.message);
    throw error;
  }
}

// API endpoint to process manual from product_sku and upload to Dify
app.post('/api/manuals/upload', async (req: Request, res: Response): Promise<void> => {
  try {
    const { product_sku, document_id } = req.body;

    if (!product_sku || !document_id) {
      res.status(400).json({ 
        success: false, 
        message: 'Missing required fields: product_sku, document_id' 
      });
      return;
    }

    // Find the product by SKU code
    const product = await ProductSku.findOne({ code: product_sku });
    
    if (!product) {
      res.status(404).json({
        success: false,
        message: `Product with SKU code ${product_sku} not found`
      });
      return;
    }

    // Find the manual using the manual_id from the product
    const manual = await Manual.findById(product.manual_id);
    
    if (!manual || !manual.pages || manual.pages.length === 0) {
      res.status(404).json({
        success: false,
        message: `No manual found for product ${product_sku}`
      });
      return;
    }

    // Sort pages by page number to ensure correct order
    const sortedPages = [...manual.pages].sort((a, b) => a.pageNumber - b.pageNumber);
    
    // Process each page into chunks while maintaining page number association
    const chunks = await processManualIntoChunks(sortedPages);
    
    // Upload chunks to Dify
    const uploadedSegments = await uploadSegmentsToDify(document_id, chunks);
    
    // Save segment information to MongoDB
    const segmentPromises = uploadedSegments.map(async (segment: any, index: number) => {
      const correspondingChunk = chunks[index];
      
      // Check if this segment already exists
      const existingSegment = await ManualSegment.findOne({ segment_id: segment.id });
      
      if (existingSegment) {
        // Update existing segment
        existingSegment.content = segment.content;
        existingSegment.page_number = correspondingChunk.pageNumber;
        existingSegment.keywords = segment.keywords || [];
        return existingSegment.save();
      } else {
        // Create new segment
        const manualSegment = new ManualSegment({
          manual_id: manual._id,
          segment_id: segment.id,
          page_number: correspondingChunk.pageNumber,
          content: segment.content,
          keywords: segment.keywords || []
        });
        
        return manualSegment.save();
      }
    });
    
    await Promise.all(segmentPromises);

    // Update product with reference to manual if not already set
    if (!product.manual_id) {
      product.manual_id = manual._id;
      await product.save();
    }

    res.status(201).json({
      success: true,
      message: 'Manual processed and uploaded to Dify successfully',
      product_name: product.product_name,
      manual_id: manual._id,
      segments_count: uploadedSegments.length
    });
  } catch (error) {
    console.error('Error processing manual:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process and upload manual',
      error: (error instanceof Error) ? error.message : String(error)
    });
  }
});

// API endpoint to get page number from segment_id
// app.get('/api/segments/:segment_id', async (req: Request, res: Response): Promise<void> => {
//   try {
//     const { segment_id } = req.params;
    
//     const segment = await ManualSegment.findOne({ segment_id }).populate('manual_id');
    
//     if (!segment) {
//       res.status(404).json({
//         success: false,
//         message: 'Segment not found'
//       });
//       return;
//     }
    
//     res.status(200).json({
//       success: true,
//       data: {
//         segment_id: segment.segment_id,
//         page_number: segment.page_number,
//         manual: segment.manual_id,
//         content: segment.content,
//         keywords: segment.keywords
//       }
//     });
//     return;
//   } catch (error) {
//     console.error('Error fetching segment:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Failed to fetch segment information',
//       error: (error as Error).message
//     });
//     return;
//   }
// });

// API endpoint สำหรับดึงรูปภาพจากหลาย segment_id
app.post("/api/segments/images", async (req: Request, res: Response): Promise<void> => {
  try {
    const { segment_ids } = req.body;
    
    if (!segment_ids || !Array.isArray(segment_ids) || segment_ids.length === 0) {
      res.status(400).json({
        success: false,
        message: "กรุณาระบุ segment_ids ในรูปแบบ array"
      });
      return;
    }

    // ดึงข้อมูล segments จาก segment_ids
    const segments = await ManualSegment.find({
      segment_id: { $in: segment_ids }
    });

    if (segments.length === 0) {
      res.status(404).json({
        success: false,
        message: "ไม่พบข้อมูล segments ตาม segment_ids ที่ระบุ"
      });
      return;
    }

    // รวบรวม manual_ids จาก segments
    const manualIds = [...new Set(segments.map(segment => segment.manual_id))];

    // ดึงข้อมูลคู่มือจาก manual_ids
    const manuals = await Manual.find({
      _id: { $in: manualIds }
    });

    // สร้าง map ของ manual_id เพื่อง่ายต่อการค้นหา
    const manualMap = new Map();
    manuals.forEach(manual => {
      manualMap.set(manual._id.toString(), manual);
    });

    // สร้าง map ของ segment_id เพื่อง่ายต่อการค้นหา
    const segmentMap = new Map();
    segments.forEach(segment => {
      segmentMap.set(segment.segment_id, segment);
    });

    // สร้างผลลัพธ์ที่มีรูปภาพสำหรับแต่ละ segment_id
    const results = segment_ids.map(segmentId => {
      const segment = segmentMap.get(segmentId);
      
      if (!segment) {
        return {
          segment_id: segmentId,
          found: false,
          message: "ไม่พบข้อมูล segment"
        };
      }

      const manual = manualMap.get(segment.manual_id.toString());
      
      if (!manual) {
        return {
          segment_id: segmentId,
          found: false,
          message: "ไม่พบข้อมูลคู่มือ"
        };
      }

      // ค้นหาหน้าที่ตรงกับ page_number ของ segment
      interface ManualPage {
        pageNumber: number;
        mdText?: string;
        imgUrl?: string;
      }

      interface ManualType {
        _id: any;
        pages: ManualPage[];
      }

      interface SegmentType {
        segment_id: string;
        manual_id: any;
        page_number: number;
        content?: string;
        keywords?: string[];
      }

      const page: ManualPage | undefined = (manual as ManualType).pages.find(
        (p: ManualPage) => p.pageNumber === (segment as SegmentType).page_number
      );
      
      if (!page || !page.imgUrl) {
        return {
          segment_id: segmentId,
          found: false,
          message: "ไม่พบรูปภาพ"
        };
      }

      return {
        segment_id: segmentId,
        found: true,
        imgUrl: page.imgUrl,
        pageNumber: segment.page_number
      };
    });

    // กรองเฉพาะผลลัพธ์ที่มีรูปภาพ
    const imagesFound = results.filter(result => result.found);

    res.status(200).json({
      success: true,
      total_segments: segment_ids.length,
      images_found: imagesFound.length,
      images: imagesFound.map(result => ({
        segment_id: result.segment_id,
        imgUrl: result.imgUrl,
        pageNumber: result.pageNumber
      }))
    });
    
  } catch (error) {
    console.error('Error retrieving segment images:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการดึงรูปภาพ',
      error: (error instanceof Error) ? error.message : String(error)
    });
  }
});


// // API endpoint to get all segments for a manual
// app.get('/api/manuals/:manual_id/segments', async (req: Request, res: Response) => {
//   try {
//     const { manual_id } = req.params;
    
//     const segments = await ManualSegment.find({ manual_id }).sort({ page_number: 1 });
    
//     res.status(200).json({
//       success: true,
//       count: segments.length,
//       data: segments
//     });
//   } catch (error) {
//     console.error('Error fetching manual segments:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Failed to fetch manual segments',
//       error: (error as Error).message
//     });
//   }
// });

// Connect to MongoDB
mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error('MongoDB connection error:', error);
  });
