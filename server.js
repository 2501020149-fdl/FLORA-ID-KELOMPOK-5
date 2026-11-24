require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');

const app = express();
app.use(cors());
app.use(express.static('public')); // taruh frontend (index.html) di folder public/

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 4 },
});

const API = 'https://my-api.plantnet.org/v2/identify';
const ORGAN_MAP = { daun: 'leaf', bunga: 'flower', buah: 'fruit', batang: 'bark' };

app.post('/api/identify', upload.array('images', 4), async (req, res) => {
  try {
    const files = req.files || [];
    if (!files.length) return res.status(400).json({ error: 'Unggah minimal 1 foto.' });
    if (files.some((f) => !f.mimetype.startsWith('image/')))
      return res.status(400).json({ error: 'File harus berupa gambar.' });

    let organs = req.body.organs || [];
    if (!Array.isArray(organs)) organs = [organs];
    const project = req.body.project || 'all';

    const form = new FormData();
    files.forEach((f, i) => {
      form.append('images', new Blob([f.buffer], { type: f.mimetype }), f.originalname);
      form.append('organs', ORGAN_MAP[String(organs[i] || '').toLowerCase()] || 'auto');
    });

    const url = `${API}/${encodeURIComponent(project)}?api-key=${process.env.PLANTNET_API_KEY}&lang=id&nb-results=3`;
    const r = await fetch(url, { method: 'POST', body: form });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return res.status(r.status).json({ error: data.message || 'Layanan identifikasi gagal.' });

    const results = (data.results || []).map((x) => ({
      name: x.species?.scientificNameWithoutAuthor,
      family: x.species?.family?.scientificNameWithoutAuthor,
      commonNames: x.species?.commonNames || [],
      score: Math.round((x.score || 0) * 100),
    }));
    res.json({ results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Terjadi kesalahan di server.' });
  }
});

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError)
    return res.status(400).json({ error: 'Maksimal 4 foto, tiap foto maksimal 8 MB.' });
  next(err);
});

app.listen(process.env.PORT || 3000, () =>
  console.log(`Server jalan di http://localhost:${process.env.PORT || 3000}`)
);
