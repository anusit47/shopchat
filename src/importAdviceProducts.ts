// src/scripts/importAdviceProducts.ts
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { ProductSku } from './models/ProductSku';
dotenv.config();

interface AdviceProduct {
  Item_no: number;
  code: string;
  product_name: string;
  warranty: string;
  saleprice: string;
  group_name: string;
  menu_name: string;
  recommend: string;
  spec: string;
  brand: string;
  feature: string | null;
  model: string;
  pic_: string;
}

interface AdviceResponse {
  returnCode: string;
  desc: string;
  totalProduct: number;
  res: AdviceProduct[];
}

async function importAdviceProducts() {
  try {
    // Connect to MongoDB
    if (mongoose.connection.readyState !== 1) {
      console.log('Connecting to MongoDB...');
      await mongoose.connect(process.env.MONGODB_URI!);
      console.log('Connected to MongoDB');
    }

    // Read the JSON file
    const filePath = path.resolve(process.cwd(), 'data/advice_nb_master_data2.json');
    console.log(`Reading file: ${filePath}`);
    
    const fileData = fs.readFileSync(filePath, 'utf8');
    const adviceData: AdviceResponse = JSON.parse(fileData);
    
    console.log(`Found ${adviceData.totalProduct} products in file`);
    
    // Process each product
    const results = {
      total: adviceData.res.length,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [] as string[]
    };
    
    for (const product of adviceData.res) {
      try {
        // Transform data to match ProductSku schema
        const productData = {
          code: product.code,
          item_no: product.Item_no.toString(),
          product_name: product.product_name,
          warranty: product.warranty,
          saleprice: product.saleprice,
          group_name: product.group_name,
          menu_name: product.menu_name,
          spec: product.spec,
          feature: product.feature || '',
          model: product.model,
          brand: product.brand.trim(), // Remove trailing spaces
          pic_: product.pic_,
          manual_id: null
        };
        
        // Check if product already exists
        const existingProduct = await ProductSku.findOne({ code: product.code });
        
        if (existingProduct) {
          // Update existing product
          await ProductSku.updateOne({ code: product.code }, productData);
          results.updated++;
        } else {
          // Create new product
          await ProductSku.create(productData);
          results.created++;
        }
      } catch (error: any) {
        results.errors.push(`Error with SKU ${product.code}: ${error.message}`);
        results.skipped++;
      }
      
      // Log progress every 100 products
      if ((results.created + results.updated + results.skipped) % 100 === 0) {
        console.log(`Processed ${results.created + results.updated + results.skipped}/${results.total} products`);
      }
    }
    
    console.log('Import completed:');
    console.log(`Total products: ${results.total}`);
    console.log(`Created: ${results.created}`);
    console.log(`Updated: ${results.updated}`);
    console.log(`Skipped/Errors: ${results.skipped}`);
    
    if (results.errors.length > 0) {
      console.log('First 5 errors:');
      results.errors.slice(0, 5).forEach(err => console.log(`- ${err}`));
    }
    
    return results;
  } catch (error: any) {
    console.error('Import failed:', error.message);
    throw error;
  } finally {
    // Close MongoDB connection
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      console.log('Disconnected from MongoDB');
    }
  }
}

// Check if script is run directly
const isMainModule = require.main === module;

if (isMainModule) {
  importAdviceProducts()
    .then(() => {
      console.log('Import script completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('Import script failed:', error);
      process.exit(1);
    });
}

export { importAdviceProducts };
