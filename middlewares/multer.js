import multer from "multer";

const storage = multer.memoryStorage(); // Store files in memory instead of disk

const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
  
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Invalid file type. Only JPEG, PNG, GIF, and WEBP are allowed."), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024, fieldSize: 20 * 1024 * 1024,  fields: 50, fieldNameSize: 1000 },
});

export default upload;