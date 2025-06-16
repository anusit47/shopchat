import mongoose, { Schema } from 'mongoose';

// อัพเดตโครงสร้าง interface ตามโมเดลใหม่
export interface ImageData {
  fileName: string;
  mimetype: string;
  size: number;
}

export interface Page {
  pageNumber: number;
  mdText: string;
  hasImg: boolean;
  imgData?: ImageData; // เปลี่ยนจาก imgUrl เป็น imgData ตามโครงสร้างใหม่
}

export interface FileData {
  fileName: string;
  mimetype: string;
  size: number;
}

export interface IManual {
  pages: Page[];
  uploadStatus: 'processing' | 'completed' | 'failed';
  fileData: FileData;
}

const ManualSchema: Schema = new Schema(
  {
    pages: [{
      pageNumber: { type: Number, required: true },
      mdText: { type: String, required: true },
      hasImg: { type: Boolean, default: false },
      imgData: {
        fileName: { type: String, required: true },
        mimetype: { type: String, required: true },
        size: { type: Number, required: true }
      }
    }],
    uploadStatus: {
      type: String,
      enum: ["processing", "completed", "failed"],
      default: "pending"
    },
    fileData: {
      fileName: { type: String, required: true },
      mimetype: { type: String, required: true },
      size: { type: Number, required: true }
    }
  }, 
  {
    timestamps: true,
    collection: 'manuals',
  }
)

export default mongoose.model<IManual>('Manual', ManualSchema);
