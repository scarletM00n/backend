import fs from "fs";
import multer, { FileFilterCallback } from "multer";
import path from "path";

const maxFileSize = Number(process.env.MAX_FILE_SIZE || 5 * 1024 * 1024);
const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const uploadRoot = path.resolve(process.cwd(), "uploads");

const ensureDirectory = (dirPath: string) => {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
};

const createStorage = (folderName: string) => multer.diskStorage({
    destination: (_req, _file, cb) => {
        const destination = path.join(uploadRoot, folderName);
        ensureDirectory(destination);
        cb(null, destination);
    },
    filename: (_req, file, cb) => {
        const extension = path.extname(file.originalname).toLowerCase();
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        cb(null, `${folderName}-${uniqueSuffix}${extension}`);
    },
});

const imageFilter = (
    _req: Express.Request,
    file: Express.Multer.File,
    cb: FileFilterCallback,
) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
        cb(new Error("Only JPEG, PNG, and WEBP images are allowed"));
        return;
    }

    cb(null, true);
};

const buildUpload = (folderName: string) => multer({
    storage: createStorage(folderName),
    fileFilter: imageFilter,
    limits: { fileSize: maxFileSize },
});

export const uploadAvatar = buildUpload("avatars");
export const uploadBrandLogo = buildUpload("brands");
export const uploadProductImage = buildUpload("products");
