const express = require('express');
const router = express.Router();
const multer = require('multer');
const supabase = require('../config/supabase');
const { authenticate } = require('../middleware/auth');

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

router.post('/', authenticate, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const file = req.file;
    const fileExt = file.originalname.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
    const filePath = `${req.user.role}/${fileName}`;

    const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'documents';
    console.log('Attempting upload to bucket:', bucket);
    console.log('File path:', filePath);

    const { data, error } = await supabase.safeQuery(() =>
      supabase.storage
        .from(bucket)
        .upload(filePath, file.buffer, {
          contentType: file.mimetype,
          upsert: false
        })
    );

    if (error) {
      console.error('Supabase Storage Upload Error:', error);
      return res.status(500).json({ 
        error: error.message, 
        details: error,
        bucket: bucket,
        path: filePath
      });
    }

    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath);

    console.log('Upload successful. Public URL:', publicUrl);
    res.json({ url: publicUrl, path: filePath });
  } catch (error) {
    console.error('Upload route catch error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
