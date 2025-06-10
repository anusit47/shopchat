// models/ManualSegment.ts
import mongoose, { Schema } from 'mongoose';

export interface IManualSegment {
  manual_id: mongoose.Types.ObjectId;
  segment_id: string;
  page_number: number;
  content: string;
  keywords: string[];
}

const ManualSegmentSchema = new Schema<IManualSegment>({
  manual_id: {
    type: Schema.Types.ObjectId,
    ref: 'Manual',
    required: true
  },
  segment_id: {
    type: String,
    required: true,
    unique: true
  },
  page_number: {
    type: Number,
    required: true
  },
  content: {
    type: String,
    required: true
  },
  keywords: [{
    type: String
  }]
}, {
  timestamps: true
});

// Create compound index for efficient querying
ManualSegmentSchema.index({ manual_id: 1, page_number: 1 });

const ManualSegment = mongoose.model<IManualSegment>('ManualSegment', ManualSegmentSchema);
export default ManualSegment;
