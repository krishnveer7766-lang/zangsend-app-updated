import { processQueue } from './_queue.js';
import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function (req: VercelRequest, res: VercelResponse) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        console.log("Queue API called via", req.method);
        const result = await processQueue();
        return res.status(200).json(result);
    } catch (error: any) {
        console.error("Queue API Error:", error);
        return res.status(500).json({ 
            error: error.message || "Unknown error",
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
}
